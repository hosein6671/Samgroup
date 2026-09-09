import { test } from "node:test";
import assert from "node:assert/strict";
import type { PayloadRequest } from "payload";
import { editorEvents } from "./editor/editor-events";

test("editorial history is protected, bounded and excludes private receipt fields", async () => {
  const previous = process.env.PAYLOAD_EDITOR_SECRET;
  const secret = "test-only-editor-secret-at-least-32-characters";
  process.env.PAYLOAD_EDITOR_SECRET = secret;
  const calls: Record<string, unknown>[] = [];
  const req = {
    user: { roles: ["service"] },
    headers: new Headers(),
    url: "http://cms/api/editor/events",
    payload: {
      find: async (options: Record<string, unknown>) => {
        calls.push(options);
        return {
          totalDocs: 1,
          docs: [
            {
              id: 7,
              createdAt: "2026-09-09T00:00:00Z",
              actorId: "actor",
              resource: "about-us",
              action: "publish",
              requestHash: "private-hash",
              operationId: "internal-id",
              revision: "internal-revision",
            },
          ],
        };
      },
    },
  } as unknown as PayloadRequest;
  try {
    assert.equal((await editorEvents.handler(req)).status, 403);
    assert.equal(calls.length, 0);
    req.headers.set("x-editor-secret", secret);
    for (const query of [
      "page=0",
      "page=100001",
      "event=user.created",
      "actorId=invalid",
      "from=bad",
      "from=2026-09-10T00:00:00Z&to=2026-09-09T00:00:00Z",
      "limit=999",
    ]) {
      assert.equal(
        (
          await editorEvents.handler({
            ...req,
            url: `http://cms/api/editor/events?${query}`,
          } as PayloadRequest)
        ).status,
        400,
      );
    }
    assert.equal(calls.length, 0);
    const response = await editorEvents.handler({
      ...req,
      url: "http://cms/api/editor/events?page=2&event=content.publish&from=2026-09-09T00:00:00Z",
    } as PayloadRequest);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      total: 1,
      items: [
        {
          id: "7",
          occurredAt: "2026-09-09T00:00:00Z",
          actorId: "actor",
          subjectId: "about-us",
          event: "content.publish",
          outcome: "success",
          httpStatus: null,
        },
      ],
    });
    assert.ok(calls[0]);
    assert.equal(calls[0].limit, 50);
    assert.equal(calls[0].page, 2);
    assert.deepEqual(calls[0].where, {
      and: [
        { action: { equals: "publish" } },
        { createdAt: { greater_than_equal: "2026-09-09T00:00:00Z" } },
      ],
    });
    req.payload.find = async () => {
      throw new Error("private database failure");
    };
    const failure = await editorEvents.handler(req);
    assert.equal(failure.status, 503);
    assert.equal((await failure.text()).includes("private database failure"), false);
  } finally {
    if (previous === undefined) delete process.env.PAYLOAD_EDITOR_SECRET;
    else process.env.PAYLOAD_EDITOR_SECRET = previous;
  }
});
