import { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";

import { withMeta } from "../http/with-meta";
import { ResponseEnvelopeInterceptor } from "./response-envelope.interceptor";

function wrap(payload: unknown): Promise<unknown> {
  const interceptor = new ResponseEnvelopeInterceptor();
  const next: CallHandler<unknown> = { handle: () => of(payload) };

  return lastValueFrom(interceptor.intercept({} as ExecutionContext, next));
}

describe("ResponseEnvelopeInterceptor", () => {
  it("wraps a plain payload with an empty meta", async () => {
    await expect(wrap({ status: "ok" })).resolves.toEqual({ data: { status: "ok" }, meta: {} });
  });

  it("keeps the meta a handler supplied via withMeta", async () => {
    const items = [{ id: "1" }];

    await expect(wrap(withMeta(items, { total: 1, page: 1, limit: 20 }))).resolves.toEqual({
      data: items,
      meta: { total: 1, page: 1, limit: 20 },
    });
  });

  it("does not treat a payload that merely looks like an envelope as one", async () => {
    const payload = { data: "a domain field", meta: "another domain field" };

    await expect(wrap(payload)).resolves.toEqual({ data: payload, meta: {} });
  });

  it("answers with an explicit null for a void handler", async () => {
    await expect(wrap(undefined)).resolves.toEqual({ data: null, meta: {} });
  });
});
