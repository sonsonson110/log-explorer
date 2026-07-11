---
trigger: model_decision
description: Apply to all React/TSX component work in this repo. Follow them by default — don't wait to be asked.
---

# Frontend Component & Styling Rules

## 1. Styling: Tailwind + clsx

- Use TailwindCSS utility classes for styling.
- Every component's key elements carry a semantic, component-specific class name (e.g. `log-view-row`, `app-header`) for readability/selectability — in addition to utility classes.
- Combine them with `clsx`, passing the semantic name and the utility classes as **separate arguments**. Never merge them into one string.

```tsx
// Correct
<div className={clsx("log-view-row", "flex items-center gap-2 px-3 py-1")}>

// Wrong — identity and styling collapsed into one opaque string
<div className="log-view-row flex items-center gap-2 px-3 py-1">
```

## 2. Component Structure

- Pure utility/helper functions (formatting, parsing, calculations) live **outside** the component body — top of file or a shared `utils.ts`. Never redefine them per render.
- If a component is really several distinct parts (header + list + footer, etc.), split each part into its own internal sub-component in the same file. **Only the top-level composed component is exported.**
- Aim: no file mixes logic and layout so densely that it can't be scanned top-to-bottom. Maintainability over strict logic/layout file separation — co-location in one file is fine as long as it's decomposed into sub-components.

## 3. Visual Restraint

- Default palette is black/white/gray for structural UI: headers, panels, containers, footers.
- Custom color is only for semantic meaning (e.g. log severity levels) — not for decoration.
- Minimal border-radius, minimal shadow, no gradients. Use spacing, borders, and typography to create hierarchy and let the layout "breathe" — not visual effects.
- If in doubt, strip a style back rather than add one.

## 4. Utility Extraction Threshold

- Don't extract a Tailwind class combo into a shared class/`@utility` just because it exists once.
- Only extract when a pattern is **(a)** duplicated in multiple places already, **and** **(b)** genuinely likely to recur as a shared token (e.g. `label-text`, `value-text` typography styles) — not a one-off layout.
- Default to inline utility classes. Treat extraction as the exception, not the habit.
