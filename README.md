# Log Explorer

Log Explorer is a high-performance log viewer designed to stream and render massive log files smoothly. It achieves this by using a byte-offset index on a Node.js backend to allow fast random-access chunking, and a Web Worker-owned cache on the React frontend to keep rendering lightweight and virtualization-friendly.

## Milestones

See [MILESTONES.md](MILESTONES.md)

## Dataset Source

We use datasets from [Loghub](https://github.com/logpai/loghub) for ingestion and testing of massive log files.
