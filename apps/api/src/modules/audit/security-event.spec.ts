import { securityEvent } from "./security-event";
describe("security event classification", () => {
  it("records login success and failure without account input", () => {
    expect(securityEvent("POST", "/api/v1/auth/login", 200)).toBe("auth.login");
    expect(securityEvent("POST", "/api/v1/auth/login", 401)).toBe("auth.login");
  });
  it("records denied access and ignores ordinary public reads", () => {
    expect(securityEvent("GET", "/private", 403)).toBe("access.denied");
    expect(securityEvent("GET", "/api/v1/products", 200)).toBeNull();
  });
  it("never accepts arbitrary event names from paths", () => {
    expect(securityEvent("POST", "/api/v1/auth/login-secret", 200)).toBeNull();
  });
});
