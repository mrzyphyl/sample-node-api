import { Job } from 'bullmq';
import { PrismaClient, ConversionStatus } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } from 'docx';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function processConversion(job: Job) {
  const prisma = new PrismaClient();
  const { userId, sourceFileId, targetFormat } = job.data;

  try {
    await job.updateProgress(10);

    const sourceFile = await prisma.file.findUnique({
      where: { id: sourceFileId },
    });

    if (!sourceFile) {
      throw new Error('Source file not found');
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET!)
      .download(sourceFile.storagePath);

    if (downloadError || !fileData) {
      throw new Error('Failed to download file');
    }

    const buffer = await fileData.arrayBuffer();
    const bufferData = Buffer.from(buffer);

    await job.updateProgress(30);

    let resultBuffer: Buffer;
    let resultMimeType: string;

    if (sourceFile.fileType === 'PDF') {
      const result = await convertPdfToWord(bufferData, job);
      resultBuffer = result.buffer;
      resultMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (sourceFile.fileType === 'IMAGE') {
      const result = await convertImageToWord(bufferData, sourceFile.mimeType, job);
      resultBuffer = result.buffer;
      resultMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else {
      throw new Error('Unsupported file type for conversion');
    }

    await job.updateProgress(80);

    const resultFileName = `${path.parse(sourceFile.originalName).name}_converted.docx`;
    const resultPath = `conversions/${userId}/${uuidv4()}.docx`;

    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET!)
      .upload(resultPath, resultBuffer, {
        contentType: resultMimeType,
      });

    if (uploadError) {
      throw new Error('Failed to upload converted file');
    }

    const { data: urlData } = supabase.storage
      .from(process.env.SUPABASE_BUCKET!)
      .getPublicUrl(resultPath);

    await prisma.conversionJob.update({
      where: { id: job.data.conversionJobId },
      data: {
        status: ConversionStatus.COMPLETED,
        progress: 100,
        resultUrl: urlData.publicUrl,
        resultPath,
        completedAt: new Date(),
      },
    });

    await prisma.file.create({
      data: {
        name: resultFileName,
        originalName: resultFileName,
        mimeType: resultMimeType,
        fileType: 'WORD',
        size: resultBuffer.length,
        storagePath: resultPath,
        storageUrl: urlData.publicUrl,
        ownerId: userId,
        metadata: { convertedFrom: sourceFileId },
      },
    });

    await job.updateProgress(100);
    await prisma.$disconnect();

    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    await prisma.conversionJob.update({
      where: { id: job.data.conversionJobId },
      data: {
        status: ConversionStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    await prisma.$disconnect();
    throw error;
  }
}

async function convertPdfToWord(pdfBuffer: Buffer, job: Job): Promise<{ buffer: Buffer }> {
  const pdfParse = (await import('pdf-parse')).default;
  const pdfData = await pdfParse(pdfBuffer);
  
  await job.updateProgress(50);

  const textContent = pdfData.text.replace(/\n{3,}/g, '\n\n');
  const paragraphs = textContent.split('\n\n').map(p => {
    const trimmed = p.trim();
    if (!trimmed) return null;
    
    if (trimmed.match(/^#+\s/)) {
      const level = trimmed.match(/^#+/)![0].length;
      return new Paragraph({
        children: [new TextRun({ text: trimmed.replace(/^#+\s/, ''), bold: true, size: 28 - level * 2 })],
        heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
      });
    }
    
    return new Paragraph({
      children: [new TextRun({ text: trimmed, size: 24 })],
      spacing: { after: 200 },
    });
  }).filter((p): p is Paragraph => p !== null);

  await job.updateProgress(70);

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return { buffer };
}

async function convertImageToWord(
  imageBuffer: Buffer,
  mimeType: string,
  job: Job
): Promise<{ buffer: Buffer }> {
  await job.updateProgress(40);

  const processedImage = await sharp(imageBuffer)
    .grayscale(false)
    .normalize()
    .toBuffer();

  const imageRun = new ImageRun({
    data: processedImage,
    transformation: {
      width: 600,
      height: 400,
    },
    type: mimeType.includes('png') ? 'png' : 'jpg',
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [imageRun],
          alignment: 'center',
        }),
        new Paragraph({
          children: [
            new TextRun({ 
              text: 'Note: This document was converted from an image. For best results, consider using OCR software for text extraction.', 
              italics: true,
              size: 20,
              color: '666666',
            }),
          ],
          alignment: 'center',
        }),
      ],
    }],
  });

  await job.updateProgress(70);

  const buffer = await Packer.toBuffer(doc);
  return { buffer };
}

export async function conversionWorker(job: Job) {
  console.log(`Processing job ${job.id} - ${job.name}`);
  
  const result = await processConversion(job);
  
  console.log(`Job ${job.id} completed`);
  
  return result;
}
