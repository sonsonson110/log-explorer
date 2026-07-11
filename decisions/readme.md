# Decision Log

Append-only. Each decision gets its own file, numbered sequentially.
Once written, an entry is not edited except to change its `Status`
(e.g. to `Superseded by ADR-000X`) — corrections happen as a new entry,
not a rewrite of history.

| # | Decision | Status | Milestone |
|---|---|---|---|
| [0001](0001-cursor-is-line-number.md) | Cursor is `line_no`, not a byte offset | Accepted | M1 |
| [0002](0002-worker-owns-chunk-cache.md) | Web Worker owns the chunk cache + local search, not the store | Accepted | M3 |

To add one: copy `TEMPLATE.md`, number it next in sequence, fill in
Context / Decision / Alternatives. Leave `Outcome` as "Not yet measured"
until the related milestone is actually done — then come back and fill
it in with what changed.
