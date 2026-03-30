import { PrismaClient, FileType } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export class FileService {
  constructor(private prisma: PrismaClient) {}

  private getFileType(mimeType: string): FileType {
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (
      mimeType.includes('document') ||
      mimeType.includes('word') ||
      mimeType.includes('msword')
    )
      return 'WORD';
    return 'OTHER';
  }

  async upload(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    userId: string,
    folderId?: string
  ) {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    const storagePath = `${userId}/${folderId || 'root'}/${fileId}${ext}`;

    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET!)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from(process.env.SUPABASE_BUCKET!)
      .getPublicUrl(storagePath);

    const fileRecord = await this.prisma.file.create({
      data: {
        id: fileId,
        name: fileId + ext,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileType: this.getFileType(file.mimetype),
        size: file.buffer.length,
        storagePath,
        storageUrl: urlData.publicUrl,
        ownerId: userId,
        folderId,
      },
    });

    return fileRecord;
  }

  async getFile(fileId: string, userId: string) {
    return this.prisma.file.findFirst({
      where: {
        id: fileId,
        OR: [{ ownerId: userId }, { isPublic: true }],
      },
      include: { owner: { select: { id: true, email: true, firstName: true } } },
    });
  }

  async listFiles(
    userId: string,
    options: { folderId?: string; fileType?: FileType; search?: string; page?: number; limit?: number }
  ) {
    const { folderId, fileType, search, page = 1, limit = 20 } = options;

    const where: Record<string, unknown> = {
      OR: [{ ownerId: userId }, { isPublic: true }],
    };

    if (folderId) where.folderId = folderId;
    if (fileType) where.fileType = fileType;
    if (search) {
      where.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { owner: { select: { id: true, email: true } } },
      }),
      this.prisma.file.count({ where }),
    ]);

    return { files, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async deleteFile(fileId: string, userId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, ownerId: userId },
    });

    if (!file) throw new Error('File not found');

    await supabase.storage.from(process.env.SUPABASE_BUCKET!).remove([file.storagePath]);

    return this.prisma.file.delete({ where: { id: fileId } });
  }

  async getDownloadUrl(fileId: string, userId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, OR: [{ ownerId: userId }, { isPublic: true }] },
    });

    if (!file) throw new Error('File not found');

    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET!)
      .createSignedUrl(file.storagePath, 3600);

    if (error) throw error;
    return data.signedUrl;
  }

  async updateFileVisibility(fileId: string, userId: string, isPublic: boolean) {
    return this.prisma.file.update({
      where: { id: fileId, ownerId: userId },
      data: { isPublic },
    });
  }
}
