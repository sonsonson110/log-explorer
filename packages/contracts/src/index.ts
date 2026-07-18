export interface MetaResponse {
  /** Total number of indexed lines */
  totalLines: number;
  /** Unix epoch seconds of the earliest log entry, or null if no entries */
  minTimestamp: number | null;
  /** Unix epoch seconds of the latest log entry, or null if no entries */
  maxTimestamp: number | null;
  /** File size in bytes */
  fileSizeBytes: number;
}

export interface ChunkRequest {
  cursor: string;
  limit: number;
}

export interface ChunkResponse {
  lines: string[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SearchRequest {
  query: string;
  limit: number;
}

export interface SearchResponse {
  results: {
    line: string;
    lineNumber: number;
    cursor: string;
  }[];
}

export interface FilterRequest {
  query: string;
  cursor: string;
  limit: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Web Worker protocol — postMessage shapes for the main-thread ↔ log worker
// channel. Import these on both sides so the contract is enforced at compile
// time.
// ─────────────────────────────────────────────────────────────────────────────

/** Messages sent from the main thread to the log worker. */
export type WorkerRequest =
  | { type: "FETCH_CHUNK"; cursor: string; limit: number }
  | { type: "PREFETCH"; cursor: string; limit: number };

/** Messages sent from the log worker back to the main thread. */
export type WorkerResponse =
  | {
      type: "CHUNK_READY";
      /** The cursor that was requested — lets the receiver match request to response. */
      cursor: string;
      lines: string[];
      nextCursor: string | null;
      hasMore: boolean;
    }
  | {
      type: "ERROR";
      /** The cursor that failed. */
      cursor: string;
      message: string;
    };
