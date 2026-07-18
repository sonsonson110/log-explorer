# Milestones

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done
(agent: update this file per the process in `AGENTS.md`)

## M1 — Backend: index a real file, serve chunks by seek

- [x] Pick a loghub dataset (start: SSH or Apache, a few hundred MB)
- [x] Define index schema (line_no, byte_offset, timestamp, level) in SQLite
- [x] Streaming indexer, transaction-wrapped, run standalone from the CLI
- [x] `GET /logs/:id/meta` — single aggregate query (COUNT/MIN/MAX over index_entries + fs.stat for file size)
- [x] `GET /logs/:id/chunk?cursor&limit` — sentinel-row technique: look up offset for line_no and line_no+limit, read exact byte range, split; no partial-line trimming needed

**Definition of done:** indexer runs on the full file without loading it
into memory at once. `chunk` returns continuous, non-overlapping results
when cursor-chained. A `chunk` request at a middle-of-file cursor is not
slower than one at the start (proves the index is actually being used,
not a scan).

## M2 — Frontend: naive fetch + render (no worker yet)

- [x] `fetchChunk` calls the real backend
- [x] Non-virtualized list renders chunk data on scroll

**Completion Note:** Naive React state list appending chunks of 200 lines, DOM node count grows dynamically on scroll (200 -> 400 -> 600+), causing noticeable rendering latency as it grows.

**Definition of done:** scrolls through the test dataset, visibly janky —
this is the intentional "before" baseline for M3.

## M3 — Move cache + fetch into a Web Worker, add LRU

- [x] Worker owns chunk fetch + cache — `logWorker.ts` (Map cache, unbounded), `useLogWorker.ts` hook; main thread postMessages only, zero direct chunk fetches
- [ ] Byte-budget LRU eviction (Map-based)
- [ ] Main thread only sends/receives postMessage; store holds view state only

**Definition of done:** record a scroll-while-fetching perf trace before
and after this milestone — the main thread should visibly stop blocking
on fetch/cache work.

## M4 — Local search over the cached window

- [ ] Worker searches its own cache synchronously on query input

**Definition of done:** search over already-loaded lines returns with no
network call.

## M5 — Backend bounded/resumable search + escalation

- [ ] `GET /logs/:id/search?q&cursor&budgetMs` — bounded scan
- [ ] Frontend: on local cache miss, escalate to this endpoint
- [ ] On match, jump viewport + prefetch matched chunk + surrounding context

**Definition of done:** a search for a term far from the current viewport
does not trigger a chain of sequential `chunk` calls — one resumable
`search` call (or a small bounded number) gets there.

## M6 — Filters (level, time range)

- [ ] `GET /logs/:id/filter?level&from&to&cursor` — same cursor contract

**Definition of done:** filter pagination reuses the same cursor pattern
as chunk/search, not a new one.

## M7 — Scale test

- [ ] Move to a multi-GB loghub dataset (or replicate to a target size)
- [ ] Re-profile: index build time, index size vs file size, cache hit
      rate, memory during ingestion

**Definition of done:** numbers recorded somewhere (even just as notes in
this file) — this milestone is about observing, not building.

## Stretch (do not start until M1–M7 are done)

- [ ] SharedArrayBuffer for the numeric offset index + COOP/COEP
- [ ] Live tail via SSE/WebSocket
- [ ] Regex search
