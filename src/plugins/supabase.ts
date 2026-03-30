import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}

const supabasePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  fastify.decorate('supabase', supabase);

  fastify.log.info('Supabase client initialized');
};

export default supabasePlugin;
