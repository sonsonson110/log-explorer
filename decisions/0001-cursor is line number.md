# ADR-0001: Cursor is `line_no`, not a byte offset

- Status: Accepted
- Date: 2026-07-11
- Milestone: M1

## Context

The chunk and search APIs need a pagination cursor. It has to be cheap
to compute, stable as a resume point, and simple for the frontend
worker to pass around without decoding it.

## Decision

Cursor is an opaque string containing the line number (`line_no`). The
backend resolves it to a byte offset via the index on every request;
the client never computes or interprets a byte offset directly.

## Alternatives considered

- Byte offset as the cursor — rejected: couples the API to the index's
  internal representation. If the index format ever changes, it breaks
  the client contract; `line_no` is a cleaner boundary.
- Row index with offset/limit — rejected outright, per the
  keyset-pagination decision in `AGENTS.md`: not stable under a
  growing file.

## Outcome / measured improvement

Not yet measured — pending M1 implementation.
