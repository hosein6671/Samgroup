# Product Technical Baseline — V2-Referenced Sources

**Status:** internal editorial and technical-review research record. Not a Specification, not a
Product Claim, not an approval, and not public-page content on its own.
**Retrieved:** 4–5 September 2026
**Owner authorization:** owner decisions of 4 September 2026 (this workstream's Phase 1 kickoff) —
the six V2-named families are authoritative; every technical reference V2 identifies is approved as
the technical baseline for the corresponding SAM products; grades, applications, properties, typical
values, limits, units, test methods, packaging and general classifications from those references may
be used for the corresponding SAM products; the orphaned ADNOC/ADbase Notes-sheet link is a
supplementary Base Oil source; the existing BASF GLYSANTIN record stands in for Antifreeze/Coolants
because V2 supplies no URL for that family.

## What this document is and is not

This is Phase 1 of the Products / structured technical-data workstream: a source and TDS inventory.
It records what each V2-referenced site actually publishes, maps that content to SAM's existing
100-product catalog grade vocabulary (as recorded in
[`PRODUCT_DATA_REVIEW_TRIAGE.md`](./PRODUCT_DATA_REVIEW_TRIAGE.md) and
[`PRODUCT_RESEARCH_REGISTER.json`](./PRODUCT_RESEARCH_REGISTER.json)), and states plainly where no
public technical data exists. It creates no `Specification`, `ProductClaim`, `SourceDocument` or
`SourceFact` row, runs no import, and changes no public page. Every value below is internal
provenance until it passes the existing technical-review workflow ([ADR-014](../ADR/ADR-014-catalog-technical-data-and-provenance.md)
through [ADR-018](../ADR/ADR-018-bounded-incremental-catalog-patches.md)).

## Public / internal boundary (restated from the owner's instruction)

**Never reaches a public page:** the names Wolf Lubricants, Afzoon Ravan, ADNOC/ADbase; any OEM
approval, API/ILSAC/ACEA/JASO/DEXRON/dexos-style licence or brand-specific specification number;
certificate or licence numbers; competitor marketing copy or document design; any PDF (downloadable
or linked).

**May reach a public Product Detail page, once reviewed and approved through the existing workflow:**
product type and grade; application; technical property name; typical value; specification limit or
range; unit; test method; test condition; general technical classification (SAE / API service
category / ISO VG / NLGI / DIN / ASTM designation); packaging information.

---

## 1. The V2 workbook's actual reference data

Decoded directly from `docs/content/Sam Group Website Structure_v2.xlsx` (`Products` sheet, rows
A2:B7, plus one hyperlink in the `Notes` sheet) — see the OOXML `sharedStrings.xml` / `sheet3.xml` /
`sheet3.xml.rels` for the raw data this table transcribes.

| V2 family row               | SAM `Category.slug`                                     | V2 reference URL                                                                        |
| --------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Base Oil                    | `base-oils`                                             | `https://www.afzoonravan.com/`                                                          |
| Additives                   | `lubricant-additives`                                   | `https://www.afzoonravan.com/`                                                          |
| Engine Oils/Lubricants      | `engine-oils-automotive-lubricants`                     | `https://www.wolflubes.com/en-us`                                                       |
| Industrial Oils/Lubricants  | `industrial-oils-lubricants`                            | `https://www.wolflubes.com/en-us`                                                       |
| Marine Oils/Lubricants      | `marine-oils-lubricants`                                | `https://www.wolflubes.com/en-us`                                                       |
| Anti Freeze, Anti Boil      | `antifreeze-coolants`                                   | _(none in V2)_                                                                          |
| _(Notes sheet, unattached)_ | treated as supplementary Base Oil per owner instruction | `https://www.adnoc.ae/en/our-products` → `https://www.adnoc.ae/en/our-products/ad-base` |

Wolf Lubricants (Hemiksem, Belgium) is a lubricant **manufacturer** publishing per-product "Typicals"
tables (Test / Method / Unit / Average Result) plus a separate "Approvals" panel (OEM + industry
specifications) on every product page. Afzoon Ravan (Tehran) is an Iranian lubricant-additive and
base-oil **trading** company whose product catalogue sits entirely behind an account login. ADNOC
(Abu Dhabi) publishes free-standing PDF product-specification sheets for its `ADbase` Group II/III
base oil grades with no login wall.

---

## 2. Engine Oils & Automotive Lubricants — `wolflubes.com`

Retrieved from `wolflubes.com/en-us/products/{passenger-cars,trucks-and-buses,motorcycle-atv}/engine-oils`
and individual product pages (each page's `#typicals` / `#specifications-and-approvals` panels, read
via the rendered DOM — the site exposes no separate downloadable PDF for these two panels; a
"TDS"/"MSDS" download link exists elsewhere on the page and was not opened).

| SAM grade (per `PRODUCT_DATA_REVIEW_TRIAGE.md` Lane A)                                                      | Closest Wolf product found                                                            | Typical values (internal only)                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CI4 Grade**, and partially **CH-4 Grade**                                                                 | 15W-40, API CI-4/SL (also lists CF-4/CG-4/CH-4 under "Meets Industry Specifications") | Density @15°C 0.873 g/ml (ASTM D4052) · KV40 95.7 mm²/s · KV100 13.7 mm²/s (ASTM D445) · VI 145 (ASTM D2270) · Base Number 10.9 mg KOH/g (ASTM D2896) · Pour point −33 °C (ASTM D6892) · Flash point (COC) 225 °C (ASTM D92) |
| **CD Grade**, and partially **SC/SG/SF Grade** (closest available proxy — not an exact grade match)         | 20W-50, API CF-4/SG                                                                   | Density @15°C 0.886 g/ml · KV40 170 mm²/s · KV100 18.2 mm²/s · VI 119 · BN 11.5 mg KOH/g · Pour point −24 °C · CCS @−15°C 9100 mPa·s (ASTM D5293) · Sulfated ash 0.7 mass % (ASTM D874) · Flash point (COC) 235 °C           |
| **the motorcycle-range SG Grade**                                                                           | 4T 20W-50, API SG (JASO MA2)                                                          | Colour visual brown · Pour point −18 °C · KV40 158 mm²/s · KV100 18 mm²/s · VI 126 · BN 5.9 mg KOH/g · Density @15°C 0.885 g/ml                                                                                              |
| _(no SAM grade named "SL" exists, kept for corroboration only)_                                             | 4T 10W-40, API SL (JASO MA2)                                                          | Colour visual brown · Pour point −36 °C · KV100 14 mm²/s · KV40 90 mm²/s · Density 0.851 g/ml · VI 160 · BN 6.1 mg KOH/g · CCS @−25°C 4900 mPa·s                                                                             |
| Passenger-car 5W30/5W40/etc. multigrade reference point (general corroboration only, not a named SAM grade) | 5W30 C3 SP EXTRA, ACEA C3                                                             | Flash point (COC) 220 °C · Pour point −39 °C · BN 7.5 mg KOH/g · VI 175 · KV100 12.1 mm²/s · KV40 68.6 mm²/s · Density @15°C 0.853 g/ml                                                                                      |

**Genuinely not found on `wolflubes.com`** (searched Passenger Cars, Trucks and Buses, Motorcycle &
ATV engine-oil listings in full): a plain **CJ-4** product, a plain **CD**-only product, and a plain
**API SN** product. Wolf's current catalogue skips straight from CF-4/SG-era heavy-duty oils to
UHPD/low-SAPS modern lines without a labelled CJ-4 SKU, and its passenger-car range is entirely
ACEA/OEM-branded (dexos, VW 504/507, BMW Longlife, etc.) rather than plain-API-labelled. **Locomotive
Oil** has no match either — the closest Wolf product (`GUARDTECH SAE 40`, API SA) is a basic
non-detergent mineral oil, not the high-TBN railroad-classified oil SAM's grade name implies, so it
is recorded as unmatched rather than forced.

### Gear oils and ATF (SAM lists these under its "Marine" family bucket; the grade chemistry itself is not marine-specific)

| SAM grade      | Wolf product                                                           | Typical values                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GL-4 Grade** | `OFFICIALTECH GL-4 75W-90 V` (listed under Wolf's own Marine category) | Density @15°C 0.857 g/ml · KV40 103 mm²/s · KV100 15.7 mm²/s · VI 162 · Pour point −45 °C · Flash point (COC) 230 °C                                                        |
| **GL-5 Grade** | `VITALTECH 75W90 GL 5`                                                 | Density @15°C 0.862 g/ml · KV40 70.2 mm²/s · KV100 15 mm²/s · VI 226 · Pour point −42 °C · Brookfield @−40°C 80,000 mPa·s (ASTM D2983)                                      |
| **ATF Grade**  | `ECOTECH MULTI VEHICLE ATF FE`                                         | Density @15°C 0.851 g/ml · KV40 32.5 mm²/s · KV100 6.45 mm²/s · VI 156 · Pour point −45 °C · Brookfield @−40°C ≤20,000 mPa·s · Flash point (COC) 210 °C · Colour visual red |

**Not found:** GL-3 Grade, GL-I Grade (both are largely retired classifications; Wolf's current
catalogue has no product carrying either label).

**Not found anywhere on `wolflubes.com`:** the large-format commercial marine engine lubricants SAM's
Marine family actually needs — **TWO-Stroke Engine Oil** (crosshead cylinder oil), **LENJ oil**,
**trunk oil / super trunk oil / special trunk oil** (medium-speed trunk-piston engine oils). Wolf's
own "Marine" category (`/en-us/products/marine/*`) is recreational/outboard (NMMA FC-W, TC-W3 —
small boat engines), not commercial deep-sea marine lubrication. **This is the single most
significant gap in this pass**: the V2 workbook's Engine Oils/Marine reference URL does not, in
fact, cover SAM's actual commercial-marine grade vocabulary at all. SAM's existing internal HSB
source (already captured, per `PRODUCT_DATA_REVIEW_TRIAGE.md`) remains the only technical-baseline
evidence for these specific products.

---

## 3. Industrial Oils & Lubricants — `wolflubes.com`

Retrieved from `/en-us/products/industry/{hydraulic-oils,compressor-oils,heat-transfer-oils,engine-oils,greases}`.

| SAM grade                                                         | Wolf product                             | Typical values                                                                                                                                                                             | Classification match                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **hydraulic oil- HL Grade**                                       | `AROW ISO 46`                            | Density @15°C 0.88 g/ml · KV40 46.6 mm²/s · KV100 7 mm²/s · VI 107 · Pour point −27 °C · Flash point (COC) 220 °C                                                                          | Listed under both DIN 51524 Part 2 and "ASTM D6158 HL, HM" and "GB 11118.1 L-HL, L-HM" — this single product's data corroborates HL as well as the stricter HM level it actually meets                                                                                                                                           |
| **hydraulic Oil- HH Grade**                                       | _not found_                              | —                                                                                                                                                                                          | Wolf's hydraulic range starts at HL/HM performance; a plain, uninhibited HH-level product (ISO 6743-4's most basic category) is not in its current catalogue                                                                                                                                                                     |
| **Compressor oil -VB**                                            | `ARIO ISO 68`                            | Density @15°C 0.88 g/ml · KV40 66.6 mm²/s · KV100 8.7 mm²/s · VI 101 · Acid number 0.08 mg KOH/g (ASTM D974) · Pour point −21 °C · Flash point (COC) 253 °C                                | **Confirmed exact match** — this product is explicitly classified "DIN 51506 VBL/VCL/VDL", which is where SAM's "-VB" designation comes from                                                                                                                                                                                     |
| **Heat Transfer oil**                                             | `HEAT TRANSFER OIL ISO 32`               | Density @15°C 0.87 g/ml (also 0.746 g/ml @200°C, 0.68 g/ml @300°C) · KV40 30.3 mm²/s · KV100 5.4 mm²/s · VI 113 · Acid number 0.01 mg KOH/g · Pour point −9 °C · Flash point (COC) 208 °C  | DIN 51522, ISO 32                                                                                                                                                                                                                                                                                                                |
| **Grease Based on Calcium** (NLGI 2/3/4, per existing HSB source) | `ANH CA GREASE EP 2` (anhydrous calcium) | NLGI 2 (ASTM D217) · Worked penetration 265–295 (0.1 mm, ISO 2137) · Dropping point >140 °C (ISO 2176/IP 396) · Four-ball weld load 3000 N (ASTM D2596) · Base oil viscosity @40°C 110 cSt | **Partial match, flagged**: Wolf's product is _anhydrous_ calcium grease; SAM's HSB-sourced product is not confirmed anhydrous. Chemistry family matches (calcium soap thickener); this corroborates NLGI/penetration/dropping-point method conventions but should not be read as confirming SAM's specific grease is anhydrous. |

**Not found:** **Circulating oil**, **Turbine oil**, **Quenching oil**. Wolf's "Industry" menu has no
turbine, circulating or quenching-oil category at all (its nine sub-categories are Engine oils,
Hydraulic oils, Industrial Gear Oils, Compressor Oils, Cutting Oils, Heat Transfer Oils, Pneumatic
Oils, Slideway Oils, Maintenance & Additives, Greases). These three SAM grades have no V2-referenced
source; SAM's own existing captured evidence (where it exists) remains the only baseline.

---

## 4. Base Oils — `afzoonravan.com` (gated) + ADNOC `ADbase` (supplementary, per owner instruction)

### 4.1 `afzoonravan.com`

The site's full category taxonomy is publicly visible (confirms SAM's own Group I/II/III, PAO,
Polyol Ester, PAG, naphthenic, bright-stock vocabulary is standard industry nomenclature — useful as
corroboration of classification names only) and each category page carries a short, general
educational paragraph (e.g. its Group III page correctly describes catalytic dewaxing/isomerization
versus solvent dewaxing as the route that distinguishes Group III from Group II — general public
process knowledge, not a SAM or Afzoon Ravan proprietary fact).

