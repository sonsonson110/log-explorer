---
description: Run this after a critical or non-obvious bug fix is confirmed working, before moving to the next task.
---

# Workflow: postmortem

1. Identify or create the Skill this bug belongs to under
   `.agents/skills/<pattern-name>/`. The `description` field must describe
   the *class* of future situation this applies to (component type, code
   shape, symptom) — not this specific bug — so it triggers by relevance
   match rather than needing to be remembered. Include explicit "when to
   use" / "when not to use" bullets to keep the trigger precise.

2. Write the full incident narrative (Symptom, Root Cause, Failure Sequence
   if there's a race/ordering element, Fix) to
   `.agents/skills/<pattern-name>/resources/<short-slug>.md`, bundled with
   the skill rather than in a separate docs tree. Link it from SKILL.md
   under a "Further reading" section. This keeps the audit-trail detail
   available on demand without it being loaded every time the skill fires.

3. Before creating a new Skill, check `.agents/skills/` for an existing one
   covering the same problem class. If one exists, merge the new lesson into
   its SKILL.md and add the incident to its `resources/` folder rather than
   creating a near-duplicate skill.

4. Do NOT add the fix to the always-on Rules file unless it's a universal,
   low-noise convention that should apply to every single task regardless of
   context (e.g. a formatting/styling convention). Narrow, situational lessons
   belong in Skills, not Rules — Rules are loaded every session and get noisy
   fast.

5. Confirm the skill name and incident file path with me before finalizing.