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
