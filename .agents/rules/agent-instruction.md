---
trigger: always_on
---

# Log Explorer — Agent Instructions

## What this project is
A learning project: render and process huge log files smoothly in the
browser using a Web Worker, backed by a Node backend that serves
byte-offset-indexed chunks. The goal is to *feel* the tradeoffs of
large-data handling on both frontend and backend — not to ship a
polished product.

## Read this first, every session
1. Read `MILESTONES.md`. Find the first unchecked item — that is the
   current task. Don't start a later milestone because it looks quick,
   and don't silently redo one that's already checked.
2. Check the actual code against what `MILESTONES.md` claims is done —
   the file can drift from reality. If they disagree, trust the code,
   tell me about the mismatch, and correct the checklist before
   proceeding.
3. Work only on the current milestone unless I explicitly say otherwise.

## After implementing a milestone (or a meaningful chunk of one)
- Verify it against that milestone's "Definition of done" in
  `MILESTONES.md` — actually run it, don't infer from the code compiling.
- If it passes: check the box, add a one-line note of what was actually
  built (e.g. "dense per-line index, ~40s for 300MB file" — not just
  "done").
- If it partially passes: leave it unchecked, note what's missing.

## Explicit scope — do not add without asking
**OUT for now:** auth, multi-user, UI polish/theming, live tail, log
parsing / anomaly detection, sharding, compression, deployment/CI.
**IN:** everything listed in `MILESTONES.md`.
If a task seems to need something from the OUT list, stop and ask
instead of quietly working around it.

## Fixed decisions — do not silently change these
- Cursor format: opaque string = `line_no`. Not byte offset, not row index.
- Pagination: keyset (cursor + limit), never offset/limit.
- Index: dense — every line indexed, not sparse. Revisit only after
  measuring that index size/build time is an actual problem, not
  preemptively.
- The Web Worker owns the chunk cache and local search index. The
  main-thread store (Zustand) holds only thin view state: viewport,
  query, status. Never put raw log records in the store.
- LRU eviction is byte-budget based, not a fixed chunk count.
- Search: scan the local cache first; on miss, escalate to the backend
  `/search` endpoint using the bounded/resumable pattern
  (`{ matches, scannedTo, hasMore }`). Never loop `chunk` calls to walk
  toward a distant match.

## Repo structure
```
apps/web             Vite + React + TS + Zustand
apps/server-node     Node + Fastify + better-sqlite3
packages/contracts   shared TS types for the API + worker protocol
data/                gitignored — loghub files; never read
                     whole file content, only peak the check the structure.
db/                  Built index, stored in sqlite db file
```

## Stack constraints
- Backend: Node + TypeScript + Fastify + better-sqlite3. No ORM.
- Frontend: Vite + React + TypeScript + Zustand. No additional state library.
- No new dependency without a one-line reason in the commit message.

## Working style for this project
- I'm using this to learn, not just to ship. Explain the approach before
  large changes, especially around indexing and worker/cache logic —
  that reasoning is the actual point of the project.
- Don't run indexing against multi-GB files without telling me first —
  it's slow and I want to watch it happen.
- Keep changes scoped to one milestone per session unless told otherwise.