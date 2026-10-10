# Homepage visual concepts: comparison

Status: **exploration only.** Nothing in `apps/`, `packages/` or `docs/` was changed. The two prototypes in this folder are standalone HTML files. They reuse the live homepage copy word for word, plus the existing logo and photography by relative path (`../../apps/web/public/...`).

| File                                 | Concept                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `concept-01-editorial-spectral.html` | 01: Spectral Editorial (dark, Swiss grid, WebGL spectral field)                                     |
| `concept-02-laminar-lab.html`        | 02: Laminar Lab (light-led, fluid-dynamics motif, one dark band)                                    |
| `concept-03-duotone-split.html`      | 03: Ink & White, **final**: the selected direction (live-site colours, photo-led, cinematic hero A) |
| `concept-03-final.html`              | Standalone copy of Concept 03 with all photographs embedded                                         |
| `hero-animations.html`               | Five hero-animation options for Concept 03 (A chosen)                                               |

Open either file directly in a desktop browser. The Claude in-app preview renders them as snapshots, so the photos and logo do not resolve there.

Both prototypes keep the same sections in the same order. Both keep all copy, headings, CTAs, labels and the three-figure facts unchanged, including the existing em-dashes in the copy:

Hero → Who We Are → Trust Indicators → Our Products → Why Choose SAM Group → Industries We Serve → Customized Solutions → Export / Network → Insights → Footer

---

## Shared: colours detected on the live site

Source files: `apps/web/src/features/home/flagship.css` (the `[data-brand="flagship"]` scope the homepage actually renders) and `packages/ui/src/tokens/color.ts` (the platform ramp and logo blue). Both were confirmed against https://samgp.com/en.

| Role on live site               | Token                | Hex                                               |
| ------------------------------- | -------------------- | ------------------------------------------------- |
| Dominant dark surface           | `--fs-ink`           | `#030b1f`                                         |
| Raised dark surface             | (midnight raised)    | `#08163a`                                         |
| Brand navy / light-surface text | `--fs-navy`          | `#061346`                                         |
| Navy steps                      | `--fs-navy-2` / `-3` | `#0a1c57` / `#12296e`                             |
| Neutral steel                   | `--fs-steel` / `-2`  | `#6e7a90` / `#98a3b4`                             |
| Silver / hairline base          | `--fs-silver` / `-2` | `#c7cdd6` / `#e4e8ed`                             |
| Paper                           | `--fs-paper`         | `#f3f4f6`                                         |
| Accent (CTA, highlights)        | `--fs-gold` / `-2`   | `#c39a4e` / `#e3c689`                             |
| Accent as text on white         | (light context)      | `#8a6a2a`                                         |
| Dark-context text               |                      | `#eef1f6` / `#a6b0c2` / `#8d99ad`                 |
| Logo mark                       | `sam-group-mark.png` | `#004a80`                                         |
| Platform brand ramp             | `sam-blue-50…500`    | `#f0f7fc` `#dcecf9` `#81b9e9` `#318cd8` `#0a4a80` |

Rule followed in both concepts: no new hue was introduced. Every generative colour is one of the values above, or an alpha or tonal step of one. The sam-blue ramp exists in the platform tokens and the logo, but the current homepage barely uses it. Both concepts give it a bigger role, and that is the main colour decision for you to approve.

---

## Concept 01: Spectral Editorial

**1. Overall direction.** A premium dark editorial-tech page. It uses a 12-column Swiss grid, with faint column guides that content actually snaps to. Hairline rules and monospace metadata bars sit above each section. Display type is oversized at weight 200, and layouts are strongly asymmetric. The generative layer is a slow, luminous spectral field that feels like a lab instrument rather than a sci-fi effect. Radius is 0 everywhere: one shape system for the whole page.

**2. Colours detected.** See the shared table.

**3. How the colours are reused.**

- Surfaces: ink `#030b1f` dominant, `#020817` for recessed bands (Trust, Custom). There are no light sections.
- Type: `#eef1f6` primary, `#a6b0c2` secondary. Headline line 2 is set in secondary and line 3 in italic `gold-2`.
- Gold `#c39a4e` stays the primary CTA, as it is today, and is the warm end of every spectral gradient.
- Sam-blue `#318cd8` → `#81b9e9` is the cool end of the luminous ribbons, the spectral bars, the particles and the network arcs.
- Hover states: a gold→blue-300 hairline draws across.

