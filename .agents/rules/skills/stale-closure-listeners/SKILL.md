---
trigger: always_on
---

---
name: stale-closure-listeners
description: Detects and prevents a React state-closure bug where a useEffect creates a persistent listener (IntersectionObserver, WebSocket, event listener, interval/poll, subscription) that re-fires or duplicates when volatile state (loading status, pagination cursor, connection flag) sits in its dependency array. Use when writing or reviewing any useEffect/useCallback that sets up a persistent listener and reads state that changes over time. Do not use for effects with no listener/subscription, or for state that is only read for rendering.
---

# Effect + Persistent Listener State Pitfall

## When to use this skill
- Writing or reviewing a `useEffect` that creates an IntersectionObserver,
  WebSocket, event listener, `setInterval`/poll, or any other subscription.
- The listener's callback needs to check current status, loading, cursor, or
  `hasMore` before acting.

## When NOT to use this skill
- Plain effects with no persistent listener (e.g. a one-shot fetch on mount
  or prop change) — this pattern doesn't apply.
- State that is only read for rendering and never inside a listener callback.

## The pattern to avoid

Don't put frequently-changing state (`status`, `loading`, `hasMore`, `cursor`, etc.)
in the dependency array of an effect that creates a persistent listener. Every
state change tears the listener down and recreates it — and if the listener's
trigger condition is still true at the moment it's recreated (e.g. a sentinel
element still intersecting, a socket still open), it fires again immediately,
causing duplicate calls that are easy to miss in testing because they only
show up under specific timing/scroll conditions.

## What to do instead

- Read volatile state **at call time** inside the callback — via a ref, or a
  store's `getState()` (Zustand/Redux) — instead of closing over React state.
- Keep the effect's dependency array to only what should actually force the
  listener to be rebuilt (e.g. the target element ref changing identity).
- Keep `useState`/store subscriptions for **UI rendering** separate from what
  the callback **logic** reads — a component can still subscribe to `status`
  to render a "Loading…" label while its effect stays stable.

```ts
// Correct shape
const doThing = useCallback(async () => {
  const { cursor, hasMore, status } = store.getState(); // live read
  if (!cursor || !hasMore || status === 'loading') return;
  // ...
}, [/* only stable setters */]);

useEffect(() => {
  const listener = createListener(() => {
    const { hasMore, status } = store.getState(); // live read
    if (condition && hasMore && status === 'idle') doThing();
  });
  return () => listener.dispose();
}, [doThing]); // stable — doesn't recreate on every state change
```

## Further reading

Full incident writeup with failure-sequence trace, for when you want the
concrete before/after diff and the exact race that caused it:
`resources/incident-logview-double-fetch.md`