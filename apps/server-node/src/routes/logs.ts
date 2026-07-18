import { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import type { MetaResponse, ChunkResponse } from 'contracts';

// ---------------------------------------------------------------------------
// Project-root resolution (same pattern as the indexer)
// ---------------------------------------------------------------------------

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

// ---------------------------------------------------------------------------
// Registry: map log ID → { logPath, dbPath }
//
// For now this is a static mapping. Later milestones can make it dynamic
// (e.g. enumerate the db/ directory).
// ---------------------------------------------------------------------------

interface LogEntry {
  logPath: string;
  dbPath: string;
}

const LOG_REGISTRY: Record<string, LogEntry> = {
  apache: {
    logPath: path.join(PROJECT_ROOT, 'data', 'Apache.log'),
    dbPath: path.join(PROJECT_ROOT, 'db', 'apache-index.db'),
  },
  openssh: {
    logPath: path.join(PROJECT_ROOT, 'data', 'OpenSSH.log'),
    dbPath: path.join(PROJECT_ROOT, 'db', 'openssh-index.db'),
  },
};

// ---------------------------------------------------------------------------
// SQLite prepared-statement cache
// We open each DB once per process and reuse the connection.
// ---------------------------------------------------------------------------

const dbCache = new Map<string, Database.Database>();

function getDb(dbPath: string): Database.Database {
  let db = dbCache.get(dbPath);
  if (!db) {
    db = new Database(dbPath, { readonly: true });
    // Optimise for read-heavy workload
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = OFF');
    dbCache.set(dbPath, db);
  }
  return db;
}

// ---------------------------------------------------------------------------
// Querystring / param schemas (Fastify uses JSON Schema for validation)
// ---------------------------------------------------------------------------

const chunkQuerySchema = {
  type: 'object',
  required: ['cursor', 'limit'],
  properties: {
    cursor: { type: 'string' },
    limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
  },
} as const;

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function logRoutes(fastify: FastifyInstance) {
  // -------------------------------------------------------------------------
  // GET /logs/:id/meta
  //
  // Returns aggregate metadata from index_entries plus the raw file size.
  // Single SQLite aggregate query — fast and constant-time regardless of file
  // size because the index is already built.
  // -------------------------------------------------------------------------

  fastify.get<{ Params: { id: string } }>('/logs/:id/meta', async (request, reply) => {
    const { id } = request.params;

    const entry = LOG_REGISTRY[id];
    if (!entry) {
      return reply.code(404).send({ error: `Unknown log id: ${id}` });
    }

    if (!fs.existsSync(entry.dbPath)) {
      return reply.code(503).send({ error: `Index not built yet for: ${id}` });
    }

    const db = getDb(entry.dbPath);

    const row = db
      .prepare(
        `SELECT
           COUNT(*)          AS indexedEntries,
           MAX(line_no)      AS totalPhysicalLines,
           MIN(timestamp)    AS minTimestamp,
           MAX(timestamp)    AS maxTimestamp
         FROM index_entries`,
      )
      .get() as { indexedEntries: number; totalPhysicalLines: number; minTimestamp: number | null; maxTimestamp: number | null };

    let fileSizeBytes = 0;
    if (fs.existsSync(entry.logPath)) {
      fileSizeBytes = fs.statSync(entry.logPath).size;
    }

    const response: MetaResponse = {
      indexedEntries: row.indexedEntries,
      totalPhysicalLines: row.totalPhysicalLines ?? 0,
      minTimestamp: row.minTimestamp,
      maxTimestamp: row.maxTimestamp,
      fileSizeBytes,
    };

    return response;
  });

  // -------------------------------------------------------------------------
  // GET /logs/:id/chunk?cursor=<line_no>&limit=<n>
  //
  // Returns up to `limit` log lines starting at the line given by `cursor`.
  //
  // Boundary handling via the "sentinel row" technique:
  //   - Look up byte_offset for line_no = cursor       → start of read window
  //   - Look up byte_offset for line_no = cursor+limit → start of the first
  //     line we do NOT want, i.e. the end of our read window.
  //   - If the sentinel exists: read exactly (sentinel.offset - start.offset)
  //     bytes — this is guaranteed to contain complete lines with no partial
  //     tail, because every stored offset is the exact start of a line.
  //   - If the sentinel is missing (we're near EOF): read from start.offset
  //     to end of file.
  //
  // This sidesteps the "read too many bytes and trim the partial last line"
  // problem entirely — the index already knows where each line ends.
  // -------------------------------------------------------------------------

  fastify.get<{
    Params: { id: string };
    Querystring: { cursor: string; limit: number };
  }>(
    '/logs/:id/chunk',
    { schema: { querystring: chunkQuerySchema } },
    async (request, reply) => {
      const { id } = request.params;
      const { cursor, limit } = request.query;

      const entry = LOG_REGISTRY[id];
      if (!entry) {
        return reply.code(404).send({ error: `Unknown log id: ${id}` });
      }

      if (!fs.existsSync(entry.dbPath)) {
        return reply.code(503).send({ error: `Index not built yet for: ${id}` });
      }

      // cursor is an opaque string that encodes line_no as a decimal integer.
      const lineNo = parseInt(cursor, 10);
      if (!Number.isFinite(lineNo) || lineNo < 1) {
        return reply.code(400).send({ error: 'cursor must be a positive integer string' });
      }

      const db = getDb(entry.dbPath);

      // Look up the byte offset for the requested starting line.
      const startRow = db
        .prepare('SELECT byte_offset FROM index_entries WHERE line_no = ?')
        .get(lineNo) as { byte_offset: number } | undefined;

      if (!startRow) {
        return reply.code(404).send({ error: `cursor ${cursor} not found in index` });
      }

      // Look up the sentinel: the first indexed line at or after lineNo+limit.
      // The index has gaps (not every line_no is present), so we use >= and
      // take the nearest row rather than an exact match.
      const sentinelLineNo = lineNo + limit;
      const sentinelRow = db
        .prepare('SELECT byte_offset FROM index_entries WHERE line_no >= ? ORDER BY line_no ASC LIMIT 1')
        .get(sentinelLineNo) as { byte_offset: number } | undefined;

      // Determine how many bytes to read.
      const startOffset = startRow.byte_offset;

      let readLength: number;
      if (sentinelRow) {
        // Sentinel exists: read exactly up to (but not including) its offset.
        // Every byte in [startOffset, sentinelRow.byte_offset) belongs to
        // lines lineNo … lineNo+limit-1. No partial lines possible.
        readLength = sentinelRow.byte_offset - startOffset;
      } else {
        // Near or at EOF: read to end of file.
        const fileSize = fs.statSync(entry.logPath).size;
        readLength = fileSize - startOffset;
      }

      if (readLength <= 0) {
        // Nothing to read — cursor is at or past the end.
        const response: ChunkResponse = { lines: [], nextCursor: null, hasMore: false };
        return response;
      }

      // Read the exact byte range from the file.
      const fd = fs.openSync(entry.logPath, 'r');
      let buffer: Buffer;
      try {
        buffer = Buffer.allocUnsafe(readLength);
        fs.readSync(fd, buffer, 0, readLength, startOffset);
      } finally {
        fs.closeSync(fd);
      }

      // Split into lines. The buffer contains complete lines (guaranteed by
      // the sentinel technique), so we can split on '\n' directly.
      // Filter empty strings that result from a trailing '\n'.
      const raw = buffer.toString('utf8');
      const allLines = raw.split('\n').filter((l) => l.length > 0);

      // Take at most `limit` lines (may be fewer if near EOF).
      const lines = allLines.slice(0, limit);
      const returnedCount = lines.length;

      // Determine the nextCursor: the line_no of the first line we did NOT
      // return. This is lineNo + returnedCount.
      const nextLineNo = lineNo + returnedCount;

      // Check whether there is actually a next line to paginate to.
      // Use >= because the index has gaps — nextLineNo itself may not exist.
      const hasNextRow = db
        .prepare('SELECT line_no FROM index_entries WHERE line_no >= ? ORDER BY line_no ASC LIMIT 1')
        .get(nextLineNo) as { line_no: number } | undefined;

      const hasMore = Boolean(hasNextRow);
      // Use the actual next indexed line_no as the cursor (skip over gaps).
      const nextCursor = hasMore ? String(hasNextRow!.line_no) : null;

      const response: ChunkResponse = { lines, nextCursor, hasMore };
      return response;
    },
  );
}
