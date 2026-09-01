# SAM Group Platform — Design System

The resolved visual system, as built in `packages/ui` at Frontend Step A-2.

This is the **record of what was decided and why**. Its companion,
[FRONTEND_DESIGN_DIRECTION.md](./FRONTEND_DESIGN_DIRECTION.md), is the original brief — the
intent, written before anything existed. Where the two differ, this document is current: the
brief specified a register ("luxury industrial", "premium B2B") but no colour system, no
spacing, and no motion rules, and it named two typefaces that turned out to be commercially
licensed. Nothing here contradicts the brief's intent; it resolves it.

**Every value in this document is implemented and verified.** Contrast figures are measured,
not estimated. Token values are the ones in `packages/ui/src/tokens/*.ts`, which generate the
Tailwind theme — they are not a parallel description that can drift.

**Scope.** This is the design system: tokens, primitives, and the rules governing them. It is
not a page-by-page specification — that is [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) — and it
is not the frontend's technical architecture, which is
[frontend/FRONTEND_ARCHITECTURE.md](../frontend/FRONTEND_ARCHITECTURE.md).

> ### Which surface this document governs
>
> **This document governs the Admin Dashboard and the shared primitives — not the public site.**
> Recorded in [ADR-022](../ADR/ADR-022-public-visual-system-boundary.md).
>
> The public site ships the **Flagship** identity: dark navy, brass/gold, restrained industrial,
> implemented in `apps/web/src/features/home/flagship.css` under `[data-brand="flagship"]`. It
> re-binds this system's semantic token names inside its own scope; it does not replace them, and
> `packages/ui/src/tokens/*.ts` is untouched by it.
>
> Three decisions below are therefore **true of the Admin surface and not of the public site**, and
> reading either document alone gives the wrong answer for the other:
>
> | §                           | Says                                              | On the public site                                          |
> | --------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
> | §2 Light luxury first       | Warm white canvas; midnight is the exception      | Dark-first. Midnight is the dominant surface.               |
> | §3.1 Sam Blue               | `#0a4a80` is the identity and the only accent     | Brass/gold is the accent; `sam-blue` is not used.           |
> | §3.4 Brass — rare highlight | Gold is never a call to action, never interactive | Gold **is** the call to action, and the interactive colour. |
>
> Everything else here — the semantic-token discipline (§3.5), the specification-first posture (§6),
> the 12px type floor (§7.1, §7.2), the RTL divergences (§7.4), the motion principles (§8), the
> exclusions (§9) and the change rules (§12) — applies to **both** surfaces, and ADR-022 §4 restates
> the binding ones as requirements on public UI work.
>
> ADR-022 is a scope clarification. It authorizes no redesign of either surface, and no token
> migration in either direction.

---

## 1. Positioning

The experience should read as a **global industrial technology company**: a direct manufacturer
of petroleum, lubricant and petrochemical products selling to international B2B buyers who
evaluate on specification, certification and capability.

The failure mode to avoid is not "ugly". It is **generic** — specifically the two generic
outcomes this category defaults to:

| Not this                            | Because                                                                                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A generic petroleum company website | Stock rig photography, gradient-blue hero, three feature cards, "Global Excellence" headline. Indistinguishable from a trading intermediary — which is precisely what SAM Group is not. |
| A generic premium template          | Tasteful, spacious, restrained — and equally at home selling watches or SaaS. Premium alone is not a position.                                                                          |

What separates a manufacturer from a trader, visually, is **evidence**: measured values, named
test methods, certification references, and the typographic discipline to present them as
designed artefacts rather than as an afterthought. That principle drives §5 and §6 and is the
reason the system carries a specification primitive at all.

**Reference register:** the engineering-documentation side of Apple, Porsche and Siemens —
precise, measured, quietly confident. Not the consumer-marketing side of any of them.

---

## 2. Light luxury first

