import { ChunkResponse } from 'contracts';

/**
 * Fetches a chunk of logs from the backend.
 * 
 * TODO: Integrate with backend endpoint GET /logs/:id/chunk
 */
export async function fetchChunk(cursor: string, limit: number): Promise<ChunkResponse> {
  // TODO: Implement API request to Fastify backend
  throw new Error("not implemented");
}
