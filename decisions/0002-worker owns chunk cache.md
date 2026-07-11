# ADR-0002: Web Worker owns the chunk cache and local search index

- Status: Accepted
- Date: 2026-07-11
- Milestone: M3

## Context

Log records need to live somewhere on the client between fetches.
Redux/Zustand stores aren't reachable from a worker's isolated scope,
so whatever owns the cache has to live either in the store (main
thread) or in the worker.

## Decision

The worker owns the record cache and local search index, since it's
already doing the CPU-bound work (parsing, scanning). The main-thread
store only holds thin view state: viewport, query, status.

## Alternatives considered

- Cache in the Zustand store — rejected: keeps large data on the main
  thread, defeating the reason to use a worker at all.
- Cache in a plain main-thread variable outside the store — rejected:
  same problem, just without the store's structure.

## Outcome / measured improvement

Not yet measured — pending M3. Plan: compare a scroll-while-fetching
perf trace before/after this milestone (see M3's definition of done in
`MILESTONES.md`) and record the main-thread blocking time here once
available.