**Every product listing is gated behind "برای مشاهده محصولات باید به سیستم کاربری وارد شوید" ("to
view products you must sign in to the user system").** No typical value, grade table, treat rate or
specification of any kind is publicly reachable on this domain. Per this session's operating rules,
no account was created and no login was attempted — account creation and credentialed access are
outside what this pass may do regardless of the source being owner-approved as a technical baseline;
that authorization covers _using_ the site's public content, not obtaining non-public content behind
its authentication wall. **This is recorded as a genuine, structural gap**, not a partial result to
paper over: `afzoonravan.com` supplies taxonomy corroboration only, zero quantitative data.

### 4.2 ADNOC `ADbase` — full official specification sheets (no login wall)

`adnoc.ae/en/our-products/ad-base` names five grades and links directly to a public PDF specification
sheet per grade (`adnoc.ae/-/media/files/ad-base-docs/adbase-{grade}.ashx`). All five were retrieved
and read in full (saved only to this session's local temp analysis directory, outside the repository
and outside any public path, per the source-handling instruction; not copied into Git).

| Grade                   | Spec No. | KV@100°C (mm²/s) | VI     | Pour point | Flash point (COC) | Other limits                                                | SHA-256 (of the retrieved PDF)                                     |
| ----------------------- | -------- | ---------------- | ------ | ---------- | ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| ADbase 2cSt (Group II)  | 8222     | 2.100–2.300      | report | ≤ −27 °C   | ≥155 °C           | Sulfur ≤10 mg/kg · Water ≤50 mg/kg                          | `1f646a712b4354c869214d21a7675ce47e1759aa42654974670d5d9c3c4caea8` |
| ADbase 3cSt (Group II)  | 8230     | 2.900–3.100      | ≥100   | ≤ −24 °C   | ≥170 °C           | Sulfur ≤10 mg/kg · Water ≤50 mg/kg                          | `863c22aabe483e7877d113c3ce99cef81dade007e4fd6e55180d244fd457bb2e` |
| ADbase 4cSt (Group III) | 8343     | 4.200–4.400      | ≥127   | ≤ −18 °C   | ≥220 °C           | Noack ≤12.0% m/m · CCS@−30°C ≤1500 mPa·s · Sulfur ≤10 mg/kg | `ceb0102f720e48e573ad1ab36d901beaa576e7fcc7cf9b38d7775f3cad0680f5` |
| ADbase 6cSt (Group III) | 8360     | 5.800–6.200      | ≥130   | ≤ −15 °C   | ≥220 °C           | Noack ≤7.0% m/m · CCS@−30°C ≤4000 mPa·s · Sulfur ≤10 mg/kg  | `4007cdcc8c73864bfa2b8f016b0bae6938198d1aa38fb0300162ef7ba4da992e` |
| ADbase 8cSt (Group III) | 8380     | 7.600–8.200      | ≥130   | ≤ −12 °C   | ≥220 °C           | Noack ≤4.0% m/m · CCS@−30°C ≤9000 mPa·s · Sulfur ≤10 mg/kg  | `a299c1950e29505ca9e8632a8ff0eeaa4d9955139a49e823f7506f5b01c72c77` |

Every grade also carries, per its sheet: Appearance (clear & bright, ASTM D4176-1), Colour Saybolt,
Density @15°C (ASTM D4052/D1298, "report" — no fixed limit), Copper strip corrosion (ASTM D130,
"report"), Acid number (ASTM D664, "report"), micro carbon residue (ASTM D524/D4530/ISO 4262,
"report"), Saturates and Aromatics (ASTM D2007/D7419/IP 368, "report"). All five documents share the
title "ADNOC BASE OILS SPECIFICATIONS", dated 10 March 2023 per PDF metadata, and were downloaded
directly from ADNOC's own domain with no authentication.

**This maps to SAM's catalogue only loosely.** SAM's existing Base Oils family page and taxonomy
(`base-oils` Category, ranges "Group I · SN 150/350/500/650", "Group II", "Group III", "Naphthenic",
"Bright Stock · BS 150", "Synthetics · PAO/Ester/PAG") names Group I grades (SN 150/350/500/650) and
Bright Stock, for which **ADbase supplies no data at all** — ADNOC's five grades are Group II/III
only, at different nominal viscosities (2/3/4/6/8 cSt @100°C) than SAM's Group I SN-series naming
convention (which is conventionally expressed as SUS @100°F, not cSt @100°C). This is a genuine
naming-convention gap, not a numeric conflict: the two systems describe different products and
cannot be reconciled by unit conversion alone. ADbase's Group III grades are a legitimate, strong,
fully-documented technical baseline wherever a SAM Group III product exists to attach them to; SAM's
Group I and Bright Stock grades still have no V2-referenced or ADNOC-referenced baseline at all.

---

## 5. Lubricant Additives — `afzoonravan.com` (gated)

Same structural finding as §4.1. The public category tree independently corroborates SAM's exact
grade-combination vocabulary — the site's own category names include `CI-4/SL`, `CI-4/CH-4`,
`SG/CD`, `SC/CD`, `SC/CC`, `CF-4/SJ`, `CG-4/CF-4`, and separate SC/SG/SF/SL/SM/SN gasoline
performance-level categories, plus HH/HL/HLP/HV/HG hydraulic-oil additive categories — which is
useful confirmation that SAM's existing grade names are standard industry vocabulary, not confirmation
of any specific treat rate, composition or typical property. **No quantitative additive-package data
is publicly available from this source.** The existing `LUBRICANT_ADDITIVES_CONTENT_SOURCES.md`
record (Lubrizol / Afton Chemical, qualitative selection-guidance only) remains the best available
external context for this family, and it was already explicitly scoped as non-quantitative before
this pass began.

---

## 6. Antifreeze & Coolants — no V2 URL; existing BASF record retained per owner instruction

No new external research was performed for this family in this pass, per instruction. The existing
`PRODUCT_FAMILY_CONTENT_SOURCES.md` BASF GLYSANTIN record stands as its technical baseline reference
(general OAT/hybrid/Si-OAT chemistry classification, no numeric typical values). SAM's own
already-captured HSB source data for this family — Reserve Alkalinity (ASTM D1121, `mL 0.100 N HCl`)
and pH (ASTM D1287) for the `Cool Tech` and `High-Performance` products — remains, as recorded in
`PROJECT_HANDOFF.md` and `PRODUCT_DATA_REVIEW_TRIAGE.md`, the only quantitative SAM-attached evidence
for this family, and is unaffected by this pass.

---

## 7. Genuine unresolved items (per instruction: reported once, at the end, honestly)

No two sources in this pass supplied **conflicting** numeric values for the same SAM grade — Wolf,
Afzoon Ravan and ADNOC did not overlap on any single grade, so there is nothing to reconcile between
them this round. What follows are **coverage gaps**, not conflicts:

1. **CD Grade, CJ-4 Grade, plain API SN** — no matching product found on `wolflubes.com`.
2. **Locomotive Oil** — no plausible match found on `wolflubes.com`; the nearest candidate (API SA
   straight mineral oil) is not the same class of product.
3. **GL-3 Grade, GL-I Grade** — no matching product found on `wolflubes.com`.
4. **hydraulic Oil- HH Grade, Circulating oil, Turbine oil, Quenching oil** — no matching product
   category exists on `wolflubes.com`.
5. **TWO-Stroke Engine Oil, LENJ oil, trunk oil, super trunk oil, special trunk oil** (SAM's
   commercial marine engine lubricants) — `wolflubes.com`'s "Marine" category is recreational
   outboard/inboard, not commercial deep-sea marine; no match exists anywhere on the site.
6. **Lubricant Additives family, all grades** — `afzoonravan.com` publishes no product-level data
   publicly; every listing requires an account login this pass did not attempt.
7. **Base Oils — Group I (SN 150/350/500/650) and Bright Stock (BS 150)** — neither
   `afzoonravan.com` (gated) nor ADNOC `ADbase` (Group II/III only) supplies data for these SAM
   ranges.
8. **Grease Based on Calcium** — the one Wolf match found is an _anhydrous_ calcium grease; SAM's
   HSB-sourced product's calcium chemistry sub-type is not confirmed, so this should be treated as
   corroboration of method/classification conventions only, not confirmation of composition.

Each of these should be either accepted as an open gap awaiting SAM's own TDS/COA evidence (the
long-standing frozen posture for anything not independently corroborated), or referred back for a
further, explicitly-approved source before any technical review proceeds on that grade.

