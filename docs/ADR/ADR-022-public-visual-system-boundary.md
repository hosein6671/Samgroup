# ADR-022: The Public Visual-System Boundary — Flagship for the Public Site, `packages/ui` for Admin and Shared Primitives

## Status

**Accepted, 2 September 2026.** Drafted at the owner's instruction as step A of the public-frontend
UI refinement, Phase 1, and **explicitly approved by the owner on the same date**: _"the Flagship
dark-navy/brass system governs the public site; `packages/ui` remains the Admin/shared-primitives
system."_

The acceptance covers the Decision section below in full — §1 the public identity, §2 the
`packages/ui` boundary, §3 that this authorizes no redesign, and §4 the requirements binding public
UI changes. It does **not** reach anything §3 excludes; each of those still needs its own approval
([CLAUDE.md](../../CLAUDE.md) §4).

### Why this number and not ADR-021

`ADR-021` is **already spoken for**. It is referenced twice, as an open question, by the
privacy-policy drafting work:

- [`docs/legal/DRAFT-privacy-policy-REVIEW-ONLY.md`](../legal/DRAFT-privacy-policy-REVIEW-ONLY.md)
  — publication blocker 6: _"ADR-021 (revision binding) decided, so that the revision identifier at
  the top of this document and `ACTIVE_PRIVACY_POLICY_REVISION` cannot drift."_
- [`docs/legal/OWNER-QUESTIONNAIRE-privacy-policy.md`](../legal/OWNER-QUESTIONNAIRE-privacy-policy.md)
  — question 21.

No `ADR-021-*.md` file exists yet, so the index's highest entry is ADR-020 and 021 _looks_ free. It
is not: taking it would silently renumber a decision two other documents already cite by name. This
ADR therefore takes **022** and leaves 021 reserved for the policy-revision binding decision.

---

## Context

Two visual systems are live in this repository, and until now nothing recorded which surface each
one governs.

**The documented system** is [`docs/design/DESIGN_SYSTEM.md`](../design/DESIGN_SYSTEM.md),
implemented in `packages/ui/src/tokens/*.ts` and generated into
`packages/ui/src/tokens/theme.generated.css`. Its recorded decisions include:

- **light-first** — warm platinum canvas, midnight as a selective section treatment (§2);
- **`sam-blue-500` `#0a4a80` as the single identity and interaction colour** (§3.1);
- **brass/gold as the scarcest element**, explicitly _never_ a call to action, never interactive,
  "at most once per viewport" (§3.4);
- 12px radii, Inter 600 display weights.

**The shipping public system** is the Flagship, implemented in
`apps/web/src/features/home/flagship.css` and scoped to `[data-brand="flagship"]`. It is
**dark-first navy with brass/gold as the interactive colour**, 18/26px radii, and Inter Tight
300–500 display weights. Every public page template mounts it, and the six page-level stylesheets
(`about.css`, `products.css`, `category.css`, `quality.css`, `solutions.css`, `export-logistics.css`,
`insights.css`, `legal.css`, `contact.css`, `finder.css`, `product-detail.css`, `product-list.css`)
are written in its `.fs-*` vocabulary.

That file's own header comment already states the conflict plainly and, correctly, declined to
resolve it unilaterally:

> If the flagship palette becomes the platform brand, that is an ADR and a token migration in
> `packages/ui/src/tokens/color.ts` — not this file quietly winning by being loaded last.

**This is that ADR — but not that migration.** The Flagship is not becoming the platform brand. It
is being recorded as the approved identity of one surface, the public site, with the documented
system keeping the surfaces it already serves.

### Why recording it matters now

The ambiguity has a measurable cost today, not merely a theoretical one. Because no boundary was
written down, page stylesheets have been reaching for token names that belong to neither system and
are defined by nothing — `--fs-wrap-max`, `--radius-pill`, `--font-size-sm`, `--font-size-base`,
`--space-2`, `--space-4`, `--color-border-subtle`, `--color-surface-elevated`. Each one silently
resolves to nothing (or to a hardcoded per-call-site fallback), which is how the Export & Logistics
locale-fallback note ended up full-bleed while three sibling pages using the same construction did
not. A boundary nobody wrote down is a boundary authors cannot check themselves against.

---

## Decision

### 1. The Flagship is the approved public-site identity

**Dark navy, brass/gold, restrained industrial.** `[data-brand="flagship"]` governs every public
route under `app/[locale]/**` and the design-proof tree. Its raw palette (`--fs-ink`, `--fs-navy`,
`--fs-gold`, …) and its semantic re-mapping of `--color-*` are the public site's colour system.

This is a **recording** of what already ships and what the owner has confirmed, not a new direction.

### 2. `packages/ui` remains the Admin and shared-primitives system

The light, `sam-blue` system documented in `DESIGN_SYSTEM.md` continues to govern:

- the **Admin Dashboard** at `app/(admin)/admin/*` and `features/admin/admin.css`;
- the **primitives** in `packages/ui/src/primitives/*`, which both surfaces mount;
- the **token substrate** — `theme.generated.css` defines the `--color-*`, `--text-*`,
  `--radius-*`, `--duration-*` and `--ease-*` _names_. The Flagship re-binds a subset of those
  names inside its scope; it does not replace the substrate.

`packages/ui/src/tokens/color.ts` is **not** migrated to the Flagship palette by this ADR, and
`sam-blue-500` is not changed. `DESIGN_SYSTEM.md` §2's light-first posture and §3.4's gold rule
remain true statements **about the Admin and shared-primitive surface**, and are no longer implied
claims about the public site.

