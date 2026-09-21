import configuration, { DEFAULT_DATABASE_POOL_MAX } from "./configuration";

/**
 * Only `databasePoolMax`'s own default/override arithmetic — everything else the factory computes
 * is exercised end to end through the modules that consume it. This one earns a direct test
 * because getting it wrong either silently narrows concurrency (a stray fallback to `0`, which
 * `pg.Pool` treats as "no limit" — the opposite of what an empty `DATABASE_POOL_MAX` should mean)
 * or silently ignores an operator's tuning.
 */
describe("configuration — databasePoolMax", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("falls back to DEFAULT_DATABASE_POOL_MAX when unset", () => {
    delete process.env.DATABASE_POOL_MAX;

    expect(configuration().databasePoolMax).toBe(DEFAULT_DATABASE_POOL_MAX);
  });

  it("falls back to the default on a blank value, not to 0", () => {
    process.env.DATABASE_POOL_MAX = "";

    expect(configuration().databasePoolMax).toBe(DEFAULT_DATABASE_POOL_MAX);
  });

  it("uses the configured value when one is set", () => {
    process.env.DATABASE_POOL_MAX = "25";

    expect(configuration().databasePoolMax).toBe(25);
  });

  it("trims surrounding whitespace, the same reading the other optional numerics take", () => {
    process.env.DATABASE_POOL_MAX = "  15  ";

    expect(configuration().databasePoolMax).toBe(15);
  });
});