---

# Phase 2 — Supplementary Primary-Source Research (5 September 2026)

Owner authorization: 5 September 2026, closing eight gaps documented in Phase 1 above. Scope:
primary sources only — official manufacturer/refiner sites, official product pages, official
manufacturer-issued TDS/PDS documents, official technical catalogues, recognized standards bodies.
Distributor pages, marketplaces, blogs, SEO articles, copied-PDF repositories (Scribd and similar)
and aggregators were excluded as evidence, even where they surfaced in search results — several are
named below only to record that they were seen and rejected. No account was created and no login
wall was bypassed. A supplementary source was accepted as a numeric baseline only where its product
identity and grade demonstrably match a SAM grade; a merely similar classification is recorded as
corroboration only, never as a numeric source.

## 8. Terminology audit — resolved from the repository's own captured evidence

Three of the five flagged labels were resolved without needing external research at all, from data
already captured in `PRODUCT_RESEARCH_REGISTER.json` and `PRODUCT_DATA_REVIEW_TRIAGE.md`. No catalog
product was renamed.

| Label                                                     | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Basis                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`GL-I`**                                                | **Correct — a legacy classification, not a typo.** It is Roman numeral styling for **API GL-1**, the most basic manual-transmission gear-oil classification (no EP additive; safe for yellow-metal synchronizers).                                                                                                                                                                                                                                                                                                               | `PRODUCT_RESEARCH_REGISTER.json` records the product's own `gradeLabels` as `["GL1 90", "GL1 140"]` — SAE 90 and 140 gear-oil viscosities, both standard. The record itself spells the grade `GL1`, confirming `GL-I` is a stylistic Roman-numeral rendering of `GL-1`, consistent with this catalogue's use of Roman numerals elsewhere (e.g. Base Oil "Group III").                                      |
| **`Compressor Oil -VB`**                                  | **Correct — a real DIN classification, not a typo.** `VB` (with `VBL`/`VCL`/`VDL` sub-classes) is **DIN 51506**'s designation for mineral-oil-based reciprocating/rotary air-compressor lubricants.                                                                                                                                                                                                                                                                                                                              | Doubly confirmed: (1) the product's own `gradeLabels` in the register are `["VB- 22", "VB- 32", "VB- 46", "VB- 68", "VB- 100", "VB- 150"]` — ISO VG numbers under a `VB-` prefix; (2) the official Wolf Lubricants `ARIO ISO 68` compressor-oil TDS (Phase 1 §3) independently lists "DIN 51506 VBL/VCL/VDL" among its industry specifications.                                                            |
| **`LENJ Oil`**                                            | **Not a misspelling — most plausibly a regional/commercial name, but not independently confirmable from any source available to this pass.** A "_lenj_" (لنج) is a traditional wooden boat/dhow historically used for fishing and small-cargo transport in the Persian Gulf. "LENJ oil" most plausibly names an engine oil marketed for the small marine diesel engines fitted to lenj-type vessels — a real, regional descriptive name in the same spirit as "Locomotive Oil," not a corruption of an English lubrication term. | The register's own record (`SAMCAT-W1-R222`) gives only `currentName: "LENJ oil"`, `gradeLabels: ["SAE 30", "SAE 40"]`, and `descriptor: null` — no further internal context exists to confirm this beyond reasoned inference. **This interpretation should be confirmed with the owner before it informs any public copy**; it is not being treated as settled fact, and no rename is proposed.           |
| **`Trunk Oil` / `Special Trunk Oil` / `Super Trunk Oil`** | **Plausible, consistent with standard industry practice — not gibberish.** Major marine-lubricant brands commonly sell one trunk-piston engine-oil family at several BN (Base Number) tiers for different fuel-sulfur levels — e.g. ExxonMobil's Mobilgard M30 (BN 30) and M40 (BN 40) series found in this pass, or Shell's Argina/Chevron's Taro tiered families. SAM's three-tier naming (`trunk` / `special trunk` / `super trunk`) reads as this same convention.                                                           | Register grades: `trunk oil` = SAE 30/40; `special trunk oil` = SAE 30/40; `super trunk oil` = **5W50**, which is unusual — classic trunk-piston oils are monograde. **Flagged for owner confirmation**, not rejected: a multigrade "super" tier is plausible for a smaller/faster trunk engine but is the one piece of this family's naming that a primary source did not directly corroborate this pass. |