**4. Hero.** The copy is unchanged and left-aligned in columns 1–8. Behind it is a full-bleed WebGL fragment shader: five luminous ribbons blending blue → blue-300 → gold-2, faint gold procedural contour lines, and grain. A left-to-right ink scrim protects the text, which sits on near-solid ink. The "Portfolio at a glance" facts become a right-hand hairline ledger with 48px light numerals. "Explore the SAM Group portfolio" moves to a bottom rule with a live mono field coordinate. The ribbons lean subtly toward the pointer.

**5. Typography.** Inter Tight 200/300 for display, the existing family at lighter weights. The hero runs up to 84px and h2 up to 72px, with tight −0.03em tracking. Inter is used for reading. IBM Plex Mono at 12px uppercase carries every label, index (T/01, R/01, I/01) and metadata bar. Hierarchy comes from weight contrast (200 against 500 mono) more than from colour.

**6. Sections.**

- **Who We Are:** a 9-column statement, the lead indented one column, and a portrait photo in columns 9–12 with canvas contour lines screen-blended over it. The three claims are hairline rows that nudge right on hover.
- **Trust:** a recessed band with a slow two-tone particle drift. The four indicators sit in a 4-column ledger, and a gold→blue line draws across the top on hover.
- **Products:** an index list of family codes on the left and a detail panel on the right, headed by animated spectral bars. Each family gets its own seeded bar profile, and the bars ease between families. Specs sit in a two-column hairline grid.
- **Why Choose:** an asymmetric hairline mosaic of six cells at different widths (5/4/3, then 3/5/4), with no cards.
- **Industries:** full-bleed index rows. On hover a spectral line sweeps through the row, the title shifts right and turns gold-2, and the description brightens.
- **Customized Solutions:** a pinned horizontal sequence. Scroll drives six step panels sideways. Step numerals are outline type that fills gold when active, and a luminous wave runs along the track.
- **Network:** an equirectangular dot field built from the site's own `LAND` outline, with gold→blue arcs from HQ. Hovering a destination draws its arc and pulses a ring. Stats sit in a three-column ledger.
- **Insights:** an editorial row with the date as mono metadata and the headline in large light type. The empty state is the CTA-only row, as today.

**7. Animation and interaction.**

- **Entrance:** hero lines rise out of masks, staggered 100ms. Sections fade up 24px on enter.
- **Scroll:** the Customized Solutions pin and horizontal scrub. The nav turns solid after the hero.
- **Transitions:** sections are separated by full-width rules, not colour changes.
- **Hover:** hairline draws, row shifts, outline-to-fill numerals.
- **Cursor:** the hero ribbons follow the pointer with heavy damping, and the coordinate readout updates. There is no custom cursor.
- **Reduced motion:** the shader renders one still frame. The pin becomes a vertical list, and all reveals are instant.

**8. WebGL / Canvas.**

- One full-screen-triangle shader, rendered at 0.5× resolution with 4-octave noise. That is about one draw call per frame, with a CSS-gradient fallback if WebGL is missing.
- Four Canvas 2D layers: photo contours, particles, spectral bars and network arcs.
- Every loop runs only while its element is on screen (IntersectionObserver) and stops under `prefers-reduced-motion`.

**9. Mobile.** Below 900px everything collapses to one column. The hero scrim becomes vertical and the ledger drops under the CTAs. The pinned sequence becomes a vertical list, the product index stacks above its detail, and the network stats stack. No horizontal overflow was measured at 375px.

**10. Advantages and disadvantages.**

- **Advantages:**
  - Closest to the current site (dark-first, gold CTA), so it is the smallest brand move.
  - It is the most distinctive and "engineered" of the two.
  - Monospace metadata suits a specification-led B2B buyer.
- **Disadvantages:**
  - The whole page is dark, so the open reversed-logo issue (`#004a80` at 2.1:1 on ink) shows everywhere.
  - Weight-200 type needs careful sizing for legibility, and the Persian and Arabic typeface pairing is still open.
  - The pinned horizontal section is the most fragile piece to implement.
  - Long dark pages can feel heavy for procurement readers.

**11. What it would feel like.** A technical journal crossed with a lab instrument: quiet, dark and precise. The only light on the page comes from slow spectral ribbons in the brand's own blue and gold.

