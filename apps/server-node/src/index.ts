import Fastify from 'fastify';
import { logRoutes } from './routes/logs.js';

const fastify = Fastify({
  logger: true
});

// Health check endpoint
fastify.get('/health', async (_request, _reply) => {
  return { status: 'ok' };
});

// Log query endpoints: /logs/:id/meta, /logs/:id/chunk, etc.
fastify.register(logRoutes);

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