**The site is light.** Warm white is the default canvas across every page, and midnight is a
deliberate exception applied to specific sections (§4).

This is a decision, not a default. The category convention is permanent dark — it reads as
"technology" cheaply, and it makes specification tables, certification marks and long-form
technical copy harder to read for exactly the audience that reads them most carefully. A light
system carrying dark moments is both more legible and rarer in this market.

There is **no dark mode**. No `prefers-color-scheme` query, no theme toggle, no user
preference. Dark is a section treatment. This is enforced structurally: the semantic tokens are
remapped inside `[data-surface="midnight"]` blocks, so a section opts in and its descendants
follow automatically.

---

## 3. Colour

### 3.1 Sam Blue — the identity colour

`sam-blue-500` is **`#0a4a80`**, taken from the SAM Group logo mark. It is the brand's identity
colour and the system's only accent. The full ramp is derived from it by holding hue 207.5°
and moving lightness and saturation, so every step reads as one colour family rather than a
blue that merely resembles the logo.

| Step               | Value         | Role                                                     |
| ------------------ | ------------- | -------------------------------------------------------- |
| `sam-blue-50`      | `#f0f7fc`     | Muted accent fill (ghost hover)                          |
| `sam-blue-100`     | `#dcecf9`     |                                                          |
| `sam-blue-200`     | `#b9d9f4`     | Accent hover, midnight context                           |
| `sam-blue-300`     | `#81b9e9`     | Accent, midnight context                                 |
| `sam-blue-400`     | `#318cd8`     |                                                          |
| **`sam-blue-500`** | **`#0a4a80`** | **The logo colour. Identity and accent, light context.** |
| `sam-blue-600`     | `#073c69`     | Accent hover, light context                              |
| `sam-blue-700`     | `#043055`     |                                                          |
| `sam-blue-800`     | `#032440`     |                                                          |
| `sam-blue-900`     | `#01192d`     |                                                          |

**One blue.** The brand colour and the interactive colour are the same colour, so identity and
interaction reinforce each other rather than competing. An earlier draft carried a separate
"electric blue" accent; it was removed. Two blues need a written division of labour and blur
within a few pages anyway.

The logo blue sits at lightness 27%, dark enough to carry white text at **9.11:1**, so no
lightened or darkened substitute is needed on light surfaces. On midnight it steps up the same
ramp to `sam-blue-300` — the brand hue preserved, legibility restored.

> **Provenance.** `sam-blue-500` is currently **sampled from the supplied logo raster**, not
> read from a brand specification. An official vector, Pantone or CMYK definition supersedes
> it. Changing it is one constant in `packages/ui/src/tokens/color.ts` plus a token rebuild —
> nothing else in the codebase references a colour by name. The contrast audit must be re-run
> afterwards, because a lighter brand blue would not necessarily keep the headroom above.

### 3.2 Platinum — the neutrals

Warm, not grey. `platinum-50` (`#fbfaf8`) is the page canvas; the ramp runs to `platinum-900`
(`#2a2823`). Warmth is what keeps the system from reading as cold corporate tech, and it is
why elevation shadows are graphite-tinted rather than neutral black — a neutral shadow on a
warm canvas reads as dirt.

### 3.3 Midnight — a surface, never an identity

`midnight-500` … `midnight-950`, used **exclusively** for dark section surfaces.

Midnight is never an accent, never a border, never a brand colour, and never a substitute for
Sam Blue. It is a stage, not a voice. The two ramps are documented as non-interchangeable in
the token source specifically because "navy" and "brand blue" are the easiest pair in this
system to conflate.

### 3.4 Brass — the rare highlight

Gold is the system's scarcest element and carries a hard rule, because "rare premium gold"
becomes ordinary gold within two sprints without one.

**Gold marks provenance and verification.** Certification marks, standards compliance,
milestone numerals, founding dates.

**Gold is never:**

