import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  it("accepts a valid environment and coerces the port to a number", () => {
    expect(validateEnv({ NODE_ENV: "development", API_PORT: "3001" })).toMatchObject({
      API_PORT: 3001,
    });
  });

  it("throws when API_PORT is missing", () => {
    expect(() => validateEnv({ NODE_ENV: "development" })).toThrow();
  });

  it("throws when API_PORT is out of range", () => {
    expect(() => validateEnv({ API_PORT: "70000" })).toThrow();
  });

  // ADR-005: there is no staging environment, so this value must be rejected rather
  // than silently accepted.
  it("throws on an unrecognised NODE_ENV", () => {
    expect(() => validateEnv({ NODE_ENV: "staging", API_PORT: "3001" })).toThrow();
  });
});
