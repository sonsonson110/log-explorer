/**
 * logWorker.ts — Web Worker for log chunk fetch + cache.
 *
 * Owns the chunk cache and all network calls for log data.  The main thread
 * never fetches chunks directly; it postMessages a WorkerRequest and receives
 * a WorkerResponse back.
 *
 * Cache is an unbounded Map for M3-item-1.  Byte-budget LRU eviction is added
 * in the next checklist item.
 */

import type { ChunkResponse, WorkerRequest, WorkerResponse } from "contracts";

const BASE_URL = "/api";
const LOG_ID = "apache";

// ─────────────────────────────────────────────────────────────────────────────
// In-process cache
// ─────────────────────────────────────────────────────────────────────────────

/** Map<cursor, ChunkResponse> — grows unboundedly until LRU is added in M3-item-2. */
const cache = new Map<string, ChunkResponse>();

// ─────────────────────────────────────────────────────────────────────────────
// Network helper
// ─────────────────────────────────────────────────────────────────────────────

async function fetchChunk(
  cursor: string,
  limit: number,
): Promise<ChunkResponse> {
  const params = new URLSearchParams({ cursor, limit: String(limit) });
  const res = await fetch(`${BASE_URL}/logs/${LOG_ID}/chunk?${params}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, string>;
    throw new Error(
      body["error"] || `Failed to fetch chunk (status ${res.status})`,
    );
  }
  return res.json() as Promise<ChunkResponse>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleFetch(cursor: string, limit: number): Promise<void> {
  const cached = cache.get(cursor);
  if (cached) {
    console.log("[logWorker] cache hit", cursor);
    const msg: WorkerResponse = {
      type: "CHUNK_READY",
      cursor,
      lines: cached.lines,
      nextCursor: cached.nextCursor,
      hasMore: cached.hasMore,
    };
    self.postMessage(msg);
    return;
  }

  try {
    console.log("[logWorker] cache miss, fetching", cursor);
    const chunk = await fetchChunk(cursor, limit);
    cache.set(cursor, chunk);
    const msg: WorkerResponse = {
      type: "CHUNK_READY",
      cursor,
      lines: chunk.lines,
      nextCursor: chunk.nextCursor,
      hasMore: chunk.hasMore,
    };
    self.postMessage(msg);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown worker error";
    const errMsg: WorkerResponse = { type: "ERROR", cursor, message };
    self.postMessage(errMsg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message listener
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  switch (req.type) {
    case "FETCH_CHUNK":
    case "PREFETCH":
      // Both are handled identically for now — the only difference in future
      // milestones will be priority / scheduling.
      void handleFetch(req.cursor, req.limit);
      break;
    default:
      console.warn(
        "[logWorker] unknown message type:",
        (req as { type: string }).type,
      );
  }
});