- a call to action, or any interactive element
- body copy, or any running text
- a background or a fill
- the sole carrier of meaning
- **near product names, grades, or commercial terms** — in this industry specifically, gold
  adjacent to product or price reads as "oil wealth" and is the single fastest route to the
  generic petroleum look §1 rejects

**At most once per viewport.**

### 3.5 Semantic tokens

Components reference **only** semantic tokens — `surface-canvas`, `text-primary`,
`accent-default`, `border-hairline`, `focus-ring`, `highlight-rare` — and never a colour name.
This is what made the `electric` → `sam-blue` rebrand a one-file change, and it is what will
make the next brand revision one too.

The full tier model (primitives → semantics → surface contexts) is documented in
`packages/ui/src/tokens/color.ts`.

### 3.6 Measured contrast

Verified by audit over the real token exports — 46 checks across both surface contexts,
**0 failures**. Selected results:

| Pair                          | Light   | Midnight |
| ----------------------------- | ------- | -------- |
| Primary text on canvas        | 17.68:1 | 17.95:1  |
| Secondary text on canvas      | 7.54:1  | 9.36:1   |
| Tertiary text on canvas       | 5.47:1  | 5.89:1   |
| Accent as text                | 8.74:1  | 8.96:1   |
| Label on accent fill          | 9.11:1  | 6.24:1   |
| Rare highlight (gold)         | 5.69:1  | 10.36:1  |
| Focus ring (UI, 3:1 floor)    | 8.74:1  | 8.96:1   |
| Strong border (UI, 3:1 floor) | 3.48:1  | 3.81:1   |

`border-strong` is `platinum-600` rather than a lighter, prettier step because it is the
boundary identifying the secondary button — WCAG 1.4.11 puts a 3:1 floor under it. The
midnight equivalent is white at 40% opacity for the same reason; at 22% it measured 1.88:1.

---

## 4. Midnight sections — cinematic, selective

Dark sections are **narrative punctuation**. They are reserved for:

- **R&D and innovation** — laboratory capability, formulation science
- **The final call to action** — the page's closing moment
- **Storytelling sequences** — manufacturing journey, export reach, brand narrative

A midnight section renders `gradient-midnight-depth`, a radial falloff rather than a flat fill,
because a large flat dark band reads as an empty box on a wide monitor.

**They are not for:** product specification pages, legal content, forms, list pages, or the
Admin Dashboard. If every third section is dark, none of them are cinematic.

Mechanically a section opts in with one prop; every descendant — buttons, labels, dividers,
glass panels — resolves correctly without knowing it is on a dark background, at zero
JavaScript cost.

---

## 5. Layout — the industrial editorial grid

### 5.1 Twelve columns, addressed by name

The grid is addressed by **named position**, not by counted spans. `col-md-6` describes
arithmetic; `half-start` and `margin-end` describe a place on a page. The difference matters
because editorial layouts are composed rather than calculated, and a named vocabulary stays
legible exactly when placements go asymmetric — which is when a span-counting API stops being
readable.

| Placement                                 | Columns                | Use                                                      |
| ----------------------------------------- | ---------------------- | -------------------------------------------------------- |
| `full`                                    | 1 / -1                 | Full-bleed imagery, cinematic bands                      |
| `wide`                                    | 2 / -2                 | Default for most editorial content                       |
| `main`                                    | 3 / 11                 | The main text block, inset to leave an annotation margin |
| `half-start` · `half-end`                 | 1 / 7 · 7 / -1         | Paired content                                           |
| `third-start` · `third-mid` · `third-end` | 1 / 5 · 5 / 9 · 9 / -1 | Three-part sequences                                     |
| `two-thirds-start` · `two-thirds-end`     | 1 / 9 · 5 / -1         | Asymmetric pairings                                      |
| **`margin-start` · `margin-end`**         | 1 / 3 · 11 / -1        | **Technical annotation**                                 |

