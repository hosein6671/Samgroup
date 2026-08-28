# Product Data Review Triage — 34 Supplied-Catalogue Records

**Date:** 28 August 2026  
**Scope:** the 34 records whose `researchStatus` is `supplied_catalogue` in
`PRODUCT_RESEARCH_REGISTER.json`  
**Purpose:** separate records that are ready to enter source capture and technical review from
records whose source itself contains an ambiguity or unsupported claim.

This review does not approve a Specification or Product Claim. It does not change a product name,
grade, formulation, source text, database record or public page. On 28 August 2026 the product owner
confirmed that these are not proprietary formulations and that the listed products use the same
formulations as their source equivalents. Official standards and equivalent manufacturer data sheets
may therefore be used as internal corroborating evidence. Source names and links are not public
product-page content. The catalogue remains the identity and recorded-value source, and every
external mapping still requires a documented reviewer decision.

## Result

| Review lane                                     | Products |                        Specifications |                              Claims | Action                                                                               |
| ----------------------------------------------- | -------: | ------------------------------------: | ----------------------------------: | ------------------------------------------------------------------------------------ |
| Source clean; technical approval still required |       30 | Included in the 494-record review set | Included in the 56-claim review set | Capture the supplied catalogue revision, then review the individual facts and claims |
| Source ambiguity or unsupported claim           |        4 |        Contains 18 conflicts in total | Contains 17 withheld facts in total | Obtain a corrected SAM/HSB source or product TDS before approval                     |

Family distribution across all 34 records: 15 Engine Oils & Automotive Lubricants, 9 Industrial
Oils & Lubricants and 10 Marine Oils & Lubricants.

## Captured-source verification

The workbook's `کاتالوگ HSB` source resolves to the existing SourceDocument titled `Hirmand Shimi
Baharan product catalogue`. Its attached immutable SourceAsset was compared with the supplied local
`HSB products.pdf` through `pnpm catalog:sources:capture --dry-run` on 28 August 2026:

- SHA-256: `5ccd403859d793c5160216a9c5a391babb85bd180dadfa17fb9d83c85c502ee9`
- Byte size: `7,487,031`
- Media type: `application/pdf`
- Page count: `45`
- Result: `already captured; no write needed`

The source bytes and immutable metadata match. No new SourceDocument revision, SourceAsset or
database write is required for this PDF.

### Actual technical-review queue

The captured HSB source currently supports 551 SourceFacts, 494 Specifications and 40 normalized
Product Claims in the local database. Their current states are:

| Subject       | `source_recorded` | `needs_review` | Reason for `needs_review`                                                                                 |
| ------------- | ----------------: | -------------: | --------------------------------------------------------------------------------------------------------- |
| Specification |               437 |             57 | The printed source omits the unit: 56 density values and one 100 °C viscosity value                       |
| Product Claim |                38 |              2 | An unnamed manufacturer-requirement claim and an `API TC` classification claim require reviewer decisions |

The two claims are `SN Grade` (`SAMCAT-W1-R069`: “Meets the requirements of the manufacturers…”
without an identified manufacturer) and `TWO-Stroke Engine Oil` (`SAMCAT-W1-R219`: `API TC`). The
57 Specifications must not receive silently inferred units from test-method convention. The 437
`source_recorded` Specifications and 38 `source_recorded` Claims are captured evidence awaiting the
normal review path; `source_recorded` is not approval.

### Internal corroboration policy

- ASTM D4052 accepts `kg/m³` or `g/mL` for density. It can corroborate an omitted density unit when
  the captured property names ASTM D4052 and the reviewer records the chosen unit.
- ASTM D445 expresses kinematic viscosity in `mm²/s`; `cSt` is numerically equivalent. It can
  corroborate the unit, but not an omitted or ambiguous test temperature.
- NLGI and ASTM D217 express worked penetration in `0.1 mm` (`dmm` or `mm/10`). The published NLGI
  2, 3 and 4 ranges match the three recorded calcium-grease ranges.
- ASTM D566 is the official dropping-point method. The catalogue prints `ASTM D-556`; preserve this
  probable source typo as a discrepancy rather than silently rewriting it.
- ASTM D4048 reports copper-corrosion results as a rating, not a physical unit.
- An official FUCHS POE refrigeration-oil family documents compatibility with R134a and other HFC
  refrigerants and includes KD/KE terminology. It can corroborate formulation-family context under
  the owner's equivalence statement, but cannot resolve the catalogue's combined `40 100 °C`
  viscosity heading.
- API confirms API SN as a service category for 2020 and older gasoline engines. It does not support
  the catalogue's unnamed-manufacturer claim or an unspecified extended drain interval.

These sources are internal review evidence, not public citations and not automatic approval.

Internal source records used in this pass:

- ASTM D4052 density method: `https://store.astm.org/d4052-09.html`
- ASTM D445 kinematic-viscosity method: `https://store.astm.org/d0445-21e01.html`
- NLGI grade ranges and ASTM D217 worked penetration: `https://www.nlgi.org/grease-glossary/nlgi-grade/`
- NLGI LB method-and-unit table: `https://www.nlgi.org/certifications/certifications-lb/`
- ASTM D566 dropping-point method: `https://store.astm.org/d0566-17.html`
- ASTM D4048 copper-corrosion method: `https://store.astm.org/d4048-19.html`
- API oil categories: `https://www.api.org/products-and-services/engine-oil/eolcs-categories-and-classifications/oil-categories`
- FUCHS RENISO TRITON SE/SEZ equivalent POE family: `https://www.fuchs.com/cl/en/product/product/141985-reniso-triton-se-sez-series/`