---

## Concept 02: Laminar Lab

**1. Overall direction.** Light-led, clean and fluid. The motif is laminar flow and liquid level: what a lubricant actually does. Surfaces are white and paper, navy is the ink, sam-blue carries the flow, and gold is a sparse tracer. The page switches theme once, on purpose, into a navy band for Customized Solutions and Network, entered and exited through a curved meniscus edge. The shape system is soft: 18px panels and pill controls, applied everywhere.

**2. Colours detected.** The same shared table.

**3. How the colours are reused (differently from 01).**

- Surfaces: `#ffffff` and `#f3f4f6` lead. Navy `#061346` (not ink) is the dark band.
- Type: navy primary and `#5a667c` secondary. Headline line 2 is set in logo blue `#004a80`, line 3 in steel.
- The primary CTA is navy. Gold is kept for "Request a Quote" and "Request a custom solution", and appears as one tracer streamline in every flow drawing.
- Sam-blue 50/100 tints fill liquid levels and tile hovers. Blue 400/logo blue draw the streamlines.
- Product columns are each filled with a different step of the existing ramp: blue-50, gold tint, navy, silver, logo-blue and blue-100.

**4. Hero.** The headline is stacked top-left in heavy type, with the lead and CTAs top-right. Below them sits a full-width rounded flow channel: an analytic potential-flow field (flow past a cylinder) drawn with about 900 Canvas particles. The pointer is the obstacle, so the streamlines visibly part around it. One particle in about sixteen is gold. The three facts become instrument readouts floating in the channel, with the "Explore the SAM Group portfolio" link alongside them.

**5. Typography.** Inter Tight 600 for display (heavy and tight, −0.045em), where 01 uses weight 200. Inter is used for reading. Mono appears only for numerals and small tags. Section labels are sentence-case gold-text with a small blue gradient marker, not uppercase mono.

**6. Sections.**

- **Who We Are:** a sticky statement column on the left. On the right, three claims scroll past as tiles. The first is a navy tile carrying the product-portfolio photo, and a blue level line draws along the bottom on hover.
- **Trust:** a 2×2 grid of tiles. On hover a sam-blue "liquid level" rises inside the tile with a slight viscous overshoot.
- **Products:** six vertical columns, an accordion. Each column holds a coloured liquid at a different level. Selecting one expands it to show the name, body, spec chips and a slow surface ripple. On mobile it becomes a vertical accordion.
- **Why Choose:** sticky stacked panels. The six reasons pile up as you scroll, and panel 3 is navy for rhythm.
- **Industries:** a five-cell bento (4+2, then 2+3+3). The large cell uses existing photography. The others show streamlines at different "viscosities" (amplitude and speed), on varied surfaces.
- **Customized Solutions (navy band):** a vertical pipeline. As you scroll, a pipe fills from blue-300 to gold, and each step's node lights gold when the level passes it. The cards alternate either side of the pipe.
- **Network (navy band):** an azimuthal polar chart centred on SAM Group. Destinations are placed by true bearing and great-circle distance, with range rings and a slow radar sweep. Hovering a destination pill draws a dashed flowing route. Stats are shown as chips.
- **Insights:** a magazine spread, with the headline column next to a large photo card for the post.

**7. Animation and interaction.**

- **Entrance:** a "pour" reveal, where content fills upward behind a clip-path like a rising level. Hero lines pour in staggered.
- **Scroll:** the sticky Who column, sticky stacked panels, the pipeline fill, and meniscus edges whose curvature relaxes to flat as the band settles. The nav pill switches to navy inside the band.
- **Hover:** liquid levels rise, columns expand with a spring, bento cells lift.
- **Cursor:** the hero obstacle (the main interaction) and magnetic CTAs on fine pointers only.
- **Reduced motion:** the flow field is drawn once as static streamlines. The pipeline shows full, stacking is off, and reveals are instant.

**8. WebGL / Canvas.**

- Everything is Canvas 2D, with no WebGL needed. The hero field is a closed-form velocity function, not a simulation, so it costs about 900 line segments per frame.
- The other canvases are polyline ripples and one polar chart.
- All of them use the same on-screen-only loop, so a production build could ship with zero new dependencies.

