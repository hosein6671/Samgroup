# Product Data — Unresolved Register

**Date:** 27 October 2026
**Scope:** all 100 ratified catalogue products (`catalog-identity-ledger.json`, lineage W1)
**Basis:** repository files only. `sam_platform` could not be reached from this session, so no
database count below has been checked against live rows. Every figure comes from
`PRODUCT_RESEARCH_REGISTER.json` (generated 2026-08-26T22:25:43.717Z), the identity ledger and the reviewed source
transcriptions in `apps/api/src/modules/catalog/import/data/`.

This register approves nothing. It changes no product name, grade, value or database row, and it is
not public content. It lists what is still missing, in conflict or awaiting a decision, and what is
needed to close each item.

## 1. Baseline (recalculated)

| Measure                                                                    |                  Value | Matches earlier audit |
| -------------------------------------------------------------------------- | ---------------------: | --------------------- |
| Ratified products                                                          |                    100 | yes                   |
| Products checked against an official reference web page                    |                     66 | yes                   |
| Products sourced from the supplied printed catalogue                       |                     34 | yes                   |
| Products with no grade / one grade / several grades                        |            56 / 5 / 39 | yes                   |
| Product–grade relationships                                                |                    134 | yes                   |
| Specification candidates (register)                                        |                  1,398 | —                     |
| Withheld facts                                                             |                    130 | —                     |
| Open source conflicts                                                      | 192 across 34 products | —                     |
| Product claims                                                             |                    148 | —                     |
| Review status `SOURCE_RECORDED` / `NEEDS_REVIEW` / approved                |            26 / 74 / 0 | —                     |
| Products with an English + Persian copy draft (`PRODUCT_COPY_DRAFTS.json`) |                     96 | new                   |
| …of which still carry open source conflicts                                |                     30 | new                   |
| Products with no copy (Lane B)                                             |                      4 | —                     |

Nothing is approved for publication. Copy and technical data both still go through the Admin review
workflow (ADR-016, ADR-019).

## 2. Blockers that need a company decision

1. **Product names containing the reference manufacturer's series labels.** Twelve approved names use
   a reference-sheet series label: `TURBINE TECH Radial Flow`, `TURBINE TECH Gas Turbine (GT)`,
   `COMPRESSOR TECH`, `COMPRESSOR TECH Polyalphaolefin- Synthetic (PAO-S)`,
   `COMPRESSOR TECH Refrigeration Compressor Oil`, `ROLLING TECH Rolling Oil`,
   `HEAT TECH Heat Transfer Oil`, `HEAT TECH Heat Metal Oil`, `CUTTING TECH Cutting Oil`,
   `FLASHING TECH Flashing Oil`, `REWARD TECH Marine Special` and `REWARD SUPER TECH Semi Synthetic`.
   They are reproduced exactly as approved, but the company should confirm that these are its own
   product names and not reference branding carried over by mistake. Renaming would need a new
   workbook revision; nothing was renamed.
2. **Turbine oil grade labels carry a third-party prefix.** `Turbine oil` (`SAMCAT-W1-R156`) has seven
   grade labels of the form `HSB-T-32` … `HSB-T-68 plus`. A grade selector would show that prefix
   publicly. The copy does not list the labels; the labels themselves need a company decision.
3. **Third-party marks on the printed source.** The supplied catalogue's covers carry a licensing
   statement and accreditation/conformity marks that belong to its publisher. They are recorded as
   `REFERENCE_ONLY` and must never appear on SAM Group pages.
4. **Technical documents and images.** The workbook marks 51 rows «فایل TDC گذاشته نشود» (do not publish
   a TDS file). It marks the 15 additive rows «عکس نمونه با تغییرات گذاشته شود (از سایت کپی نشود)» (use a
   modified sample image; do not copy from the source site). No TDS download and no source-site image
   may be offered for those products. SAM Group's own data sheets are needed if downloads are wanted.
5. **Copy approval needs a captured source.** `product_copy_approval_gate` refuses approval unless a
   `source_document` is bound to the copy. The 16 external reference sources are still uncaptured, so
   the copy for the 66 web-sourced products cannot be approved until those artifacts are captured with
   `pnpm catalog:sources:capture`.

## 3. Lane B — source ambiguity (no copy drafted)