**The margin tracks are the industrial part.** A narrow column running alongside the main
block for figure numbers, test methods, standards references and technical labels — the way a
specification sheet or an engineering drawing is set. They are the reason `main` starts at
track 3 rather than track 1, and the reason this is a grid rather than a two-column flexbox.

Below 768px the grid collapses to a single column in source order. A twelve-column grid on a
phone is arithmetic nobody can see.

Grid line numbers resolve against writing direction, so the same placements are correct in
Persian and Arabic with no mirrored stylesheet.

### 5.2 Vertical rhythm

Three section heights, fluid, owned exclusively by the `Section` primitive:

| Rhythm      | Value                      | Use                                  |
| ----------- | -------------------------- | ------------------------------------ |
| `compact`   | `clamp(3rem, 6vw, 6rem)`   | Dense sequences, supporting content  |
| `default`   | `clamp(5rem, 9vw, 10rem)`  | Most sections                        |
| `editorial` | `clamp(7rem, 13vw, 14rem)` | Storytelling moments, chapter breaks |

`Container` owns the horizontal axis and **never** sets vertical padding. One owner per axis
is what stops rhythm drifting across 27 pages.

### 5.3 Containers and measure

`narrow` 45rem · `default` 75rem · `wide` 90rem · `bleed` full · **reading measure 68ch**.

Long-form prose is constrained to the reading measure regardless of container width.

### 5.4 Responsive posture

**Designed and reviewed desktop-first** at a 1440px reference, because international B2B buyers
evaluate on desktop. **Implemented mobile-first** with min-width breakpoints, because that is
how the framework works and inverting it ships more CSS and degrades mobile.

Fluid `clamp()` tokens carry most of the scaling, so comparatively few breakpoints are needed.
A `3xl` breakpoint at 1800px exists for large-monitor editorial display.

---

## 6. Specification-first product storytelling

**Products are sold on evidence.** A grade is a set of measured values against named test
methods:

> Kinematic Viscosity @ 40°C · 46.0 mm²/s · ASTM D445

Presenting that as marketing prose, or as a row of feature cards, discards the single strongest
signal the company has. The system therefore treats specification data as a **designed
artefact** with its own primitive.

**Rules:**

1. **Measured values are presented, not paraphrased.** A number with its unit and its test
   method, not "excellent thermal stability".
2. **Numerals are tabular.** Columns of figures align. This is a token, applied by default to
   specification values and tables.
3. **Test methods and standards are visible**, in the technical register, subordinate to the
   value but never omitted. ASTM, ISO, API references are credibility.
4. **Certifications are first-class**, not a logo strip — a certification is a label and a
   standard reference, presented in the same structure as a measurement.
5. **Specification data is semantic.** It renders as a description list, so the label/value
   pairing is announced correctly to screen readers and the value reads with its unit as one
   quantity.
6. **Figures can be cinematic.** The same primitive renders at display scale for storytelling
   statistics — a capacity figure, a purity percentage — so a headline number and a spec row
   are one system, not two.

Specification content is **always** data from the catalog or CMS, mapped over. A hardcoded
specification is the same class of defect as a hardcoded translation string
([CODING_STANDARDS.md](../CODING_STANDARDS.md)).

---

## 7. Typography

### 7.1 Roles, not sizes

A component names `display-1`, never a pixel value or a utility size. Typographic role is
decoupled from HTML element, which is what allows a correct `h1 → h2 → h3` outline underneath
oversized editorial display type — the usual way premium layouts break their heading hierarchy.