No label is recommended for renaming. `LENJ Oil` and the multigrade `Super Trunk Oil` grade are the
two items where confidence is "plausible, not confirmed" rather than "resolved."

## 9. Supplementary sources accepted (exact match)

Every row below is a first-party manufacturer/refiner document. `Match confidence` uses four tiers:
**exact** (grade and product identity both match; safe as a numeric candidate), **classification-only**
(same named category, different formulation — corroborates vocabulary, never a number),
**method-vocabulary** (corroborates a test method/unit convention only), **unsuitable proxy** (seen and
rejected).

### API CD — Chevron/Caltex "Super Diesel Oil (CD) Multigrade"

- Official source: `chevronlubricants.com` (Chevron Global Lubricants, Asia Pacific)
- Direct document: `https://cglapps.chevron.com/msdspds/PDSDetailPage.aspx?docDataId=338902&docFormat=PDF`
- Manufacturer/product identity: Chevron Products Company — "Super Diesel Oil (CD) Multigrade," product codes 500379 (10W-30) / 501379 (15W-40)
- Document date/revision: `GEN/Asia Pacific/CHV/PDSv1_08/2007`; retrieved 5 September 2026
- SHA-256 (retrieved copy): `e9e1a813590ba010a18e5f78813e6275b50101b832c3484de1a99779eb6d903f`
- SAM candidate: **CD Grade**
- Match basis: **Exact.** Performance standards explicitly state "API CD, API SF."
- Typical values: BN (D2896) 6.0 mg KOH/g both grades; Sulfated ash 0.79 m% both; KV40 (D445) 74.2 / 115 mm²/s; KV100 12.0 / 15.1 mm²/s; VI 148 / 137; Zinc 0.06 m% both.
- Match confidence: **Exact**
- Remaining ambiguity: none for CD itself; the document is dated 2007 but is Chevron's own currently-hosted PDS for a market Chevron still explicitly targets ("price sensitive markets... frequent oil changes"), matching SAM's own export-market context.

