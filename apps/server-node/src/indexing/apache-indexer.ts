#!/usr/bin/env tsx
/**
 * Apache Log Indexer
 *
 * Streams through an Apache error log file and indexes each line into a
 * SQLite database for fast cursor-based pagination and byte-range seeking.
 *
 * Usage:
 *   tsx src/indexing/apache-indexer.ts [options]
 *
 * Options:
 *   --log <path>   Path to the Apache log file (default: data/Apache.log)
 *   --db  <path>   Path to the output SQLite DB  (default: db/apache-index.db)
 *   --force        Drop and recreate the table if it already exists
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Resolve project root (4 levels up from src/indexing/)
// ---------------------------------------------------------------------------

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface Args {
  log: string;
  db: string;
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  let log = path.join(PROJECT_ROOT, 'data', 'Apache.log');
  let db = path.join(PROJECT_ROOT, 'db', 'apache-index.db');
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--log' && argv[i + 1]) {
      log = path.resolve(argv[++i]);
    } else if (argv[i] === '--db' && argv[i + 1]) {
      db = path.resolve(argv[++i]);
    } else if (argv[i] === '--force') {
      force = true;
    }
  }

  return { log, db, force };
}

// ---------------------------------------------------------------------------
// Log line parser
//
// Apache error log format:
//   [Day Mon DD HH:MM:SS YYYY] [level] message...
//
// Examples:
//   [Thu Jun 09 06:07:04 2005] [notice] LDAP: Built with OpenLDAP LDAP SDK
//   [Thu Jun 09 07:11:21 2005] [error] [client 204.100.200.22] Directory index ...
// ---------------------------------------------------------------------------

// Allow 1 or 2 digit day-of-month (space-padded or zero-padded)
const LOG_PATTERN =
  /^\[(\w{3} \w{3} [ \d]\d \d{2}:\d{2}:\d{2} \d{4})\] \[(\w+)\]/;

interface ParsedLine {
  timestamp: number; // Unix epoch seconds
  level: string;
}

function parseLine(line: string): ParsedLine | null {
  const match = LOG_PATTERN.exec(line);
  if (!match) return null;

  // Normalise space-padded day: " 9" → "9" so Date.parse works everywhere
  const dateStr = match[1].replace(/  +/g, ' ').trim();
  const ts = Date.parse(dateStr);
  if (isNaN(ts)) return null;

  return {
    timestamp: Math.floor(ts / 1000),
    level: match[2],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const BATCH_SIZE = 1000;
const PROGRESS_EVERY = 5_000;

interface Row {
  lineNo: number;
  byteOffset: number;
  timestamp: number;
  level: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Validate input file
  if (!fs.existsSync(args.log)) {
    console.error(`Error: log file not found: ${args.log}`);
    process.exit(1);
  }

  // Ensure the db directory exists
  fs.mkdirSync(path.dirname(args.db), { recursive: true });

  console.log(`Log : ${args.log}`);
  console.log(`DB  : ${args.db}`);
  if (args.force) console.log('Mode: --force (drop + recreate)');
  console.log('');

  // ------------------------------------------------------------------
  // Set up SQLite
  // ------------------------------------------------------------------

  const sqliteDb = new Database(args.db);

  // WAL + NORMAL sync gives the best write throughput while remaining safe
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('synchronous = NORMAL');

  if (args.force) {
    console.log('Dropping existing table...');
    sqliteDb.exec('DROP TABLE IF EXISTS index_entries;');
  }

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS index_entries (
      line_no     INTEGER PRIMARY KEY,
      byte_offset INTEGER NOT NULL,
      timestamp   INTEGER NOT NULL,
      level       TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_timestamp ON index_entries (timestamp);
    CREATE INDEX IF NOT EXISTS idx_level     ON index_entries (level);
  `);

  const insert = sqliteDb.prepare(
    'INSERT OR REPLACE INTO index_entries (line_no, byte_offset, timestamp, level) ' +
      'VALUES (?, ?, ?, ?)',
  );

  const flushBatch = sqliteDb.transaction((rows: Row[]) => {
    for (const row of rows) {
      insert.run(row.lineNo, row.byteOffset, row.timestamp, row.level);
    }
  });

  // ------------------------------------------------------------------
  // Stream the log file
  // ------------------------------------------------------------------

  const fileStream = fs.createReadStream(args.log);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const startTime = Date.now();
  let lineNo = 0;
  let byteOffset = 0; // running byte position in the file
  let skipped = 0;
  const batch: Row[] = [];

  for await (const line of rl) {
    lineNo++;
    const currentOffset = byteOffset;

    // Advance cursor: UTF-8 byte length of this line + 1 newline byte.
    // crlfDelay:Infinity strips the \r, so we always add just 1 for \n.
    byteOffset += Buffer.byteLength(line, 'utf8') + 1;

    const parsed = parseLine(line);
    if (!parsed) {
      skipped++;
      continue;
    }

    batch.push({
      lineNo,
      byteOffset: currentOffset,
      timestamp: parsed.timestamp,
      level: parsed.level,
    });

    if (batch.length >= BATCH_SIZE) {
      flushBatch(batch);
      batch.length = 0;
    }

    if (lineNo % PROGRESS_EVERY === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(
        `  ${lineNo.toLocaleString()} lines processed... (${elapsed}s)\n`,
      );
    }
  }

  // Flush any remaining rows
  if (batch.length > 0) {
    flushBatch(batch);
  }

  sqliteDb.close();

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const indexed = lineNo - skipped;

  console.log('');
  console.log('Done.');
  console.log(`  Total lines : ${lineNo.toLocaleString()}`);
  console.log(`  Indexed     : ${indexed.toLocaleString()}`);
  console.log(`  Skipped     : ${skipped.toLocaleString()} (no timestamp/level match)`);
  console.log(`  Elapsed     : ${elapsed}s`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