| Product                                         | Open item                                                                                               | What would close it                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `SAMCAT-W1-R069` SN Grade                       | A claim says "meets the requirements of the manufacturers…" without naming a manufacturer               | A corrected SAM source naming the requirement, or dropping the claim  |
| `SAMCAT-W1-R093` Racing Grade                   | Two density values printed without a unit                                                               | A reviewer decision recorded against ASTM D4052, or a corrected table |
| `SAMCAT-W1-R162` Refrigerator compressor oil-KD | The viscosity heading reads "40 100 °C" over a single column                                            | A corrected table stating the test temperature                        |
| `SAMCAT-W1-R300` Grease Based on Calcium        | No units on any column; the method is printed `ASTM D-556` (likely D566); free-alkalinity basis unknown | A corrected grease table or product TDS                               |

Once a Lane B item is closed, its copy can be drafted in the same format as the other 96.

## 4. Open conflicts and withheld facts by product

34 products carry 192 open conflicts and 130 withheld facts. The importer's plan
(`pnpm catalog:import --offline`) gives per-fact detail; this table is the per-product index.

| sourceRef        | Name                                               | Family                            | Source                | Conflicts | Withheld | Copy status                      |
| ---------------- | -------------------------------------------------- | --------------------------------- | --------------------- | --------: | -------: | -------------------------------- |
| `SAMCAT-W1-R282` | SN , SM , SL , SJ , SF…SC Engine oil additive      | lubricant-additives               | official_web_verified |        19 |        5 | Copy drafted; no values restated |
| `SAMCAT-W1-R270` | CI-4, CH-4, CF-4, CD, SC/CC Engine oil additive    | lubricant-additives               | official_web_verified |        17 |        5 | Copy drafted; no values restated |
| `SAMCAT-W1-R273` | SF , SE , SC/CC Engine oil additive                | lubricant-additives               | official_web_verified |        13 |        4 | Copy drafted; no values restated |
| `SAMCAT-W1-R300` | Grease Based on Calcium                            | industrial-oils-lubricants        | supplied_catalogue    |        12 |       12 | Lane B — no copy                 |
| `SAMCAT-W1-R276` | SL , SJ , SG Engine oil additive package           | lubricant-additives               | official_web_verified |        11 |        5 | Copy drafted; no values restated |
| `SAMCAT-W1-R114` | TURBINE TECH Gas Turbine (GT)                      | industrial-oils-lubricants        | official_web_verified |         8 |        8 | Copy drafted; no values restated |
| `SAMCAT-W1-R117` | COMPRESSOR TECH                                    | industrial-oils-lubricants        | official_web_verified |         8 |        8 | Copy drafted; no values restated |
| `SAMCAT-W1-R261` | zink-ZDDP                                          | lubricant-additives               | official_web_verified |         8 |        8 | Copy drafted; no values restated |
| `SAMCAT-W1-R279` | Universal Engine oil additive                      | lubricant-additives               | official_web_verified |         8 |        6 | Copy drafted; no values restated |
| `SAMCAT-W1-R288` | Anti-wear hydraulic oil additive package           | lubricant-additives               | official_web_verified |         8 |        3 | Copy drafted; no values restated |
| `SAMCAT-W1-R258` | Molybdenum Compound                                | lubricant-additives               | official_web_verified |         7 |        7 | Copy drafted; no values restated |
| `SAMCAT-W1-R285` | Gear oil additive                                  | lubricant-additives               | official_web_verified |         7 |        3 | Copy drafted; no values restated |
| `SAMCAT-W1-R126` | ROLLING TECH Rolling Oil                           | industrial-oils-lubricants        | official_web_verified |         6 |        6 | Copy drafted; no values restated |
| `SAMCAT-W1-R267` | diesel engine oil additive package                 | lubricant-additives               | official_web_verified |         6 |        3 | Copy drafted; no values restated |
| `SAMCAT-W1-R291` | Two-stroke motor oil                               | lubricant-additives               | official_web_verified |         5 |        2 | Copy drafted; no values restated |
| `SAMCAT-W1-R111` | TURBINE TECH Radial Flow                           | industrial-oils-lubricants        | official_web_verified |         4 |        4 | Copy drafted; no values restated |
| `SAMCAT-W1-R120` | COMPRESSOR TECH Polyalphaolefin- Synthetic (PAO-S) | industrial-oils-lubricants        | official_web_verified |         4 |        4 | Copy drafted; no values restated |
| `SAMCAT-W1-R123` | COMPRESSOR TECH Refrigeration Compressor Oil       | industrial-oils-lubricants        | official_web_verified |         4 |        4 | Copy drafted; no values restated |
| `SAMCAT-W1-R129` | HEAT TECH Heat Transfer Oil                        | industrial-oils-lubricants        | official_web_verified |         4 |        4 | Copy drafted; no values restated |
| `SAMCAT-W1-R132` | HEAT TECH Heat Metal Oil                           | industrial-oils-lubricants        | official_web_verified |         4 |        4 | Copy drafted; no values restated |
| `SAMCAT-W1-R135` | CUTTING TECH Cutting Oil                           | industrial-oils-lubricants        | official_web_verified |         4 |        4 | Copy drafted; no values restated |
| `SAMCAT-W1-R255` | Ash-less Dispersant                                | lubricant-additives               | official_web_verified |         4 |        2 | Copy drafted; no values restated |
| `SAMCAT-W1-R162` | Refrigerator compressor oil-KD                     | industrial-oils-lubricants        | supplied_catalogue    |         3 |        3 | Lane B — no copy                 |
| `SAMCAT-W1-R249` | Ash-free Antioxidant                               | lubricant-additives               | official_web_verified |         3 |        3 | Copy drafted; no values restated |
| `SAMCAT-W1-R264` | TB N400 Booster                                    | lubricant-additives               | official_web_verified |         3 |        3 | Copy drafted; no values restated |
| `SAMCAT-W1-R093` | Racing Grade                                       | engine-oils-automotive-lubricants | supplied_catalogue    |         2 |        2 | Lane B — no copy                 |
| `SAMCAT-W1-R294` | Mineral-Based                                      | antifreeze-coolants               | official_web_verified |         2 |        2 | Copy drafted; no values restated |
| `SAMCAT-W1-R297` | High-Performance                                   | antifreeze-coolants               | official_web_verified |         2 |        2 | Copy drafted; no values restated |
| `SAMCAT-W1-R069` | SN Grade                                           | engine-oils-automotive-lubricants | supplied_catalogue    |         1 |        0 | Lane B — no copy                 |
| `SAMCAT-W1-R138` | FLASHING TECH Flashing Oil                         | industrial-oils-lubricants        | official_web_verified |         1 |        1 | Copy drafted; no values restated |
| `SAMCAT-W1-R180` | DCT                                                | engine-oils-automotive-lubricants | official_web_verified |         1 |        0 | Copy drafted; no values restated |
| `SAMCAT-W1-R213` | REWARD TECH Marine Special                         | marine-oils-lubricants            | official_web_verified |         1 |        1 | Copy drafted; no values restated |
| `SAMCAT-W1-R216` | REWARD SUPER TECH Semi Synthetic                   | marine-oils-lubricants            | official_web_verified |         1 |        1 | Copy drafted; no values restated |
| `SAMCAT-W1-R252` | Dispersant                                         | lubricant-additives               | official_web_verified |         1 |        1 | Copy drafted; no values restated |