## Lane A — source clean, ready for source capture

These records have `conflictCount = 0` and `withheldFactCount = 0`. “Ready” means ready for the
existing source-capture and technical-review workflow, not ready for publication.

### Engine Oils & Automotive Lubricants — 13

- CJ4 Grade
- CI4 Grade
- CH-4 Grade
- CD Grade
- SM Grade
- SL Grade
- SJ Grade
- SG Grade
- SF Grade
- SC Grade
- locomotive Oil
- the motorcycle-range SN Grade and SG Grade records remain separate catalog identities as recorded

### Industrial Oils & Lubricants — 7

- hydraulic oil- HL Grade
- hydraulic Oil- HH Grade
- Circulating oil
- Heat Transfer oil
- quenching oil
- Turbine oil
- Compressor oil -VB

### Marine Oils & Lubricants — 10

- TWO-Stroke Engine Oil
- LENJ oil
- super trunk oil
- trunk oil
- special trunk oil
- ATF Grade
- GL-5 Grade
- GL-4 Grade
- GL-3 Grade
- GL-I Grade

The capitalization and spelling above are retained from the approved identity ledger. Editorial
normalization of a public name is a separate approval and must not be folded into technical review.

## Lane B — blocked by source-level ambiguity

### SN Grade — `SAMCAT-W1-R069`

- The table records SN 10W40, SN 5W40, SN 5W30 and SN 0W20 values.
- The claim “Meets the requirements of the manufacturers…” identifies no manufacturer or approval.
- **Decision:** retain the values for technical review, but withhold the unnamed-manufacturer claim.
  It may only be restored from a source that identifies the applicable requirement.

### Racing Grade — `SAMCAT-W1-R093`

- The table records 10W60 and 5W60.
- Two density facts are held because the printed header omits its unit. The property explicitly cites
  ASTM D4052, whose accepted SI density units include `kg/m³`.
- **Decision:** the two facts may enter individual technical review with ASTM D4052 as internal unit
  corroboration. This does not approve either value or add performance language.

### Refrigerator compressor oil-KD — `SAMCAT-W1-R162`

- The table records KD-32, KD-68 and KD-100.
- Its viscosity heading reads `Viscosity 40 100 °C (Cst)` above a single value column. The source does
  not establish whether the values are measured at 40 °C or 100 °C.
- The owner's same-formulation statement plus an official equivalent POE refrigeration-oil source
  can corroborate R134a/HFC formulation-family compatibility internally.
- **Decision:** retain the refrigerant claim as a separate review subject with the equivalence basis
  recorded. Continue withholding all three viscosity facts until a corrected table identifies the
  test temperature; an equivalent formulation does not resolve an ambiguous heading.

### Grease Based on Calcium — `SAMCAT-W1-R300`

- The table records NLGI 2, NLGI 3 and NLGI 4 values.
- None of the four property columns prints a unit. Official NLGI/ASTM material corroborates worked
  penetration as `0.1 mm`, dropping point as temperature and copper corrosion as a rating. Free
  alkalinity still needs the exact reporting basis recorded by a reviewer.
- The catalogue's `ASTM D-556` dropping-point reference appears to be a typo for ASTM D566. Preserve
  both the captured text and the discrepancy; do not silently normalize the method.
- Two distinct suitability statements must remain separate claims; they must not be collapsed into
  one normalized claim.
- **Decision:** route penetration and copper-corrosion facts to individual review with internal
  standard corroboration. Keep dropping-point facts held until the method typo is explicitly
  resolved, and keep free-alkalinity facts held until its reporting basis is confirmed. Retain the
  two suitability sentences as separate review subjects.

## Required next action

1. Route the 437 `source_recorded` Specifications and 38 `source_recorded` Claims through the
   existing technical-review UI; do not bulk-approve them.
2. Review the 57 unitless Specifications individually. A reviewer may use the official standards
   above as internal corroboration under the owner's equivalence statement, but must record the
   source and decision rather than bulk-filling units.
3. Review the two `needs_review` Product Claims individually and retain rejection/withholding when
   the source cannot support the public statement.
4. Keep only genuinely unresolved facts in Lane B: the unnamed-manufacturer claim, API TC until an
   authoritative basis is captured, the KD viscosity temperature, the grease method typo and the
   free-alkalinity reporting basis.

External research can corroborate standard units, classifications and equivalent-formulation
context. It cannot repair contradictory or missing fields in the captured product table, and it must
never become an undisclosed automatic rewrite of product data.