### 3. This is a scope clarification, not authorization for a redesign

Accepting this ADR authorizes **no visual change to any page**. It does not approve:

- redesigning any public page, section or component;
- migrating `packages/ui` to the Flagship palette, or the reverse;
- changing `sam-blue-500`, the Flagship raw palette, or any brand colour;
- introducing an icon library, schematics, or new imagery;
- adding, removing or restructuring any page section;
- a dark mode for the Admin Dashboard, or a light mode for the public site.

Each of those remains a separate task with its own approval.

### 4. Requirements binding every public UI change

Any change to a public-site surface, from this point, must:

1. **Use semantic Flagship tokens.** A component references `--color-text-primary`,
   `--color-accent-default`, `--color-border-hairline` and the `--fs-*` layout and type tokens —
   never a raw hex, a raw px type size, or a raw duration. A literal value in a page stylesheet is a
   defect, not a shortcut (`DESIGN_SYSTEM.md` §12, `CODING_STANDARDS.md`).
2. **Reference only tokens that exist.** A `var()` whose name is defined nowhere is a defect even
   when a per-call-site fallback hides it, because the fallback is a second definition that drifts.
3. **Meet WCAG 2.2 AA.** 4.5:1 for normal text, 3:1 for large text and for non-text UI components
   and boundaries (1.4.11), a visible `:focus-visible` indicator, and target sizes per 2.5.8 —
   whose Level AA minimum is **24×24 CSS px**, not 44. (44×44 is 2.5.5 Target Size (Enhanced),
   Level AAA. Comfortable 44px targets are welcome; citing them as the AA floor is wrong and has
   been corrected in `packages/ui/src/primitives/button.tsx`.)
4. **Work in RTL.** Logical properties (`inline-size`, `padding-inline`, `inset-inline`) rather than
   physical ones; directional motion sign-flipped; no mirrored stylesheet. `fa` and `ar` are launch
   locales.
5. **Honour reduced motion.** `prefers-reduced-motion: reduce` is a floor enforced at token level;
   content is legible at full opacity before anything animates.
6. **Keep no type role below 12px.** `DESIGN_SYSTEM.md` §7.1's "No role renders below 12px" and
   §7.2's technical-register floor apply to the public site as well. Technical text and form labels
   at 8–10px are defects.

---

## Consequences

**Positive**

- **The conflict is recorded rather than latent.** `DESIGN_SYSTEM.md` and `flagship.css` no longer
  read as two systems each claiming the whole platform; each has a named surface.
- **`flagship.css`'s own condition is satisfied.** Its header comment asked for an ADR before the
  Flagship's status could be treated as settled. It now has one — and one that explicitly withholds
  the token migration it warned against.
- **Undefined-token drift becomes checkable.** §4.2 makes "this `var()` resolves to nothing" a
  stated defect class rather than a matter of taste, which is what lets it be found and fixed.
- **The 12px floor becomes enforceable on the public site**, where it was previously only a claim in
  a document governing the other surface.
- **Neither system had to be rewritten to get here**, and no published page changes appearance
  because of this ADR.

**Negative / trade-off**

- **Two colour systems are now sanctioned rather than merely tolerated.** That is a real ongoing
  cost: a primitive must keep working under both bindings, and every new semantic token has to be
  defined in both contexts or deliberately scoped to one.
- **`DESIGN_SYSTEM.md` is now partly a document about a surface most readers will never see.** Its
  §1–§4 positioning argument was written for the public site and now formally governs the Admin
  Dashboard. Rewriting it is deferred, not done; §3 of the update to that file marks the boundary
  rather than re-authoring the reasoning.
- **The gold rule is now surface-dependent.** `DESIGN_SYSTEM.md` §3.4 forbids gold as a call to
  action; the Flagship makes gold _the_ call to action. Both are correct in their own surface, and
  anyone reading only one document will get the wrong answer for the other. The cross-reference
  added to `DESIGN_SYSTEM.md` is the mitigation, not a fix.
- **This ADR does not decide the endgame.** Whether the platform eventually converges on one system
  — and if so which — is left open. It is a real decision that is being deferred, and deferring it
  keeps two systems alive for as long as it takes.

---

## Alternatives Considered

- **Migrate `packages/ui` to the Flagship palette and delete the light system.** Rejected for now.
  It is the tidiest end state and may well be right eventually, but it is a token migration touching
  `color.ts`, the generated theme, the contrast audit, every Admin surface and every primitive — and
  the Admin Dashboard is a console, where the Flagship's dark editorial register is the wrong
  language (`admin.css`'s own header comment argues this at length). Doing it as a side effect of
  writing down a boundary is exactly the pattern CLAUDE.md §4 warns against.
- **Migrate the public site to the documented light system.** Rejected. It discards the approved,
  shipping, owner-confirmed Flagship identity to satisfy a document, and would be a full redesign of
  every public page — the one thing this phase is explicitly not.
- **Record nothing and let `flagship.css`'s scoping speak for itself.** Rejected. The scoping is a
  mechanism, not a decision; it says _how_ the two coexist and nothing about _which governs what_.
  The undefined-token drift in §Context is what that silence already cost.
- **Split the two systems into separate packages.** Rejected as premature. The Flagship is a
  re-binding of the substrate's semantic names, not an independent token set, and extracting it
  would duplicate the substrate to serve a boundary that one attribute selector already enforces.
- **Take ADR-021.** Rejected — see Status. Two live documents cite ADR-021 by number for a different,
  still-open decision.
