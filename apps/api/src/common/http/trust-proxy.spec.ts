import express from "express";

import { TRUST_PROXY_HOPS } from "./trust-proxy";

import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Proves the `trust proxy` setting `main.ts` applies does what `trust-proxy.ts` claims, against a
 * real Express listener and real HTTP requests — not a reimplementation of `proxy-addr`'s logic.
 *
 * This does not boot `apps/api` itself: `main.ts`'s `bootstrap()` connects to Postgres and Payload
 * and is not designed to be invoked from a test. What is under test is the one line that matters —
 * `app.set("trust proxy", TRUST_PROXY_HOPS)` — reproduced here on a bare Express app, which is
 * exactly the object Nest's Express adapter wraps, so the resolution behaviour is identical.
 */
describe("trust proxy (one hop, matching nginx)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.set("trust proxy", TRUST_PROXY_HOPS);
    app.get("/whoami", (request, response) => {
      response.json({ ip: request.ip });
    });

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("is exactly one hop", () => {
    expect(TRUST_PROXY_HOPS).toBe(1);
  });

  it("falls back to the socket peer when nginx sends no X-Forwarded-For", async () => {
    const response = await fetch(`${baseUrl}/whoami`);
    const body = (await response.json()) as { ip: string };

    // The direct TCP peer of a loopback request — never a header value, since none was sent.
    expect(["127.0.0.1", "::1", "::ffff:127.0.0.1"]).toContain(body.ip);
  });

  it("resolves to the address nginx appended, the one entry it sets for a direct visitor", async () => {
    const response = await fetch(`${baseUrl}/whoami`, {
      headers: { "X-Forwarded-For": "203.0.113.5" },
    });
    const body = (await response.json()) as { ip: string };

    expect(body.ip).toBe("203.0.113.5");
  });

  /**
   * The property this setting exists for. `$proxy_add_x_forwarded_for` only ever *appends* — it
   * never trusts an inbound value — so a caller presenting its own forged chain still has nginx's
   * own view of the caller stamped on as the rightmost entry. Trusting exactly one hop reads only
   * that rightmost entry and never consults the forged ones to its left, so the forged addresses
   * change nothing about who the request is attributed to.
   */
  it("is not fooled by extra forged entries to the left of the one nginx appended", async () => {
    const response = await fetch(`${baseUrl}/whoami`, {
      headers: { "X-Forwarded-For": "10.0.0.1, 198.51.100.7, 203.0.113.9" },
    });
    const body = (await response.json()) as { ip: string };

    expect(body.ip).toBe("203.0.113.9");
    expect(body.ip).not.toBe("10.0.0.1");
    expect(body.ip).not.toBe("198.51.100.7");
  });
});
