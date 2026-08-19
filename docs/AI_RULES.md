# AI Development Rules

General coding hygiene rules — apply once code exists. For project-specific behavioral rules, workflow conventions, frozen constraints, and known open threads, see [`/AI_CONTEXT.md`](../AI_CONTEXT.md) at the repo root.

## General Rules

- Always write production-ready code.
- Always use TypeScript strict mode.
- Never generate duplicated code.
- Follow Clean Architecture.
- Follow SOLID principles.
- Keep code modular.
- Security is the highest priority.
- Performance is the second priority.
- Maintain readability.

---

## Before Coding

- Understand the existing architecture.
- Read documentation before implementing new features.
- Explain the implementation plan before coding.

---

## During Coding

- Keep functions small.
- Keep files organized.
- Use meaningful names.
- Add comments only when necessary.
- Validate all inputs.
- Handle all errors.
- Never expose sensitive information.

---

## After Coding

- Review the code.
- Refactor if necessary.
- Check performance.
- Check security.
- Verify TypeScript types.

---

## Accessibility — part of every UI gate's Definition of Done

**Target: WCAG 2.2 AA.** Every gate that ships or changes a public-site or Admin UI surface must meet
it **within that gate**. A gate is not done because the feature works; it is done when the feature
works for someone using a keyboard, a screen reader, 200% zoom, or a phone.

At minimum, per gate: one `main` landmark and named `nav` landmarks; a coherent `h1`/`h2` hierarchy
and a page title that names the screen; complete keyboard operation with a logical focus order, a
visible `:focus-visible` indicator, no keyboard trap, no positive `tabindex` and no clickable
`<div>`; real semantics for real content (tables as tables, `<time dateTime>` for instants,
programmatically associated form labels); state carried by more than colour, icon or position;
measured contrast of 4.5:1 for normal text, 3:1 for large text and for interface components and
focus indicators; interactive targets of at least 24×24 CSS pixels; and no page-level horizontal
scrolling at mobile width or 200% zoom. New motion respects `prefers-reduced-motion`.

**A project-wide accessibility audit before launch is still planned, and is not a place to defer
this to.** An audit finds what a careful gate missed; it is not a queue for work nobody did.
Retrofitting semantics and contrast across a finished surface costs far more than getting them right
once, and until the audit happens the surface is shipped and in use.

Recorded 19 August 2026, when the Admin lead inbox gate froze this target for the Admin UI —
[frontend/FRONTEND_ARCHITECTURE.md §2c](./frontend/FRONTEND_ARCHITECTURE.md) is the worked example of
what meeting it looks like.
