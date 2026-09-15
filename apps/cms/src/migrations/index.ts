import * as migration_20260911_211822_production_baseline from "./20260911_211822_production_baseline";
import * as migration_20260914_224017_add_structural_pages_globals from "./20260914_224017_add_structural_pages_globals";

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
];
