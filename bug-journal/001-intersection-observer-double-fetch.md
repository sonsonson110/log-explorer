# Bug: IntersectionObserver Double-Fetch on Scroll-to-End

**Milestone:** M2 — Frontend naive fetch + render  
**File:** `apps/web/src/components/LogView.tsx`  
**Status:** Fixed

---

## Symptom

When scrolling to the bottom of the log view, two consecutive `GET /logs/:id/chunk`
requests (200 lines each) were fired back-to-back. The second request started
immediately after the first one resolved and status switched back to `idle`.

---

## Root Cause

The `useEffect` that created the `IntersectionObserver` had **`status` and `hasMore`
in its dependency array**:

```ts
// BAD — recreates the observer on every status change
useEffect(() => {
  observerRef.current = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMore && status === 'idle') {
      loadNextChunk();
    }
  }, { root: containerRef.current, rootMargin: '100px' });

  sentinelElementRef.current &&
    observerRef.current.observe(sentinelElementRef.current);

  return () => observerRef.current?.disconnect();
}, [loadNextChunk, hasMore, status]); // <-- status here is the problem
```

`loadNextChunk` also closed over `status`, `cursor`, and `hasMore` from the
component's render scope and listed them in `useCallback` deps — meaning every
`setStatus('loading')` call caused `loadNextChunk` to be a new function
reference, which in turn caused the observer `useEffect` to re-run.

### Failure Sequence

```
1. Sentinel scrolls into view
2. Observer callback fires → status is 'idle' → calls loadNextChunk()
3. loadNextChunk() → setStatus('loading')
   → status changes → useEffect re-runs
   → OLD observer torn down, NEW observer created
   → NEW observer immediately calls observe(sentinel)
   → sentinel is still intersecting, but status is 'loading' → no fetch (safe)

4. Fetch completes → setStatus('idle')
   → status changes AGAIN → useEffect re-runs AGAIN
   → observer torn down and recreated a second time
   → NEW observer calls observe(sentinel)
   → sentinel is STILL in view (new lines appended but scroll pos unchanged)
   → callback fires: status === 'idle' ✓, hasMore ✓ → SECOND fetch fires ✗
```

The bug is especially visible **at or near the end of the file** because the
last few chunks are small and may not push the sentinel out of the viewport,
so the re-created observer perpetually re-triggers.

---

## Fix

Read `status`, `hasMore`, and `cursor` from **`useViewerStore.getState()`** inside
the callbacks instead of closing over React state. This keeps both `loadNextChunk`
and the observer `useEffect` stable — neither needs to recreate on status changes.

```ts
// GOOD — callback reads live state; observer is created once
const loadNextChunk = useCallback(async () => {
  const { cursor, hasMore, status } = useViewerStore.getState(); // live read
  if (!cursor || !hasMore || status === 'loading') return;
  // ...
}, [setStatus, setCursor, setError]); // no status/cursor/hasMore in deps

useEffect(() => {
  observerRef.current = new IntersectionObserver((entries) => {
    const { hasMore, status } = useViewerStore.getState(); // live read
    if (entries[0].isIntersecting && hasMore && status === 'idle') {
      loadNextChunk();
    }
  }, { root: containerRef.current, rootMargin: '100px' });

  sentinelElementRef.current &&
    observerRef.current.observe(sentinelElementRef.current);

  return () => observerRef.current?.disconnect();
}, [loadNextChunk]); // stable — only recreates if loadNextChunk identity changes
```

> [!NOTE]
> `status` and `hasMore` are still subscribed via `useViewerStore()` at the
> component level for **UI rendering** (header badge, sentinel "Loading…" text).
> The fix only removes them from the *callback* closure / effect deps where they
> were causing re-creation side effects. Zustand's `getState()` is safe to call
> outside React's render cycle and always returns the latest committed value.

---

## General Pattern

Whenever an `IntersectionObserver` (or any persistent listener) is set up inside
a `useEffect` with rapidly-changing state in its deps, the observer risks being
torn down and immediately re-triggering on re-creation while the sentinel is
still visible. The safest pattern is:

- **Keep the effect deps minimal** — only what actually requires the observer to
  be rebuilt (e.g. the sentinel element ref changing).
- **Read volatile state at call time** — use a ref, a store's `getState()`, or
  a stable getter rather than closing over React state in the callback.
