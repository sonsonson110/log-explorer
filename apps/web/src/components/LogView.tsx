import { useEffect, useState, useRef, useCallback } from "react";
import clsx from "clsx";
import { useViewerStore } from "../store/viewerStore.ts";
import { fetchMeta } from "../api/client.ts";
import { useLogWorker } from "../hooks/useLogWorker.ts";
import type { MetaResponse } from "contracts";

const CHUNK_SIZE = 200;

// ============================================================================
// Pure Utility Functions
// ============================================================================

function getLogLevel(
  line: string,
): "error" | "warn" | "info" | "notice" | "debug" | "none" {
  const lower = line.toLowerCase();
  if (
    lower.includes("[error]") ||
    lower.includes(" error ") ||
    lower.includes("critical") ||
    lower.includes("fatal")
  ) {
    return "error";
  }
  if (
    lower.includes("[warn]") ||
    lower.includes("[warning]") ||
    lower.includes(" warn ") ||
    lower.includes(" warning ")
  ) {
    return "warn";
  }
  if (lower.includes("[info]") || lower.includes(" info ")) {
    return "info";
  }
  if (lower.includes("[notice]") || lower.includes(" notice ")) {
    return "notice";
  }
  if (lower.includes("[debug]") || lower.includes(" debug ")) {
    return "debug";
  }
  return "none";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatTimestamp(unixSeconds: number | null): string {
  if (unixSeconds === null) return "N/A";
  return new Date(unixSeconds * 1000).toLocaleString();
}

// ============================================================================
// Layout Subcomponents
// ============================================================================

interface LogViewHeaderProps {
  meta: MetaResponse | null;
  status: string;
  totalLines: number | null;
}

function LogViewHeader({ meta, status, totalLines }: LogViewHeaderProps) {
  return (
    <div
      className={clsx(
        "log-view-header",
        "flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-zinc-800 text-xs text-zinc-400 select-none font-sans",
      )}
    >
      <div className="flex items-center gap-4">
        <div className={clsx("log-header-field", "flex flex-col")}>
          <span className="label-text">Dataset</span>
          <span className="value-text">Apache Log</span>
        </div>
        {meta && (
          <>
            <div className="h-6 w-px bg-zinc-800" />
            <div className={clsx("log-header-field", "flex flex-col")}>
              <span className="label-text">Size</span>
              <span className="value-text">
                {formatBytes(meta.fileSizeBytes)}
              </span>
            </div>
            <div className="h-6 w-px bg-zinc-800" />
            <div className={clsx("log-header-field", "flex flex-col")}>
              <span className="label-text">Total Lines</span>
              <span className="value-text">
                {totalLines?.toLocaleString() ?? "Counting..."}
              </span>
            </div>
            <div className="h-6 w-px bg-zinc-800" />
            <div
              className={clsx(
                "log-header-field",
                "flex flex-col hidden sm:flex",
              )}
            >
              <span className="label-text">Time Range</span>
              <span className="value-text">
                {formatTimestamp(meta.minTimestamp)} —{" "}
                {formatTimestamp(meta.maxTimestamp)}
              </span>
            </div>
          </>
        )}
      </div>
      <div>
        <span
          className={clsx(
            "log-badge",
            "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border leading-none scale-90 select-none font-sans",
            status === "idle" && "bg-zinc-900 text-zinc-400 border-zinc-800",
            status === "loading" &&
              "bg-zinc-800 text-zinc-100 border-zinc-700 animate-pulse",
            status === "error" && "bg-zinc-900 text-red-500 border-red-900/50",
          )}
        >
          {status}
        </span>
      </div>
    </div>
  );
}

interface LogViewRowProps {
  line: string;
  index: number;
}

function LogViewRow({ line, index }: LogViewRowProps) {
  const level = getLogLevel(line);
  return (
    <div
      className={clsx(
        "log-view-row",
        "flex border-b border-zinc-950 hover:bg-zinc-900/40 text-xs",
        level === "error" && "bg-rose-950/10 text-rose-200/95",
        level === "warn" && "bg-amber-950/10 text-amber-200/95",
        level === "info" && "text-zinc-300",
        level === "notice" && "text-sky-300",
        level === "debug" && "text-zinc-500",
      )}
    >
      {/* Gutter */}
      <div
        className={clsx(
          "log-view-line-gutter",
          "text-zinc-650 text-zinc-600 text-right pr-3 select-none w-16 min-w-[4rem] border-r border-zinc-900 bg-zinc-950/60 shrink-0 font-mono",
        )}
      >
        {index + 1}
      </div>

      {/* Optional level badge */}
      {level !== "none" && (
        <div
          className={clsx(
            "log-view-level-badge",
            "flex items-center justify-center pl-2 select-none shrink-0 font-sans",
          )}
        >
          <span
            className={clsx(
              "log-badge",
              "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border leading-none scale-90 select-none",
              level === "error" &&
                "bg-rose-950/30 text-rose-400 border-rose-900/30",
              level === "warn" &&
                "bg-amber-950/30 text-amber-400 border-amber-900/30",
              level === "info" && "bg-zinc-900 text-zinc-400 border-zinc-800",
              level === "notice" &&
                "bg-sky-950/30 text-sky-400 border-sky-900/30",
              level === "debug" && "bg-zinc-950 text-zinc-650 border-zinc-900",
            )}
          >
            {level}
          </span>
        </div>
      )}

      {/* Log Line text */}
      <pre
        className={clsx(
          "log-view-line-text",
          "flex-1 pl-3 pr-4 py-0.5 m-0 font-mono text-xs whitespace-pre overflow-visible select-text",
        )}
      >
        {line}
      </pre>
    </div>
  );
}

function LogViewFooter({ count }: { count: number }) {
  return (
    <div
      className={clsx(
        "log-view-footer",
        "flex justify-between items-center px-4 py-1.5 bg-zinc-950 border-t border-zinc-800 text-[10px] text-zinc-500 select-none font-sans",
      )}
    >
      <span>Rendered: {count.toLocaleString()} lines</span>
      <span>Milestone 3 — Worker Cache</span>
    </div>
  );
}

// ============================================================================
// Main Exported Component
// ============================================================================

export default function LogView() {
  const {
    status,
    hasMore,
    totalLines,
    errorMessage,
    setStatus,
    setCursor,
    setTotalLines,
    setError,
  } = useViewerStore();

  const [lines, setLines] = useState<string[]>([]);
  const [meta, setMeta] = useState<MetaResponse | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelElementRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ─── Worker callbacks ──────────────────────────────────────────────────────

  const handleChunk = useCallback(
    (payload: {
      lines: string[];
      nextCursor: string | null;
      hasMore: boolean;
    }) => {
      setLines((prev) => [...prev, ...payload.lines]);
      setCursor(payload.nextCursor, payload.hasMore);
      setStatus("idle");
    },
    [setCursor, setStatus],
  );

  const handleWorkerError = useCallback(
    (payload: { message: string }) => {
      console.error("[LogView] worker error:", payload.message);
      setError(payload.message || "Worker failed to load chunk");
    },
    [setError],
  );

  const { requestChunk } = useLogWorker({
    onChunk: handleChunk,
    onError: handleWorkerError,
  });

  // ─── Initialization: meta (main thread) + first chunk (worker) ────────────

  useEffect(() => {
    let active = true;

    async function initialize() {
      setStatus("loading");
      setError(null);
      try {
        // fetchMeta is a one-shot startup call — stays on the main thread.
        const metadata = await fetchMeta();
        if (!active) return;
        setMeta(metadata);
        if (metadata.totalLines !== null) {
          setTotalLines(metadata.totalLines);
        }
        // First chunk is fetched by the worker.
        requestChunk("1", CHUNK_SIZE);
      } catch (err: unknown) {
        if (!active) return;
        console.error("Initialization error:", err);
        const message =
          err instanceof Error
            ? err.message
            : "Failed to initialize log viewer";
        setError(message);
      }
    }

    initialize();

    return () => {
      active = false;
    };
    // requestChunk is stable (useCallback with no deps), so it is safe here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Load next chunk via worker ───────────────────────────────────────────

  // Reads live store state so this callback is stable and does not need to be
  // recreated on every status transition.
  const loadNextChunk = useCallback(() => {
    const { cursor, hasMore, status } = useViewerStore.getState();
    if (!cursor || !hasMore || status === "loading") return;
    setStatus("loading");
    requestChunk(cursor, CHUNK_SIZE);
  }, [requestChunk, setStatus]);

  // ─── Intersection observer for infinite scroll ────────────────────────────

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const { hasMore, status } = useViewerStore.getState();
        if (entries[0].isIntersecting && hasMore && status === "idle") {
          loadNextChunk();
        }
      },
      {
        root: containerRef.current,
        rootMargin: "100px",
      },
    );

    const sentinel = sentinelElementRef.current;
    if (sentinel) {
      observerRef.current.observe(sentinel);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadNextChunk]);

  return (
    <div
      className={clsx(
        "log-view",
        "flex flex-col h-[calc(100vh-10rem)] bg-zinc-950 border border-zinc-800 rounded overflow-hidden",
      )}
    >
      <LogViewHeader meta={meta} status={status} totalLines={totalLines} />

      {/* Main Logs List Container */}
      <div
        ref={containerRef}
        className={clsx(
          "log-view-scroll-container",
          "flex-1 overflow-y-auto font-mono bg-zinc-950",
        )}
      >
        {errorMessage && (
          <div
            className={clsx(
              "log-view-error-panel",
              "p-4 m-4 bg-zinc-900 border border-zinc-850 rounded text-red-400 text-xs",
            )}
          >
            <h3 className="font-bold mb-1">Error Loading Logs</h3>
            <p className="text-zinc-400 mb-2">{errorMessage}</p>
            <button
              onClick={() => {
                setStatus("idle");
                loadNextChunk();
              }}
              className={clsx(
                "log-view-retry-button",
                "px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-650 rounded text-zinc-100 transition-colors font-sans",
              )}
            >
              Retry Connection
            </button>
          </div>
        )}

        <div className="log-view-list min-w-max">
          {lines.map((line, index) => (
            <LogViewRow key={index} line={line} index={index} />
          ))}

          {/* Infinite Scroll Sentinel */}
          <div
            ref={sentinelElementRef}
            className={clsx(
              "log-view-sentinel",
              "h-10 flex items-center justify-center text-xs text-zinc-500 select-none font-sans",
            )}
          >
            {hasMore && status === "loading" && <span>Loading...</span>}
            {!hasMore && lines.length > 0 && <span>End of log file</span>}
          </div>
        </div>
      </div>

      <LogViewFooter count={lines.length} />
    </div>
  );
}
