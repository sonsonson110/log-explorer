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
