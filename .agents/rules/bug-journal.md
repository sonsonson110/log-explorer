---
trigger: always_on
---

# Bug Journal — Documentation Rule

## When to document a bug

After fixing any bug that meets **one or more** of these criteria:

- Caused incorrect or duplicate network requests
- Involved a subtle React or browser API misuse (e.g. stale closures, effect
  dep cycles, observer lifecycle, event listener leaks)
- Took non-trivial analysis to diagnose (more than a one-line fix)
- Could plausibly recur in a different part of the codebase

If unsure, err on the side of documenting. Ask the user: *"This seems worth
documenting — should I add a bug journal entry?"*

## Where to write it

`bug-journal/<NNN>-<short-slug>.md`

Number entries sequentially (`001`, `002`, …). Check the existing files to find
the next number. Use a short kebab-case slug that names the symptom or mechanism,
e.g. `001-intersection-observer-double-fetch.md`.

## Required template

Use **exactly** this structure (copy the headings and Note block verbatim):

```markdown
# Bug: <Title>

**Milestone:** <milestone name and number>  
**File:** `<primary file path>`  
**Status:** Fixed

---

## Symptom

<One short paragraph describing what the user observed — no root cause yet.>

---

## Root Cause

<Explain the mechanism. Include a "BAD" code block showing the problematic
pattern, with an inline comment marking the specific problem line.>

### Failure Sequence

<A numbered/indented plain-text trace of the exact event sequence that triggers
the bug. Be specific about what state changes, what re-runs, what fires.>

---

## Fix

<Explain the fix. Include a "GOOD" code block showing the corrected pattern.>

> [!NOTE]
> <Any important nuance — e.g. why some other usage of the same value is still
> correct, or what invariant the fix relies on.>

---

## General Pattern

<Two or three bullet points abstracting the lesson to a reusable rule that
applies beyond this specific bug.>
```

## What not to include

- Do not add reproduction steps that require running the app — the Failure
  Sequence section is sufficient.
- Do not include author, date, or git commit — that context lives in git history.
- Do not truncate the code blocks to save space; show enough to be self-contained.