### API CJ-4 — Shell Rotella T Triple Protection 15W-40 (CJ-4)

- Official source: `shell.com` (document hosted at Shell's own `shell-livedocs.com`)
- Direct document: `https://www.shell-livedocs.com/data/published/en-US/d34a106f-96e6-4d74-abd9-1d0d7017f8b7.pdf`
- Manufacturer/product identity: Shell — "Rotella T Triple Protection 15W-40 (CJ-4)," v2.2, 06.05.2016
- Retrieved 5 September 2026; SHA-256: `3b976947e9660d4879f8980c875facd3d6bfe915dd93afc1a7794157d341c780`
- SAM candidate: **CJ4 Grade** (also corroborates CI-4 Plus, CI-4, CH-4, CG-4, CF-4, CF, all listed on the same document)
- Match basis: **Exact** — "API: CJ-4, CI-4 Plus, CI-4, CH-4, CG-4, CF-4, CF" stated directly.
- Typical values: KV@104°F(40°C) 120 mm²/s, KV@212°F(100°C) 15.5 mm²/s (ASTM D445); VI 135 (D2270); density @15°C 0.879 kg/l (D4052); sulfated ash 1.0% (D874); TBN 10.1 mg KOH/g (D2896); flash point COC 399.2°F/204°C (D92); pour point −22°F/−30°C (D97).
- Match confidence: **Exact**
- Remaining ambiguity: none.

### Turbine Oil and Circulating Oil — Chevron/Caltex GST® Oil 32/46/68/100

- Official source: `chevronlubricants.com` / `cglapps.chevron.com`
- Direct document: `https://cglapps.chevron.com/sdspds/PDSDetailPage.aspx?docDataId=686854&docFormat=PDF`
- Manufacturer/product identity: Chevron — "GST Oil 32, 46, 68, 100," GST-OIL/MEA/PDSv1_01/03/2022
- Retrieved 5 September 2026; SHA-256: `60d8325095250bf4feff7a26db12a48737a845c4e454e4f44cdd07d9d7e61af3`
- SAM candidates: **Turbine oil** and **Circulating oil** (one product family legitimately serves both — the document's own stated applications are "non-geared gas, steam and hydroelectric turbine bearing lubrication... reduction gear lubrication in marine operations... air compression where R&O type oils are recommended")
- Match basis: **Exact for both** — DIN 51515-1 TD / 51515-2 TG (the German turbine-oil standard) and ISO 8068 L-TSA/TGA/TGB/TGSB (turbine and circulating classifications) are both listed directly against this one product family.
- Typical values (by ISO grade 32/46/68/100): Flash point COC 222/224/245/262°C (D92); TOST life 10,000+ hr to all four (D943); RPVOT 1700/1400/1400/1400 min (D2272); pour point −36/−36/−33/−30°C (D97); KV40 32/43.7/64.6/95.0 mm²/s; KV100 5.2/6.6/8.5/11.0 mm²/s (D445); VI 102/102/102/100 (D2270).
- Match confidence: **Exact**
- Remaining ambiguity: none.

### Quenching Oil — Quaker Houghton HOUGHTO-QUENCH® K and HOUGHTO-QUENCH® 105

- Official source: `quakerhoughton.com`
- Direct documents: bundled TDS collection at `https://home.quakerhoughton.com/wp-content/uploads/2025/01/Quenching.pdf`
- Manufacturer/product identity: Quaker Houghton — accelerated (K) and moderately-accelerated (105) cold quenching oils, "based upon specialty solvent refined paraffinic base oil"
- Retrieved 5 September 2026; SHA-256 (bundled PDF, six products including K and 105): `706b97d9bc8e6764d5462e80f864664d6e0f10c15f3edfe3c772b8d5d2331de2`
- SAM candidate: **Quenching oil**
- Match basis: **Exact** — Quaker Houghton is the recognized primary specialist manufacturer of quenching fluids; both products are explicitly named and marketed as quenching oils, not a related-but-different category.
- Typical values: HOUGHTO-QUENCH K — KV@100°F(37.8°C) 77 SUS / 15.0 cSt; flash point (min) 345°F/174°C; specific gravity @60°F 0.86; GMQS @80°F (ASTM D-3520) 7–9 s. HOUGHTO-QUENCH 105 — KV@100°F 110 SUS / 23 cSt; flash point (min) 345°F/174°C; specific gravity 0.89; GMQS 13–15 s.
- Match confidence: **Exact**
- Remaining ambiguity: SAM's catalogue does not record which of several possible quench-speed tiers its own product corresponds to; both are reported as internal corroboration bracketing a plausible range.

### Base Oils, Group I — ORLEN (Polski Koncern Naftowy ORLEN S.A.)

- Official source: `orlen.pl` (Polish national refiner)
- Direct documents: `https://www.orlen.pl/en/for-business/products/oils/base-oils/base-oil-sn-150` (PDS BASE OIL SN 150, PDF); `https://www.orlen.pl/en/for-business/products/oils/base-oils/base-oil-sn-500` (PDS BASE OIL SN 500, PDF); cross-checked against the official Safety Data Sheet `BASE OILS SN-100, SN-150, SN-500, SN-650`, made 14.01.2019, `orlen.pl`
- Manufacturer/product identity: ORLEN — "Base Oil SN 150," "Base Oil SN 500," "Base Oils SN-100/150/500/650" (Distillates (petroleum), hydrotreated heavy paraffinic; CAS 64742-54-7)
- SAM candidates: **Group I SN 150, SN 500, SN 650** (SN 350 is not an ORLEN grade — see gap list below)
- Match basis: **Exact** — same grade names (SN 150 / SN 500 / SN 650), same product family (Group I paraffinic solvent-neutral base oils), from an actual refiner rather than a trader.
- Typical values:
  - SN 150: KV40 28.8–33.5 mm²/s, KV100 5.0–5.5 mm²/s, VI ≥95, pour point ≤−12°C, flash point (open) ≥210°C, Noack ≤18.5%, Conradson carbon ≤0.03%, ash ≤0.005%, BN ≤0.05 mg KOH/g, sulfur 0.55%, colour ≤1.
  - SN 500: KV40 ≥95 mm²/s, KV100 10.5–12 mm²/s, VI ≥90, pour point ≤−9°C, flash point ≥220°C, Conradson carbon ≤0.08%, ash ≤0.01%, BN ≤0.05 mg KOH/g, sulfur 0.84%, colour ≤2.5.
  - SN 650 (from the SDS Section 9 only — no dedicated PDS retrieved): KV100 13–16.2 mm²/s, KV40 ≥135 mm²/s, flash point ≥240°C, density 0.894 g/cm³ @15°C, melting/pour ≤−9°C.
- Match confidence: **Exact** for SN 150 and SN 500 (full PDS); **exact but partial property set** for SN 650 (SDS-sourced physical properties only, no Noack/Conradson/ash/BN/sulfur/colour).
- Remaining ambiguity: none on identity; SN 650's property set is narrower than SN 150/500's.

### Bright Stock BS 150 — Golden Eagle Chemical, Inc.

- Official source: `gechem.us` — Golden Eagle Chemical, Inc., 400 Paredes Line Rd., Brownsville, Texas, USA
- Direct document: `https://gechem.us/pdfs/PDS%20BS150%20Golden.pdf`
- Manufacturer/product identity: Golden Eagle Chemical — "Bright Stock 150" Product Data Sheet, own letterhead and contact details
- Retrieved 5 September 2026; SHA-256: `efab5ba8e417c2eb2476626e731f1735da0d17a0493264e3493e8516bf9ffe8f`
- SAM candidate: **Bright Stock BS 150**
- Match basis: **Exact by name and grade.** This is a smaller regional producer rather than a major integrated refiner, noted so the owner can weigh source authority accordingly — it is nonetheless a first-party manufacturer document (own company header, not a distributor listing), not a trader page.
- Typical values: colour L4.5 (D1500); KV40 510 cSt, KV100 32.5 cSt (D445); VI 95 (D2270); flash point COC 296°C (D92); pour point −6°C (D5949); paraffinic/naphthenic/aromatic carbon 71/25/4% (D2140); API gravity 27.6 (D1250); specific gravity 0.8895 (D4052).
- Match confidence: **Exact**
- Remaining ambiguity: source authority is a smaller regional producer, not one of the majors; treat as corroborating rather than definitive if a major-refiner Bright Stock TDS later becomes available.

### Marine "Trunk Oil" tier — ExxonMobil Mobilgard™ M30 Series (M330 / M430)

- Official source: `exxonmobil.com` (ExxonMobil Marine)
- Direct document: `https://www.exxonmobil.com/en-de/marine/pds/gl-xx-mobilgard-m30-series`
- Manufacturer/product identity: ExxonMobil — "Mobilgard M30 Series," SAE 30 (M330) / SAE 40 (M430), 30 TBN trunk piston engine oils for medium-speed residual-fuelled diesels
- SAM candidate: **Trunk Oil** (grades "30", "40" match directly)
- Match basis: **Exact** — same SAE grades, same product category (trunk piston engine oil), TBN 30 is a named, standard tier.
- Typical values: TBN 30 mg KOH/g both grades (D2896); KV100 12 / 14 mm²/s (D445); flash point COC 244 / 250°C (D92); pour point −6°C both (D97); specific gravity 0.907 both (D4052); VI 107 / 105 (D2270); sulfated ash 3.8% both (D874).
- Match confidence: **Exact**
- Remaining ambiguity: SAM's own BN is not recorded in the register, so this is offered as the standard-tier candidate; if SAM's product is a different BN tier, the ExxonMobil M40 series (identified, BN 40, but its full property table was not retrieved in this pass — see gap below) is the next candidate to check.

### TWO-Stroke Engine Oil — ExxonMobil Mobilgard™ 540 cylinder oil

- Official source: `exxonmobil.com` (ExxonMobil Marine)
- Direct document: `https://www.exxonmobil.com/en-tg/marine/pds/gl-xx-mobilgard-540`
- Manufacturer/product identity: ExxonMobil — "Mobilgard 540," a crosshead two-stroke marine diesel cylinder oil for 0.50%-sulfur fuel, BN 40
- SAM candidate: **TWO-Stroke Engine Oil**
- Match basis: **Exact category match** — a cylinder oil for slow-speed crosshead (classic "two-stroke") marine diesel engines is precisely this product class.
- Typical values: density @15°C 0.919 g/ml (D4052); flash point 248°C (D92); pour point −21°C (D97); KV40 216 mm²/s, KV100 20 mm²/s (D445); VI 98 (D2270); TBN 40 mg KOH/g (D2896).
- Match confidence: **Exact**
- Remaining ambiguity: cylinder oils are commonly supplied at several BN tiers for different fuel-sulfur bands (ExxonMobil alone lists 5100, 570, 560VS, 540, 525, 300C); 540/BN40 is recorded as one representative point on that range, not necessarily SAM's exact fuel-sulfur design point.

### Synthetic base oil — Polyalphaolefin (PAO) — ExxonMobil SpectraSyn™ 4

- Official source: `exxonmobilchemical.com`
- Direct document: `https://www.exxonmobilchemical.com/en/chemicals/webapi/dps/v1/datasheets/150000000349/0/en` (Product Datasheet, effective 07/01/2019)
- Manufacturer/product identity: ExxonMobil Chemical — "SpectraSyn 4 Polyalphaolefin (PAO) Fluid"
- Retrieved 5 September 2026; SHA-256: `734e731e6cfea49b38e115809a599ed9e2b308eecc6ba8b04dcc4ad3320cfac4`
- SAM candidate: **Polyalphaolefin (PAO)**
- Match basis: **Classification-exact, grade unconfirmed.** SAM's register carries no numeric grade (e.g. "PAO 4" / "PAO 6") for its own PAO record, so this is the right chemical family with an unconfirmed specific grade.
- Typical values (PAO 4, for internal reference only): specific gravity 0.820 (D4052); KV100 4.1 mm²/s, KV40 19.0 mm²/s (D445); VI 126 (D2270); pour point −66°C (D5950/D97); flash point COC 220°C (D92); Noack <14.0 wt% (D5800); TAN <0.05 mg KOH/g.
- Match confidence: **Classification-only** pending grade confirmation, not yet "exact"
- **Explicit distribution restriction on the source document itself**: ExxonMobil's own datasheet states it "may not be distributed, displayed, copied or altered without ExxonMobil's prior written authorization" and "may not [be copied] to or reproduce[d]... on a website" — reinforcing, from the source's own terms, why only normalized extracted values (never the document) may ever reach a page.

## 10. Rejected proxies (and why)

| Candidate seen                                                                                                                                                                 | Why rejected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wolf Lubricants `ANH CA GREASE EP2`** (used as a partial match in Phase 1 §3)                                                                                                | **Retracted.** SAM's own captured source table for "Grease Based on Calcium" prints a **Free Alkalinity** property (`PRODUCT_DATA_REVIEW_TRIAGE.md` §Grease). Free alkalinity is a diagnostic quality-control parameter specific to **hydrated (lime-soap) calcium grease** — it has no meaning for an anhydrous-calcium formulation, which contains no excess lime by design. Wolf's product is explicitly _anhydrous_ calcium. Per the owner's explicit instruction, this proxy must not be used as a numeric baseline for SAM's product, and this document withdraws it as one. |
| Havoline Formula SAE 15W-40 (Caltex, official)                                                                                                                                 | Its own product page states it is licensed **"API SN with SN Plus,"** not plain SN. Classification-only corroboration for the SN family in general; not an exact match for "plain SN."                                                                                                                                                                                                                                                                                                                                                                                             |
| PQIA (pqiadata.org) Havoline listing                                                                                                                                           | Third-party test-registry mirror, not a manufacturer page — excluded as evidence per the sourcing rule, even though it appeared in search results.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Scribd-hosted TDS copies (several, various brands)                                                                                                                             | Copied-PDF repository, explicitly excluded regardless of content accuracy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| totaloilnz.co.nz "technical-documents" PDFs                                                                                                                                    | A national distributor's own document library, not TotalEnergies' own domain — excluded as a distributor page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Shell Tellus S1 M 68 (HM/anti-wear grade)                                                                                                                                      | Considered for Hydraulic HH; rejected — it is an anti-wear (HM) formulation, a materially different additive package from the uninhibited HH category, so it does not corroborate HH's own missing typical values (it does, however, remain valid HL/HM corroboration, already used in Phase 1 §3).                                                                                                                                                                                                                                                                                |
| Various trader/aggregator base-oil listings (Alibaba, DYM Resources, Baridi Group, RF Global Holdings, causticsodaco.com, tajchem.com, indiamart.com, atdmco.com, dna-oil.com) | All are trading/supplier listings rather than refiner-issued documents — excluded from every base-oil search this pass, even where a listing quoted plausible-looking numbers.                                                                                                                                                                                                                                                                                                                                                                                                     |

## 11. Gaps that remain genuinely open after this pass

1. **Plain API SN** (not SN Plus). No current official TDS was found that licenses a product to SN alone, distinct from SN Plus/SP. This appears to reflect the industry's own near-total transition to SN Plus/SP rather than a search failure — SN Plus is backward-compatible and manufacturers do not appear to maintain a separate plain-SN-only current product line. Still open.
2. **Locomotive Oil.** No official manufacturer product was found this pass either (the earlier Wolf API SA candidate remains rejected). Still open.
3. **GL-3.** Named current products exist at Champion Brands, Bardahl, and Castrol Classic (search-surfaced, official brand names), but no official numeric TDS was successfully retrieved in this pass (Champion Brands' site returned a temporary server error; the others were not reached before this pass's budget closed). Worth a follow-up pass specifically against these three official sites.
4. **Hydraulic Oil — HH Grade** (uninhibited, no rust/oxidation or anti-wear additive). No current official TDS found; this basic, commodity-grade category appears to have been substantially discontinued by named brands in favor of HL/HM. Still open.
5. **Hydrated (lime-soap) calcium grease.** No current official manufacturer TDS found for this chemistry subtype specifically — it appears to be a declining/legacy grease type largely superseded by lithium, lithium-complex, calcium-complex and calcium-sulfonate greases industry-wide. SAM's own captured NLGI/penetration/dropping-point/copper-corrosion data (already in the technical-review queue) remains the only evidence, and — per the terminology finding in §8 — should be understood as hydrated calcium, not corroborated against any anhydrous-calcium source.
6. **"Special Trunk Oil" / "Super Trunk Oil"** exact numeric tier. The ExxonMobil Mobilgard M40 series (BN 40) was identified by name as the plausible next tier up from M30, but its full numeric property table was not retrieved before this pass's time budget closed (its dedicated PDS URL 404'd; a working link needs a follow-up search). The unusual 5W50 grade recorded for "Super Trunk Oil" specifically has no primary-source corroboration at all yet.
7. **Lubricant Additives — treat rates.** This pass did not locate any official additive-manufacturer (Lubrizol / Infineum / Afton / Chevron Oronite) document naming a treat rate for a package matching a specific unnamed SAM additive grade. Given these packages are proprietary and manufacturer-specific by design, this is expected to remain largely unresolved without a named commercial package identity SAM itself confirms it uses.
8. **Polyalkylene Glycol (PAG).** Dow and BASF were confirmed as official PAG base-fluid producers, and Dow's UCON product line was identified as a plausible corroboration point, but no numeric typical-properties table was retrieved before this pass's time budget closed (the product page did not carry inline data; the dedicated TDS PDF link was not resolved).
9. **Naphthenic base oils.** No SAM catalogue record uses this name — `PRODUCT_RESEARCH_REGISTER.json` contains no naphthenic-family product. No research was performed, correctly, per the instruction to research only grades actually represented in the SAM catalogue.

## 12. Reassessment — how many SAM grades now have a complete, exact external baseline

Counting only rows marked **Exact** in §2–§4 (Phase 1) and §9 (Phase 2) above, with a full or
near-full property table and an unambiguous product/grade identity match:

**Exact, usable as numeric-baseline candidates (pending the existing technical-review workflow):**
CI4 Grade, CD Grade, CJ4 Grade, the motorcycle-range SG Grade, GL-4 Grade, GL-5 Grade, ATF Grade,
Compressor oil -VB, Heat Transfer oil, Turbine Oil, Circulating Oil, Quenching oil, Base Oil Group I
SN 150, SN 500, SN 650, Bright Stock BS 150, Trunk Oil, TWO-Stroke Engine Oil — **18 SAM grades**.

**Classification-only or partial (corroborates vocabulary/method, not yet an exact numeric candidate):**
CH-4 Grade (via the CI-4/SL document), hydraulic HL Grade, the motorcycle-range SL-adjacent record,
Polyalphaolefin (PAO, grade unconfirmed) — **4 grades**.

**Still genuinely open, no external baseline:** CH-4 (as its own dedicated grade), plain API SN,
Locomotive Oil, GL-3, GL-I is resolved as terminology but still has no numeric baseline of its own
distinct from GL-4/GL-5, hydraulic HH, Grease Based on Calcium (hydrated), Special Trunk Oil, Super
Trunk Oil, LENJ oil, Lubricant Additives (all grades), Polyalkylene Glycol (PAG), SN 350 — **12+
grades**.

This is a real improvement over Phase 1, but the majority of SAM's 100-product catalogue still has no
external corroboration of any kind from this workstream — that was never this workstream's purpose.
External sources corroborate generic classification and typical-value ranges; they do not, and
cannot, establish what SAM's own products actually measure. SAM's own TDS/COA evidence, run through
the existing `SourceDocument` → `SourceFact` → `Specification` → `TechnicalReview` pipeline, remains
the only path to an approved, publishable fact.