| Role                        | Size                                                       | Character                                         |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `display-1`                 | `clamp(3rem, 6vw, 8.75rem)`                                | Oversized, tight tracking, leading below 1        |
| `display-2`                 | `clamp(2.5rem, 4.5vw, 5.5rem)`                             | Section-opening statements                        |
| `headline-1` · `headline-2` | `clamp(2rem, 3vw, 3.5rem)` · `clamp(1.5rem, 2vw, 2.25rem)` | Editorial headings                                |
| `title`                     | `clamp(1.125rem, 1.2vw, 1.5rem)`                           | Subsection headings                               |
| `body-lead`                 | `clamp(1.125rem, 1.1vw, 1.375rem)`                         | Introductory paragraphs                           |
| `body`                      | `1rem` / 1.65                                              | Reading text                                      |
| `caption`                   | `0.8125rem`                                                | Metadata, figure captions                         |
| **`technical`**             | `clamp(0.75rem, 0.5vw, 0.8125rem)`                         | **Uppercase, +0.12em tracking, tabular numerals** |

**No role renders below 12px.**

### 7.2 The technical register

`technical` is the system's engineering signal and the thing that most separates it from a
luxury fashion system. It carries section eyebrows, specification keys, test methods,
certification marks and figure numbers.

Its floor is 12px rather than the smallest size available, because it carries the densest
information to the audience least likely to be reading in a first language.

### 7.3 Typefaces

**Inter**, self-hosted, Latin subset. The original brief also named Neue Haas Grotesk and
Helvetica Neue; both are commercially licensed and **not procured**. The family is a token, so
substituting a licensed grotesque later is a one-line change, not a rewrite.

### 7.4 RTL

Persian and Arabic are launch locales ([i18n strategy](../i18n/INTERNATIONALIZATION_STRATEGY.md)),
and the system carries three RTL divergences that are not merely mirrored layout:

1. **Leading increases** across every role — deeper descenders and diacritics.
2. **`technical` changes in kind, not degree.** Arabic script has no letter case, and positive
   tracking breaks cursive joining. The RTL form drops uppercase and tracking entirely; weight
   carries the emphasis. This is why the technical label is its own primitive.
3. **Font families are locale-gated at load.** Latin faces are never sent to `fa`/`ar` routes.

> **Open — the RTL typeface pairing is not decided.** Inter has no Arabic or Persian coverage.
> A provisional system fallback is in place so text renders rather than showing tofu; it is not
> a brand decision and must not be treated as one. Tracked in
> [INTERNATIONALIZATION_STRATEGY.md](../i18n/INTERNATIONALIZATION_STRATEGY.md).

---

## 8. Motion

### 8.1 Principles

- **Motion expresses cause, never decoration.** If an animation does not clarify a relationship
  or a change of state, it is removed.
- **Content is never dependent on motion.** Everything is in the DOM and legible at full
  opacity before anything animates — required for crawlers and assistive technology, and true
  in every browser regardless of support.
- **Four reveal patterns, and only four.** Applied consistently they read as designed; a dozen
  ad-hoc ones read as busy.
- **Reduced motion is a floor, not a feature.** Enforced at token level site-wide, including in
  components whose authors never checked.
- **Compositor only.** Transform and opacity. Never width, height or position.

### 8.2 The four patterns

| Pattern         | What it does                               | Use                                                                                                                              |
| --------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `fade-rise`     | Opacity with a 1rem lift                   | Text blocks, figures — the default                                                                                               |
| `mask-wipe`     | Clip-path uncovering from the leading edge | Imagery and panels, where a fade reads cheap and a wipe reads deliberate                                                         |
| `hairline-draw` | A rule scaling from its leading edge       | The most characteristic pattern — precise lines arriving under their own power is most of what makes a layout read as engineered |
| `stagger`       | Group sequence on a shared timeline        | Lists and grids; driven by one scroll position so it reads as a sequence, not as noise                                           |

### 8.3 Timing

Durations: `instant` 80ms · `fast` 160ms · `base` 240ms · `slow` 400ms · `editorial` 700ms ·
`reveal` 900ms. Four easing curves, with `entrance` and `editorial` reserved for reveals.

### 8.4 Implementation posture

Reveals are **scroll-driven CSS** — no IntersectionObserver, no animation library, **no
JavaScript**, nothing added to the first-load budget. Where the browser does not support
scroll-driven animation, content renders in its final state and no animation runs.

