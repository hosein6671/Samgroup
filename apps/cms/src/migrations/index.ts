import * as migration_20260911_211822_production_baseline from "./20260911_211822_production_baseline";
import * as migration_20260914_224017_add_structural_pages_globals from "./20260914_224017_add_structural_pages_globals";
import * as migration_20261010_181650_home_editable_lists from "./20261010_181650_home_editable_lists";
import * as migration_20261010_191356_home_photographs from "./20261010_191356_home_photographs";
import * as migration_20261011_173849_home_concept03 from "./20261011_173849_home_concept03";
import * as migration_20261012_133914_industry_card_links from "./20261012_133914_industry_card_links";

export const migrations = [
  {
    up: migration_20260911_211822_production_baseline.up,
    down: migration_20260911_211822_production_baseline.down,
    name: "20260911_211822_production_baseline",
  },
  {
    up: migration_20260914_224017_add_structural_pages_globals.up,
    down: migration_20260914_224017_add_structural_pages_globals.down,
    name: "20260914_224017_add_structural_pages_globals",
  },
  {
    up: migration_20261010_181650_home_editable_lists.up,
    down: migration_20261010_181650_home_editable_lists.down,
    name: "20261010_181650_home_editable_lists",
  },
  {
    up: migration_20261010_191356_home_photographs.up,
    down: migration_20261010_191356_home_photographs.down,
    name: "20261010_191356_home_photographs",
  },
  {
    up: migration_20261011_173849_home_concept03.up,
    down: migration_20261011_173849_home_concept03.down,
    name: "20261011_173849_home_concept03",
  },
  {
    up: migration_20261012_133914_industry_card_links.up,
    down: migration_20261012_133914_industry_card_links.down,
    name: "20261012_133914_industry_card_links",
  },
];