Items already recorded in `PRODUCT_DATA_REVIEW_TRIAGE.md`:

- 57 supplied-catalogue specifications with no printed unit: 56 densities and one viscosity at 100 °C.
- Two claims needing a reviewer decision: the unnamed manufacturer requirement and `API TC`.

## 5. Statements kept out of all draft copy

| Product                                | Statement not used                                                            | Reason                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `SAMCAT-W1-R180` DCT                   | "approval by reputable global automakers"                                     | No named OEM or approval document                                          |
| `SAMCAT-W1-R219` TWO-Stroke Engine Oil | API TC                                                                        | No authoritative basis captured                                            |
| Additives `R255`–`R291`                | API / JASO / Denison / ISO / DIN performance levels                           | Treat-rate context: a level describes the finished blend, not the additive |
| `SAMCAT-W1-R150`, `R153`               | Operating-temperature limits for closed and open systems                      | Technical values; the wording is also identical on both products (see §6)  |
| `SAMCAT-W1-R228`, `R231`               | Fuel-sulphur thresholds                                                       | Technical values pending review                                            |
| All supplied-catalogue products        | "high quality", "excellent" and similar adjectives                            | Unsubstantiated promotional language                                       |
| All products                           | Source publisher names and series labels other than the approved product name | Third-party branding                                                       |

