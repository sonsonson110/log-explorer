import { ChunkResponse, MetaResponse } from 'contracts';

const BASE_URL = '/api';
const LOG_ID = 'apache'; // Static log ID for M2

/**
 * Fetches metadata for the log.
 */
export async function fetchMeta(): Promise<MetaResponse> {
  const response = await fetch(`${BASE_URL}/logs/${LOG_ID}/meta`);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to fetch metadata (status ${response.status})`);
  }
  return response.json();
}

/**
 * Fetches a chunk of logs from the backend.
 */
export async function fetchChunk(cursor: string, limit: number): Promise<ChunkResponse> {
  const params = new URLSearchParams({
    cursor,
    limit: String(limit)
  });
  const response = await fetch(`${BASE_URL}/logs/${LOG_ID}/chunk?${params.toString()}`);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Failed to fetch log chunk (status ${response.status})`);
  }
  return response.json();
}
