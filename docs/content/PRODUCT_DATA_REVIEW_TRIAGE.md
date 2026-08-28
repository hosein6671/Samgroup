# Product Data Review Triage — 34 Supplied-Catalogue Records

**Date:** 28 August 2026  
**Scope:** the 34 records whose `researchStatus` is `supplied_catalogue` in
`PRODUCT_RESEARCH_REGISTER.json`  
**Purpose:** separate records that are ready to enter source capture and technical review from
records whose source itself contains an ambiguity or unsupported claim.

This review does not approve a Specification or Product Claim. It does not change a product name,
grade, formulation, source text, database record or public page. The supplied catalogue remains the
only product-specific source for these records; a general external standard cannot resolve an
ambiguity in a SAM/HSB product table or substitute for its TDS.

## Result

| Review lane                                     | Products |                        Specifications |                              Claims | Action                                                                               |
| ----------------------------------------------- | -------: | ------------------------------------: | ----------------------------------: | ------------------------------------------------------------------------------------ |
| Source clean; technical approval still required |       30 | Included in the 494-record review set | Included in the 56-claim review set | Capture the supplied catalogue revision, then review the individual facts and claims |
| Source ambiguity or unsupported claim           |        4 |        Contains 18 conflicts in total | Contains 17 withheld facts in total | Obtain a corrected SAM/HSB source or product TDS before approval                     |

Family distribution across all 34 records: 15 Engine Oils & Automotive Lubricants, 9 Industrial
Oils & Lubricants and 10 Marine Oils & Lubricants.

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
- Two facts are withheld because the printed source does not provide enough context to publish them
  as controlled product facts.
- **Decision:** request the current product TDS. Until then, publish only identity and recorded grade
  labels; do not publish composition, suitability or performance language.

### Refrigerator compressor oil-KD — `SAMCAT-W1-R162`

- The table records KD-32, KD-68 and KD-100.
- Its viscosity heading reads `Viscosity 40 100 °C (Cst)` above a single value column. The source does
  not establish whether the values are measured at 40 °C or 100 °C.
- The refrigerant-suitability sentence is product-specific and cannot be validated from a general
  refrigeration-oil reference.
- **Decision:** withhold all three viscosity facts and the refrigerant-suitability claim until a
  corrected table or current TDS identifies the test temperature and compatibility scope.

### Grease Based on Calcium — `SAMCAT-W1-R300`

- The table records NLGI 2, NLGI 3 and NLGI 4 values.
- None of the four property columns prints a unit. Test-method conventions may suggest units, but the
  source does not state them and they must not be inferred.
- Two distinct suitability statements must remain separate claims; they must not be collapsed into
  one normalized claim.
- **Decision:** withhold all unit-dependent facts until a corrected table or TDS states property
  names, units and methods. Retain the two suitability sentences as separate review subjects.

## Required next action

1. Identify the exact supplied catalogue revision as a `SourceDocument`.
2. Run `pnpm catalog:sources:capture` in dry-run mode against that local artifact.
3. After explicit apply authorization, attach the immutable source asset to the existing document.
4. Route Lane A facts through Specification/Product Claim technical review.
5. Keep Lane B blocked until a corrected source revision or product TDS is captured.

No internet lookup can replace steps 1–5 because the unresolved questions concern the exact product
source, not the general meaning of API, SAE, ISO VG, NLGI or refrigeration terminology.