**9. Mobile.** Below 960px the hero becomes a single column and the channel is 340px tall (touch drag still moves the obstacle). Products become a vertical accordion, and the panels drop their sticky offsets into a column. The bento becomes a single column, the pipeline moves to the left edge, and the polar chart goes full width. No horizontal overflow was measured at 375px.

**10. Advantages and disadvantages.**

- **Advantages:**
  - Matches the platform design system's light-first rule in `packages/ui`.
  - Uses the logo blue properly and keeps the logo on light surfaces, which sidesteps the reversed-logo problem for most of the page.
  - The fluid metaphor is specific to lubricants rather than generic tech.
  - It is the cheaper of the two to implement, with no WebGL.
- **Disadvantages:**
  - It is a bigger departure from today's dark-first flagship.
  - Rounded and pill shapes read more "product" and less "editorial".
  - The six-column product accordion needs careful keyboard and screen-reader work.
  - The trust-tile glyphs in the prototype are placeholders and would be replaced with the existing icon set.

**11. What it would feel like.** A clean, well-lit technical laboratory. The page behaves like a fluid: streamlines bend around your cursor, levels rise as you read, and one deep navy channel carries you through the process and the export map before you surface again.

---

## Concept 03: Ink & White (final)

**Status:** the selected direction, finalised on 10 October 2026 after several review rounds. Trust, Our Products and Why were then switched back to **the live site's own sections** at the owner's request. It is still a prototype: nothing in `apps/` has changed.

**Files.**

- `concept-03-duotone-split.html`: the working source. It loads the photographs from `apps/web/public` by relative path, so open it from inside the repository.
- `concept-03-final.html`: a **standalone copy** with every photograph embedded once (hero shots at 1920px, the others at 1200px, about 1.2 MB). It opens anywhere with no repository. Fonts and icons still load from Google Fonts and unpkg.
- `hero-animations.html`: the five hero-animation options (A Reel, B Aperture, C Liquid, D Scroll zoom, E Spotlight). **Option A was chosen** and is the hero in Concept 03.

**Design read:** a homepage redesign for procurement and technical buyers. The brand is kept and the visuals are new: photographic, industrial and confident. **Dials:** VARIANCE 6, MOTION 6, DENSITY 4. It was reviewed against the taste skill (`design-taste-frontend`).

**1. Colour.** Exactly the live site's scheme, section for section, measured on samgp.com/en:

- **Ink `#030b1f`:** Hero, Trust, Products, Industries, Network, Footer.
- **White `#ffffff`:** Who We Are, Why, Customized Solutions, Insights.
- Text, hairline and accent values are the `flagship.css` semantic tokens for each surface.
- Gold `#c39a4e` is the single accent.

**2. Type.** The live type scale from `flagship.css`: hero 36–64px, display 32–52px, section headings 26–40px, card titles 17–29px, lead 17–20px. Headings are Inter Tight 300, reading text is Inter, labels are IBM Plex Mono.

**3. Shape and rhythm.** These match the live sections so the page reads as one system:

- Every panel, card and photograph uses the live `--fs-radius-panel` (18px); controls are pills.
- Section spacing is the live `--fs-section-pad-y`, `clamp(80px,8vw,128px)`. Our Products keeps its own live value.
- All content sits on one container: max 1560px with the `clamp(20px,5vw,88px)` gutter.

**4. Nav and footer.** These are **the live site's own**: the markup from samgp.com/en and the CSS from `flagship.css`. The behaviour mirrors `site-nav.tsx`:

- The bar turns solid after 40px and retracts when scrolling down.
- The Products mega menu, language menu and mobile drawer all work.

The logo uses the live `.fs-mark` crop.

**5. Sections.**

