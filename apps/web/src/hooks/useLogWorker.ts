/**
 * useLogWorker.ts — custom hook that owns the log Web Worker lifecycle.
 *
 * Returns two stable request callbacks and lets callers register a single
 * onChunk / onError handler pair.  The hook deliberately does NOT wrap worker
 * communication in promises — postMessage is inherently async/event-based and
 * keeping that model visible is intentional for the learning goal of this
 * project.
 */

import { useEffect, useRef, useCallback } from "react";
import type { WorkerRequest, WorkerResponse } from "contracts";

export type ChunkReadyPayload = Extract<
  WorkerResponse,
  { type: "CHUNK_READY" }
>;
export type WorkerErrorPayload = Extract<WorkerResponse, { type: "ERROR" }>;

interface UseLogWorkerOptions {
  onChunk: (payload: ChunkReadyPayload) => void;
  onError: (payload: WorkerErrorPayload) => void;
}

interface UseLogWorkerReturn {
  /** Ask the worker to fetch (or return from cache) the chunk at `cursor`. */
  requestChunk: (cursor: string, limit: number) => void;
  /** Warm the cache for an upcoming cursor without triggering a render. */
  prefetch: (cursor: string, limit: number) => void;
}

export function useLogWorker({
  onChunk,
  onError,
}: UseLogWorkerOptions): UseLogWorkerReturn {
  // Stable refs for callbacks so the message listener never needs to be
  // recreated when the parent component re-renders with new handler references.
  const onChunkRef = useRef(onChunk);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onChunkRef.current = onChunk;
  }, [onChunk]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const workerRef = useRef<Worker | null>(null);

  // Create the worker once on mount; terminate it on unmount.
  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/logWorker.ts", import.meta.url),
      { type: "module" },
    );

    worker.addEventListener(
      "message",
      (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.type === "CHUNK_READY") {
          onChunkRef.current(msg);
        } else if (msg.type === "ERROR") {
          onErrorRef.current(msg);
        }
      },
    );

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []); // intentionally empty — worker is created once

  const requestChunk = useCallback((cursor: string, limit: number) => {
    const msg: WorkerRequest = { type: "FETCH_CHUNK", cursor, limit };
    workerRef.current?.postMessage(msg);
  }, []);

  const prefetch = useCallback((cursor: string, limit: number) => {
    const msg: WorkerRequest = { type: "PREFETCH", cursor, limit };
    workerRef.current?.postMessage(msg);
  }, []);

  return { requestChunk, prefetch };
}
