# Frontend Technology Stack

Finalized at Architecture Freeze follow-up. This document is the detailed rationale behind the `apps/web` stack; [TECH_STACK.md](../TECH_STACK.md) carries the short reference list. Scope here is the frontend only — this does not modify [ARCHITECTURE.md](../ARCHITECTURE.md) or the applications/modules/CMS/auth decisions already frozen there.

Payload CMS remains the project's only CMS (see [ARCHITECTURE.md §CMS Integration](../ARCHITECTURE.md#cms-integration), ADR-002, ADR-003). No other CMS is used or referenced anywhere in this stack.

---

# Core

## Next.js 15

- **Purpose:** The `apps/web` application framework — routing, rendering, and the boundary that calls the NestJS API gateway (per ADR-003).
- **Why selected:** Already the frozen choice in `TECH_STACK.md`/`ARCHITECTURE.md`; version 15 is the current stable major, with the App Router (server components, streaming, partial prerendering) needed to serve a content-heavy B2B site (per [SITE_STRUCTURE.md](../SITE_STRUCTURE.md)) with fast first paint.
- **Where used:** All six Phase 1 pages (Home, About Us, Products, Customized Solutions, Export & Logistics, Contact Us) and the Blog.
- **Performance considerations:** Server Components by default keep animation/3D/map libraries (all client-heavy) out of the initial server-rendered bundle; use `next/image` for all product/facility photography; static generation for CMS-backed pages with on-demand revalidation when Payload content changes (via NestJS's Content module).
- **SEO considerations:** App Router's built-in metadata API drives the meta title/description/Open Graph/canonical fields already modeled in `SEO_META` ([DATA_MODEL.md](../DATA_MODEL.md)); server-rendered HTML ensures crawlers see full content without executing client JS.
- **Accessibility considerations:** Framework-level support for semantic routing/focus management on navigation; still requires manual discipline (landmark roles, skip links) — not automatic.
- **Best practices:** Keep animation/3D/map components as client components (`"use client"`) at the leaf level only, not at page roots, so server rendering isn't defeated wholesale.
- **Future scalability:** App Router's route groups and parallel routes support Future Phases (Customer Portal, CRM dashboards) being added under `apps/web` without restructuring Phase 1 routes.

## React 19

- **Purpose:** The UI runtime Next.js 15 is built on.
- **Why selected:** Required pairing for Next.js 15; brings the `use` hook, Actions, and improved Suspense semantics useful for data fetched from the NestJS API.
- **Where used:** Every component in `apps/web`.
- **Performance considerations:** React Compiler-era optimizations reduce manual `useMemo`/`useCallback` need; Suspense boundaries around client-heavy sections (3D, maps) prevent them from blocking the rest of the page.
- **SEO considerations:** None directly (Next.js's server rendering is what matters for crawlers); React 19 doesn't change crawlability on its own.
- **Accessibility considerations:** Form Actions simplify accessible error-state handling for the Custom Product Request and Inquiry forms ([SITE_STRUCTURE.md §4, §6](../SITE_STRUCTURE.md)).
- **Best practices:** Follow React's own concurrent-rendering rules (no side effects in render); keep third-party client libraries (Three.js, Mapbox, GSAP) isolated behind `useEffect`/ref-based integration, not fighting React's render cycle.
- **Future scalability:** Stable, actively maintained major version; no scalability concern specific to this project's size.

## TypeScript

- **Purpose:** Static typing across `apps/web`, shared via `packages/config`'s base `tsconfig.json` ([PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)).
- **Why selected:** Already frozen platform-wide per [CODING_STANDARDS.md](../CODING_STANDARDS.md) — strict mode, no `any`.
- **Where used:** Every file in `apps/web`; shared DTO types from `packages/types` consumed here to stay in sync with the NestJS API contracts.
- **Performance considerations:** Compile-time only — no runtime cost.
- **SEO considerations:** None directly; indirectly reduces runtime errors that could break rendering.
- **Accessibility considerations:** Typed props on shared components (e.g. requiring `alt` text on an image component) can enforce accessibility contracts at compile time.
- **Best practices:** Type the NestJS API response envelope (`data`/`meta`/`error`, per [API_DESIGN.md](../API_DESIGN.md)) once in `packages/types`, never re-declare it per component.
- **Future scalability:** Already the platform-wide standard; no additional consideration.

---

# Styling

## Tailwind CSS

- **Purpose:** Utility-first styling for all `apps/web` components.
- **Why selected:** Already frozen in `TECH_STACK.md`; pairs with the shared Tailwind config in `packages/config` ([PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)) so design tokens (color, spacing, type scale) stay consistent across every page without a separate design-system package.
- **Where used:** All layout and component styling across the six Phase 1 pages.
- **Performance considerations:** Build-time purge keeps shipped CSS small regardless of how large the utility class surface grows; no runtime CSS-in-JS cost.
- **SEO considerations:** None directly — styling doesn't affect crawlability, though consistent, fast-rendering layouts reduce layout shift (a Core Web Vitals/SEO ranking factor).
- **Accessibility considerations:** Utility classes make it easy to _forget_ focus states and color contrast unless enforced deliberately — best practice below addresses this.
- **Best practices:** Define color/contrast tokens once in the shared Tailwind config so contrast ratios are correct by construction, not per-component; always pair interactive utility classes with visible `:focus-visible` styles.
- **Future scalability:** Shared config in `packages/config` means new future-phase surfaces (Customer Portal, CRM dashboards) inherit the same design tokens without redefining them.

---

# Animation

## Framer Motion

- **Purpose:** Declarative UI animation — page transitions, element enter/exit, micro-interactions (button/card hover, form field feedback).
- **Why selected:** React-native animation API (works naturally with React 19's component model) for the kind of polish a B2B manufacturer site needs to read as credible to international buyers (per [PROJECT_VISION.md](../PROJECT_VISION.md)'s "Trust Indicators" framing) — lighter-weight than GSAP for simple component-level motion.
- **Where used:** Card reveals (Product Portfolio Overview, Why Choose Sam Group, Contact Options cards — all in [SITE_STRUCTURE.md](../SITE_STRUCTURE.md)), form field states on the Custom Product Request and Inquiry forms, page/route transitions.
- **Performance considerations:** Animates via the browser's compositor (`transform`/`opacity`) by default — avoid animating layout-triggering properties (`width`, `top`); lazy-mount animated sections below the fold so they don't compete with initial page load.
- **SEO considerations:** None directly; ensure animated content is present in the DOM at render (not injected only post-animation) so crawlers still see it.
- **Accessibility considerations:** Must respect `prefers-reduced-motion` — Framer Motion supports this via `useReducedMotion()`; every animation on this project should branch through it rather than assuming motion is always wanted.
- **Best practices:** Keep animation variants co-located with the component they animate, not in a global animation file, to avoid the "every animation touches everything" problem as pages grow.
- **Future scalability:** Component-level API scales fine as more pages/forms are added in later phases; no architectural ceiling at this project's size.

## GSAP

- **Purpose:** Complex, timeline-based animation sequencing beyond simple component enter/exit.
- **Why selected:** More powerful timeline control than Framer Motion for choreographed, multi-element sequences — specifically the step-by-step process content that already exists in [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) (Customization Process: Understand → Develop → Test → Approve → Produce → Deliver; Production-to-Delivery: 8-step pipeline).
- **Where used:** The two multi-step process sections named above — these are the concrete, content-driven use case, not decorative animation for its own sake.
- **Performance considerations:** GSAP is highly optimized but runs outside React's render cycle — integrate via `useEffect`/refs and always clean up (`.kill()`) timelines on unmount to avoid leaks across client-side route changes.
- **SEO considerations:** None directly; same DOM-presence caveat as Framer Motion applies.
- **Accessibility considerations:** Same `prefers-reduced-motion` requirement as Framer Motion — GSAP's `matchMedia` utility should gate any scroll-driven sequence.
- **Best practices:** Reserve GSAP for the timeline-heavy sections named above; don't reach for it where Framer Motion already covers the need (avoids two animation libraries doing the same job in different places).
- **Future scalability:** Timeline complexity scales well; the risk is scope creep (GSAP creeping into simple UI motion Framer Motion should own) rather than a technical ceiling.

## GSAP ScrollTrigger

- **Purpose:** Scroll-position-driven animation triggering — the plugin that ties GSAP timelines to scroll progress.
- **Why selected:** Directly needed for the two step-by-step content sections above to animate as the user scrolls through them, matching the "walk the buyer through our process" intent already present in that copy.
- **Where used:** Same two sections as GSAP above (Customized Solutions' process steps, Export & Logistics' production pipeline).
- **Performance considerations:** Scroll listeners are inherently perf-sensitive — use ScrollTrigger's own `scrub`/`batch` options rather than hand-rolled scroll listeners; avoid pinning (`pin: true`) more than one section per page to limit layout recalculation cost.
- **SEO considerations:** None directly.
- **Accessibility considerations:** Scroll-jacking (pinned sections that hijack scroll) can disorient users relying on assistive scrolling — keep pinning subtle and always provide a way to skip past it; respect reduced-motion as above.
- **Best practices:** Register ScrollTrigger only on the client, and `refresh()` it after any layout-affecting async content (like CMS-fetched images) loads in.
- **Future scalability:** Fine at current content scale (two sections); if every future page adds a scroll-triggered sequence, revisit whether it's still enhancing content or has become decorative overhead.

---

# 3D

## Three.js

- **Purpose:** WebGL 3D rendering engine underlying the React Three Fiber layer below.
- **Why selected:** The industry-standard WebGL abstraction; needed to render the 3D packaging/product visuals described below without hand-writing raw WebGL.
- **Where used:** Indirectly everywhere 3D appears — never used directly in component code (React Three Fiber is the actual integration point).
- **Performance considerations:** WebGL contexts are expensive — never mount more than one live 3D canvas per page; dispose of geometries/materials/textures on unmount to avoid GPU memory leaks across route changes.
- **SEO considerations:** 3D canvases render nothing crawlable — any information conveyed only via the 3D scene (e.g. a product name) must also exist as real text/HTML elsewhere on the page.
- **Accessibility considerations:** Canvas content is invisible to screen readers — every 3D visual needs an equivalent text/image alternative, not just an `alt`-less canvas.
- **Best practices:** Load 3D assets lazily (dynamic import, mounted only when the section scrolls into view) — a 3D scene should never be part of the initial page load's critical path.
- **Future scalability:** Fine for a handful of hero/product visuals; would need a dedicated asset pipeline (compression, LOD models) if 3D usage expanded significantly beyond Phase 1's scope.

## React Three Fiber

- **Purpose:** React renderer for Three.js — lets 3D scenes be authored as React components/JSX instead of imperative Three.js code.
- **Why selected:** Keeps 3D scene code consistent with the rest of `apps/web` (React components, hooks, the same mental model), rather than introducing an entirely separate imperative rendering paradigm.
- **Where used:** The concrete, content-grounded use case is visualizing the packaging formats already named in [SITE_STRUCTURE.md](../SITE_STRUCTURE.md) — Bulk, Drums, IBC Tanks, Customized Packaging (Export & Logistics §5; also referenced under Customized Solutions' Packaging Solutions). A secondary candidate is a Home Page hero visual, but that's decorative, not content-driven — see the architectural concern at the end of this document regarding unconfirmed 3D use cases.
- **Performance considerations:** Same GPU/memory discipline as Three.js above; keep R3F's `<Canvas>` mounted only within the specific section that needs it, never at a layout level.
- **SEO considerations:** Same as Three.js — no crawlable content inside `<Canvas>`.
- **Accessibility considerations:** Same as Three.js — pair every 3D visual with a real text/image fallback for screen readers and users with WebGL disabled.
- **Best practices:** Use `@react-three/fiber`'s `Suspense` integration to show a loading state while 3D models stream in, rather than a blank canvas.
- **Future scalability:** Component-based scenes are easy to extend to more product models later; the actual scalability constraint is asset production (Blender modeling time), not the library.

## Drei

- **Purpose:** Helper/abstraction library for React Three Fiber — common patterns (camera controls, loaders, environment/lighting helpers) without hand-building them.
- **Why selected:** Avoids reimplementing standard R3F patterns (orbit controls, GLTF loading, contact shadows) that every 3D scene on this project will need.
- **Where used:** Same sections as React Three Fiber above.
- **Performance considerations:** Import only the specific helpers used (Drei supports tree-shaking) rather than importing the whole package, to keep the client bundle for 3D sections minimal.
- **SEO considerations:** None beyond what's already stated for Three.js/R3F.
- **Accessibility considerations:** Drei's `<OrbitControls>` (if used) should have keyboard interaction disabled or clearly scoped, so it doesn't trap keyboard focus on a page that otherwise needs to be keyboard-navigable.
- **Best practices:** Use Drei's `useGLTF` loader with Suspense (per React Three Fiber above) rather than manual loading-state plumbing.
- **Future scalability:** No concern beyond what's already noted for Three.js/R3F — Drei is a thin convenience layer, not an architectural commitment.

---

# Maps

## Mapbox GL JS

- **Purpose:** Interactive map rendering.
- **Why selected:** The concrete, content-grounded use case: replacing the static "regional cards" (Europe, Middle East, Asia, Africa) in the Export & Logistics page's Global Reach section ([SITE_STRUCTURE.md §5](../SITE_STRUCTURE.md)) with an interactive map highlighting Sam Group's actual target markets — Africa, neighboring countries, India, and Turkey (per [PROJECT_VISION.md §Customer Communication](../PROJECT_VISION.md)) — a more credible, specific representation of global reach than generic region names.
- **Where used:** Export & Logistics page only, for Phase 1.
- **Performance considerations:** Mapbox GL JS is a heavy client bundle — load it only on the Export & Logistics route via dynamic import, never in a shared layout; use a static preview image as the initial paint with the interactive map hydrating in after.
- **SEO considerations:** Map content isn't crawlable — the actual target-market names and any per-region text must exist as real HTML alongside the map, not only as map labels/tooltips.
- **Accessibility considerations:** Interactive maps are notoriously inaccessible to keyboard/screen-reader users — provide a text-equivalent list of served markets alongside the map, and ensure map controls are keyboard-reachable (Mapbox GL JS supports keyboard navigation but it must be explicitly enabled and tested).
- **Best practices:** Store the Mapbox access token server-side/in environment variables per [SECURITY.md](../SECURITY.md)'s secrets-management rules — never commit it, and use a domain-restricted public token for the client-side map, not a secret-scoped token.
- **Future scalability:** Fine for a single map on one page; if future phases add per-region logistics data (tracking, distributor locator), Mapbox's data-layer API supports that without a library change.

---

# Internationalization

## next-intl

- **Purpose:** Locale-aware routing, translated strings, and locale-specific formatting (dates, numbers) for Next.js App Router.
- **Why selected:** The standard, actively-maintained i18n library for the App Router specifically (as opposed to older `next-i18next`, built for the Pages Router).
- **Where used:** Every route in `apps/web` — locale-prefixed routing platform-wide. Full strategy, now fully scoped: [i18n/INTERNATIONALIZATION_STRATEGY.md](../i18n/INTERNATIONALIZATION_STRATEGY.md).
- **Performance considerations:** Locale message bundles are split per-locale and per-route so a visitor only downloads the language they're viewing, not every supported language at once.
- **SEO considerations:** Locale-specific URLs with correct `hreflang` tags let each language rank in its own market's search results — the concrete mechanism is in [docs/seo/SEO_ARCHITECTURE.md §5](../seo/SEO_ARCHITECTURE.md#5-international--multilingual-seo) and [i18n/INTERNATIONALIZATION_STRATEGY.md §4](../i18n/INTERNATIONALIZATION_STRATEGY.md#4-seo-localization).
- **Accessibility considerations:** The `lang` attribute is set correctly per rendered locale so screen readers use the right pronunciation/voice — `next-intl` handles this when configured with the App Router's locale segment; `dir` (RTL/LTR) is likewise set per locale, see the i18n strategy's RTL/LTR section.
- **Best practices:** Keep translation keys colocated with the components/pages that use them; never hardcode user-facing strings once i18n is adopted, even for the "default" locale, or the two will drift — now a stated rule in [CODING_STANDARDS.md](../CODING_STANDARDS.md).
- **Future scalability:** The active locale list is data (a `Locale` database table), not a hardcoded array — adding a language is a content/config change, not a code change. See [i18n/INTERNATIONALIZATION_STRATEGY.md §7](../i18n/INTERNATIONALIZATION_STRATEGY.md#7-scalability--adding-a-new-language).

---

# Assets

## Blender (3D assets only)

- **Purpose:** Authoring tool for the 3D models (product packaging, containers) that React Three Fiber/Drei render on the site. Not a runtime dependency — an offline content-creation tool.
- **Why selected:** Standard, free, actively maintained 3D modeling tool capable of exporting to glTF/GLB, the format Drei's `useGLTF` loader consumes directly.
- **Where used:** Offline, by whoever produces the 3D packaging models referenced under React Three Fiber above — not part of the `apps/web` codebase or build pipeline.
- **Performance considerations:** Export models at the lowest polygon count/texture resolution that still reads well at the size they'll render on-site — oversized glTF files are the single biggest risk to the 3D sections' load performance.
- **SEO considerations:** Not applicable — Blender output is a binary asset, not crawlable content.
- **Accessibility considerations:** Not applicable to the tool itself; the accessibility burden is on how the exported model is _used_ (see Three.js/R3F above).
- **Best practices:** Export via glTF/GLB (not raw `.blend` files) into a project asset pipeline, with compression (Draco or Meshopt) applied before the model ships to `apps/web`.
- **Future scalability:** No concern — this is an authoring tool, not part of the deployed system; scales with however many product models future phases need.

---

# Deployment

## Vercel (Frontend)

- **Purpose:** Hosting and deployment platform for `apps/web`.
- **Why selected:** First-party hosting for Next.js — automatic preview deployments per PR, edge caching, and image optimization tuned specifically for the framework this project already committed to.
- **Where used:** `apps/web` only. `apps/api` and `apps/cms` continue to deploy via Docker/Nginx on the Linux VPS per [DEVOPS.md](../DEVOPS.md) — **this split is new relative to what `ARCHITECTURE.md`/`DEVOPS.md` currently describe (a single undifferentiated Docker/Nginx/VPS deployment for all three apps). See the architectural concern below — this document does not modify that architecture, only records the frontend-specific piece of it.**
- **Performance considerations:** Vercel's edge network benefits `apps/web`'s static/ISR pages directly; the app still calls the NestJS API on the VPS for all data, so API latency (not hosting choice) remains the bottleneck for dynamic content.
- **SEO considerations:** Vercel's edge caching and automatic image optimization (via `next/image`) are net positives for Core Web Vitals, which factor into search ranking.
- **Accessibility considerations:** None specific to the hosting platform — accessibility is a property of the code deployed, not where it's deployed.
- **Best practices:** Configure `apps/web`'s environment variables (the NestJS API base URL, Mapbox public token) per-environment in Vercel's dashboard, following the same never-commit-secrets rule as [SECURITY.md](../SECURITY.md); use Vercel's preview deployments for PR review before merging to `main`.
- **Future scalability:** Scales automatically with traffic by design; the real future-scalability question is cross-origin/CORS configuration between Vercel-hosted `web` and VPS-hosted `api` as both environments (staging/production) multiply — worth deciding explicitly when the split deployment is formally adopted into `ARCHITECTURE.md`/`DEVOPS.md`.