Framer Motion remains the choice for component-level interaction when a page actually needs it,
and GSAP + ScrollTrigger stay reserved for the two content-driven scroll sequences named in
[FRONTEND_ARCHITECTURE.md](../frontend/FRONTEND_ARCHITECTURE.md) §8. Neither is a dependency of
the design system.

**Directional motion is direction-aware.** Transforms sign-flip under RTL via a token, and the
two directional reveal patterns carry mirrored definitions.

---

## 9. What this system is not

Stated explicitly, because these are the defaults a design system drifts toward:

| Not built                | Why                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A card system**        | No `Card` primitive exists and none should. A shared card is the single component that would flatten 27 bespoke pages into one template. Sections compose their own containers.                  |
| **A component kit**      | No `Badge`, `Accordion`, `Tabs`, `Modal`, or generic list components. `packages/ui` is a systems library — layout, surface, typography, data. Visual personality lives in the page compositions. |
| **A layout kit**         | No `Row`/`Col`, no `Stack`, no `span={6}`. The editorial grid is addressed by name (§5.1).                                                                                                       |
| **A dashboard language** | Density, data tables and control-heavy chrome belong to the Admin Dashboard as a surface, not to the public site's visual system.                                                                |
| **A page builder**       | Layout is code; editorial content is CMS. Repeating content is always a CMS array rendered by `.map()` — never hardcoded, never a generic block renderer.                                        |
| **A dark mode**          | §2.                                                                                                                                                                                              |

---

## 10. Media and photography

**The system must carry the page without photography.** Launch imagery is an open content
dependency ([ROADMAP.md](../ROADMAP.md) M5) and may not exist at go-live. Four layers, in order
of load-bearing:

1. **Editorial typography** — oversized display type as the primary visual, not decoration over
   a photo. Works with zero assets.
2. **Technical SVG** — process diagrams, specification visualisations, schematics. Sharp, tiny,
   crawlable, and theme-aware for free.
3. **Industrial gradients and surfaces** — platinum sheen, midnight depth, glass panels. Zero
   payload.
4. **Photography slots** — defined aspect ratios (`3/2` editorial, `4/5` portrait, `21/9`
   cinematic, `1/1` technical) with an empty state that reads as intentional rather than
   broken, and zero layout shift when the real asset arrives.

**No stock imagery.** A generic rig or refinery photograph actively signals the trading
intermediary position §1 rejects. Real facility, product and process photography, or none.

---

## 11. Open decisions

| #   | Item                                                                                                 | Owner              |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | **RTL typeface pairing** — provisional fallback in place, not a brand decision                       | Design             |
| 2   | **Brand colour provenance** — `sam-blue-500` sampled from raster; official vector/Pantone supersedes | Brand              |
| 3   | **Latin typeface** — Inter shipped; licensed grotesque not procured                                  | Brand / commercial |
| 4   | **Photography** — not commissioned; the system is built to launch without it                         | Content            |
| 5   | Deferred system items — z-index scale, print styles, `forced-colors`, large-monitor container        | Frontend           |

---

## 12. Changing the system

Tokens are authored in TypeScript (`packages/ui/src/tokens/*.ts`) and **generated** into the
Tailwind theme. TypeScript is edited; CSS is generated and committed.

To change a value:

1. Edit the token source.
2. Run the token build.
3. Re-run the contrast audit if a colour changed.
4. Commit source and generated output together.

Never edit the generated theme directly, and never introduce a colour, size, duration or
spacing value in a component. A raw value in a component is a defect, not a shortcut — it is
the mechanism by which a design system stops being one.

Changes to the decisions in this document — the identity colour, the light-first posture, the
surface model, the exclusions in §9 — need explicit sign-off, not a prose edit
([CLAUDE.md](../../CLAUDE.md) §4).