## 6. Data-quality findings from this pass

1. **Taxonomy.** The workbook uses 7 category labels. The platform has 6 frozen Product Families
   (ADR-009) and 8 Product Types (ADR-020). No list of "nine categories" exists in the repository.
   - The Base Oils family has no catalogue product.
   - Seven gear oils and ATFs (`R234`–`R246`) sit under the workbook label "Marine Oils" and are mapped
     to the marine family, while the other automotive gear oils map to the engine-oils family. The copy
     describes them by product type only. The family assignment needs a company decision.
2. **Duplicate display names.** `SN Grade` (`R069` car, `R096` motorcycle) and `SG Grade` (`R081` car,
   `R099` motorcycle) are separate identities with identical names. The copy says which range each one
   belongs to, but the product cards will still show identical titles.
3. **Probable spelling issues, kept as approved:**
   - `zink-ZDDP`
   - `TB N400 Booster`
   - `FLASHING TECH Flashing Oil` (possibly "Flushing")
   - `GL-I Grade` (the source prints GL-1)
   - `locomotive Oil`
   - `Polyalphaolefin- Synthetic`

   The workbook comment on `Molybdenum Compound` says the name carries an "-N-" prefix that the
   approved name leaves out.

4. **Misleading name.** `Two-stroke motor oil` (`R291`) is an additive package, not a finished oil. The
   copy says so explicitly.
5. **Non-standard viscosity labels.** `CUTTING TECH Cutting Oil` lists ISO VG 11, 12 and 34, which are
   not ISO 3448 grades. The copy refers to "four viscosity variants".
6. **Duplicated source wording.** The quenching-oil claim repeats the heat-transfer-oil sentence word
   for word, including the closed- and open-system temperature limits. This is probably a copying
   error in the source. Do not approve it for quenching oil without confirmation.
7. **Unclear product function.** `HEAT TECH Heat Metal Oil` and `FLASHING TECH Flashing Oil` have no
   source text that explains their application. Their copy deliberately states none.

## 7. Next actions, in priority order

1. Company decision on §2 items 1 and 2: the series-label names and the Turbine oil grade prefix.
2. Capture the source artifacts (`pnpm catalog:sources:capture`) so that copy and specifications can
   be approved.
3. Extend `prisma/load-product-copy-drafts.ts` to read `PRODUCT_COPY_DRAFTS.json`. This is a separate
   Database gate: the loader currently reads only the single English `copyDraft` in the register.
   Then load the drafts with `SAM_ALLOW_PRODUCT_COPY_LOAD=true`.
4. Review copy and technical facts in the Admin review queue, starting with the 66 products that have
   no open conflicts.
5. Obtain corrected sources for the four Lane B products, and SAM Group's own data sheets.

## 8. Findings from the live-site check (27 October 2026)

These come from `samgp.com`'s public specification table, read while writing
`PRODUCT_CONTENT_IMPORT.json`. None was changed; each needs a source check.

| Product                                                          | Finding                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `HEAT TECH Heat Transfer Oil`, `HEAT TECH Heat Metal Oil`        | Grade "ISO VG 32" publishes KV40 = 36 cSt, outside the ISO 3448 band (28.8–35.2 cSt)       |
| `CUTTING TECH Cutting Oil`                                       | Labels ISO VG 11, 12 and 34 are not ISO 3448 grades; "ISO VG 11" publishes KV40 = 23 cSt   |
| `COMPRESSOR TECH Refrigeration Compressor Oil`                   | Every published value is identical to `COMPRESSOR TECH Polyalphaolefin- Synthetic (PAO-S)` |
| `REWARD TECH Marine Special`, `REWARD SUPER TECH Semi Synthetic` | TBN is published as "12-15-20-30-40-50", a list of levels rather than a single value       |
| `super trunk oil`                                                | The grade is labelled 5W50, but KV100 is 15.5 cSt (SAE 40 band) and VI is 95               |
| `Turbine oil`                                                    | Grade labels carry the `HSB-` prefix publicly; fix proposed in ADR-028                     |
| `SN Grade` (motorcycle)                                          | The live display name ends with a trailing space                                           |
| `Grease Based on Calcium`, `Molybdenum Compound`                 | No public specification value yet                                                          |
