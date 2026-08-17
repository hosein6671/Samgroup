import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { ApiException } from "../../common/http/api.exception";
import { ErrorCode } from "../../common/http/error-code";
import { PayloadClient } from "./payload.client";

const ORIGIN = "http://cms.internal:3002";
const API_KEY = "test-key";

type Harness = {
  client: PayloadClient;
  fetchMock: jest.Mock;
};

async function createHarness(
  config: Readonly<Record<string, string>> = {
    payloadInternalUrl: ORIGIN,
    payloadApiKey: API_KEY,
  },
): Promise<Harness> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      PayloadClient,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, fallback: string): string => config[key] ?? fallback,
        },
      },
    ],
  }).compile();

  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;

  return { client: moduleRef.get(PayloadClient), fetchMock };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async (): Promise<unknown> => body,
  } as unknown as Response;
}

function expectUnavailable(error: unknown): void {
  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).code).toBe(ErrorCode.UpstreamUnavailable);
  expect((error as ApiException).getStatus()).toBe(503);
}

describe("PayloadClient", () => {
  beforeEach(() => {
    // Every failure path below logs deliberately. Silenced so a suite that is passing does not read
    // like one that is failing.
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sends the service API key and never a session token", async () => {
    const { client, fetchMock } = await createHarness();
    fetchMock.mockResolvedValue(jsonResponse(200, { docs: [] }));

    await client.find("pages", { limit: "1" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(headers.authorization).toBe(`users API-Key ${API_KEY}`);
    expect(headers).not.toHaveProperty("cookie");
  });

  it("encodes the query and targets Payload's REST path", async () => {
    const { client, fetchMock } = await createHarness();
    fetchMock.mockResolvedValue(jsonResponse(200, { docs: [] }));

    await client.find("pages", { "where[slug][equals]": "cms-demo-page", limit: "1" });

    const [url] = fetchMock.mock.calls[0] as [string];

    expect(url).toBe(`${ORIGIN}/api/pages?where%5Bslug%5D%5Bequals%5D=cms-demo-page&limit=1`);
  });

  it("returns an empty document list rather than throwing when the CMS holds nothing", async () => {
    const { client, fetchMock } = await createHarness();
    fetchMock.mockResolvedValue(jsonResponse(200, { docs: [], totalDocs: 0 }));

    // The whole point of the transport/absence split: "no documents" is a successful answer, and
    // only the service above may decide it means a 404.
    await expect(client.find("pages", {})).resolves.toEqual({ docs: [] });
  });

  it.each([
    ["unconfigured origin", { payloadApiKey: API_KEY }],
    ["unconfigured api key", { payloadInternalUrl: ORIGIN }],
    ["nothing configured", {}],
  ])("reports UPSTREAM_UNAVAILABLE for %s, without issuing a request", async (_label, config) => {
    const { client, fetchMock } = await createHarness(config);

    await client.find("pages", {}).then(
      () => {
        throw new Error("expected a rejection");
      },
      (error: unknown) => expectUnavailable(error),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports UPSTREAM_UNAVAILABLE when the connection fails", async () => {
    const { client, fetchMock } = await createHarness();
    fetchMock.mockRejectedValue(
      Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } }),
    );

    await client.find("pages", {}).then(
      () => {
        throw new Error("expected a rejection");
      },
      (error: unknown) => expectUnavailable(error),
    );
  });

  it.each([401, 403, 404, 500, 502])(
    "reports UPSTREAM_UNAVAILABLE — never NOT_FOUND — for upstream status %i",
    async (status) => {
      const { client, fetchMock } = await createHarness();
      fetchMock.mockResolvedValue(jsonResponse(status, { errors: [] }));

      await client.find("pages", {}).then(
        () => {
          throw new Error("expected a rejection");
        },
        (error: unknown) => expectUnavailable(error),
      );
    },
  );

  it("reports UPSTREAM_UNAVAILABLE for a 2xx body that is not a find result", async () => {
    const { client, fetchMock } = await createHarness();
    fetchMock.mockResolvedValue(jsonResponse(200, { unexpected: true }));

    await client.find("pages", {}).then(
      () => {
        throw new Error("expected a rejection");
      },
      (error: unknown) => expectUnavailable(error),
    );
  });

  it("never puts the CMS origin or the key on the wire", async () => {
    const { client, fetchMock } = await createHarness();
    fetchMock.mockResolvedValue(jsonResponse(500, {}));

    await client.find("pages", {}).catch((error: unknown) => {
      const message = (error as ApiException).message;

      expect(message).not.toContain(ORIGIN);
      expect(message).not.toContain(API_KEY);
    });
  });
});