| Section              | Surface | Composition                                                                                                                                                                                                                                       | Motion                                                                                                                                                                                                    |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero (option A)      | ink     | Four of the site's lab photographs play as a cinematic reel, with one colour grade (navy shadows, gold highlights), lens depth of field, grain and vignette. The copy is anchored left; the facts and shot timeline sit in a bottom "player bar". | Letterbox bars open on load; Ken Burns push-in; blur-dissolve every 6.5 s; no pointer-driven motion (owner decision); headline lines rise from a mask; pauses off screen.                                 |
| Who We Are           | white   | The statement with the lead beside it, then three photographs of equal height, each claim captioned underneath.                                                                                                                                   | Pour reveal; on hover the photo zooms and a gold rule draws.                                                                                                                                              |
| Trust                | ink     | **The live site's section** (10 Oct 2026, owner's choice): eyebrow, heading and lead, then four icon cards. Markup from samgp.com/en, CSS from `flagship.css`.                                                                                    | The live RevealEngine: cards rise in with an 85 ms stagger.                                                                                                                                               |
| Our Products         | ink     | **The live site's section** (owner's choice): the orbit of six families around the "Six families" core, the family tabs and the detail panel with specs and the Explore this range link.                                                          | The live OrbitVisual: the nodes orbit slowly; hovering or clicking a node, or a tab, selects the family (gold link, panel updates); compact layout on phones.                                             |
| Why                  | white   | **The live site's section** (owner's choice): eyebrow, heading and lead, then six icon cards in a 3×2 grid.                                                                                                                                       | The live RevealEngine stagger.                                                                                                                                                                            |
| Industries           | ink     | A five-photo accordion.                                                                                                                                                                                                                           | Expands on hover or focus.                                                                                                                                                                                |
| Customized Solutions | white   | The photograph and six step cards (with background icons) on one track. Internals aligned: number, title, body and Input/Output at fixed positions.                                                                                               | **Pinned horizontal scroll** that stops when the last card reaches the right gutter (it no longer runs to the screen edge); steps light up in turn; a progress line and step dots; swipe track on phones. |
| Network              | ink     | **The live section's composition**: head, branded photo, dot-matrix world map (same `LAND`, projection, HQ and hubs), HUD chips, legend, joined stats.                                                                                            | Gold routes with travelling glows; hover or tap on a hub.                                                                                                                                                 |
| Insights             | white   | The heading and Explore insights on one line, then the latest article as a large editorial feature.                                                                                                                                               | Pour reveal; photo zoom on hover.                                                                                                                                                                         |

**6. Photographs.** Every photograph carries the live **SAM GROUP watermark** (the BrandedPhoto badge: logo mark plus wordmark). The badge is light so the official `#004a80` mark reads at full contrast without being recoloured. Fifteen existing `apps/web/public` images are used.

**7. Buttons.** Simple and calm: a soft colour change, a faint gold shadow on the primary button, a 4px arrow nudge, and a slight press. Links change colour and nudge their arrow.

**8. Accessibility and performance.**

- Reduced motion turns every animation off; pinned sections become normal flow and swipe tracks.
- Section labels stay in the markup for screen readers.
- Animation loops run only while their element is on screen; the hero reel pauses in hidden tabs.
- No WebGL and no new dependencies.

**9. Verified in this session.**

- Desktop at 1440 and 1200px, and mobile at 375px.
- No console errors and no horizontal page overflow.
- Pinned scroll positions measured from 0% to 100% in both pinned sections.
- Card internals measured as aligned.
- Left and right content edges measured as identical in every section (72px and 1353px at 1440px). The last Customized Solutions card ends on the right gutter: 1353px on desktop, 355px at 375px.
- The watermark crop measured in all 27 badges.
- The nav and footer compared against the live site.

**Not verified:** real-device mobile, browsers other than Chromium (the depth-of-field effect uses `backdrop-filter`), and the smoothness of animations, because the in-app preview pauses them in the background.

**Open decisions.**

- **Copy:** three em-dashes in the existing text, and a hero lead of 33 words.
- **Photography:** Products and Industries both use lab-bottle shots. Real industry photographs would lift Industries.
- **Brand:** the logo on the ink nav still needs the owner's reversed variant.
- **Icons:** Phosphor is used here; production would use the project's icon set.

---

## Points that need your decision before any concept is built

1. **Theme.** 01 keeps the flagship's dark-first scope. 02 reverses it to light-led. Either one changes the scoped tokens in `flagship.css` only; `packages/ui` is not touched.
2. **Sam-blue's role.** Both concepts promote the existing sam-blue ramp from the logo into the generative layer. No token value changes; the `sam-blue-500` and logo mismatch is left alone, as previously agreed.
3. **Reversed logo.** It is still pending from the owner. It matters most for 01.
4. **Implementation scope.** This is a Frontend-area change to `apps/web/src/features/home/*` (sections, `flagship.css`, `motion/`, `visuals/`). Neither concept needs a new dependency: both use vanilla WebGL and Canvas through the existing `use-canvas.ts` pattern.
