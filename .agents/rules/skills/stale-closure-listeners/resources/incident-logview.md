---
trigger: always_on
---

# Incident: IntersectionObserver Double-Fetch on Scroll-to-End

**File:** `apps/web/src/components/LogView.tsx`
**Status:** Fixed

## Symptom

Scrolling to the bottom of the log view fired two consecutive
`GET /logs/:id/chunk` requests back-to-back. The second request started
immediately after the first resolved and status switched back to `idle`.

## Root Cause

The `useEffect` that created the `IntersectionObserver` had `status` and
`hasMore` in its dependency array. `loadNextChunk` also closed over `status`,
`cursor`, and `hasMore` and listed them in its `useCallback` deps — so every
`setStatus('loading')` call gave `loadNextChunk` a new identity, which
re-ran the observer effect.

## Failure Sequence

1. Sentinel scrolls into view; observer fires; `status === 'idle'` → calls
   `loadNextChunk()`.
2. `loadNextChunk()` sets status to `'loading'` → effect re-runs → old
   observer torn down, new one created and immediately observes the
   sentinel. Sentinel is still intersecting, but status is `'loading'`, so
   no fetch yet — looks safe.
3. Fetch completes, status returns to `'idle'` → effect re-runs *again* →
   observer torn down and recreated a second time, immediately observes the
   sentinel again. If the sentinel is still in view (new lines appended but
   scroll position unchanged — common near end-of-file where chunks are
   short), the callback fires with `status === 'idle'` and `hasMore` true →
   a second fetch goes out.

This is most visible near the end of the file because small trailing chunks
often don't push the sentinel out of the viewport, so the recreated observer
keeps re-triggering.

## Fix

Read `status`, `hasMore`, and `cursor` from the store's `getState()` inside
the callbacks instead of closing over React state, so neither
`loadNextChunk` nor the observer effect needs to recreate on status changes.
`status`/`hasMore` are still subscribed via the store hook at the component
level for **rendering** (header badge, "Loading…" text) — only the closures
used inside the effect/callback logic were changed to read live state
instead.