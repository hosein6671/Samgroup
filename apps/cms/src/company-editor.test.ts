import { test } from "node:test";
import assert from "node:assert/strict";
import type { PayloadRequest } from "payload";
import { companyEditor } from "./editor/company-editor";
import { EditorialEvents } from "./collections/editorial-events";

const secret = "test-only-editor-secret-at-least-32-characters";
function request(body: unknown, authorized = true): PayloadRequest {
  return {
    user: { roles: ["service"] },
    headers: new Headers(authorized ? { "x-editor-secret": secret } : {}),
    routeParams: { key: "contact-us" },
    text: async () => JSON.stringify(body),
    payload: {},
  } as unknown as PayloadRequest;
}
test("the public service credential cannot enter the editor", async () => {
  const before = process.env.PAYLOAD_EDITOR_SECRET;
  process.env.PAYLOAD_EDITOR_SECRET = secret;
  try {
    assert.equal((await companyEditor.handler(request({ action: "read" }, false))).status, 403);
  } finally {
    if (before === undefined) delete process.env.PAYLOAD_EDITOR_SECRET;
    else process.env.PAYLOAD_EDITOR_SECRET = before;
  }
});
test("unknown fields cannot reach a content write", async () => {
  const before = process.env.PAYLOAD_EDITOR_SECRET;
  process.env.PAYLOAD_EDITOR_SECRET = secret;
  try {
    const response = await companyEditor.handler(
      request({
        action: "save-draft",
        actorId: "36c8ab45-62ca-421a-98a3-96c39d704099",
        operationId: "46c8ab45-62ca-421a-98a3-96c39d704099",
        revision: "initial",
        fields: { roles: ["admin"] },
      }),
    );
    assert.equal(response.status, 400);
  } finally {
    if (before === undefined) delete process.env.PAYLOAD_EDITOR_SECRET;
    else process.env.PAYLOAD_EDITOR_SECRET = before;
  }
});
test("editorial receipts cannot be changed through collection access", () => {
  for (const key of ["create", "read", "update", "delete"] as const) {
    const access = EditorialEvents.access?.[key];
    assert.ok(access);
    assert.equal(access({ req: request({}) }), false);
  }
});

test("content transactions fail closed and distinguish stale edits", async (t) => {
  const before = process.env.PAYLOAD_EDITOR_SECRET;
  process.env.PAYLOAD_EDITOR_SECRET = secret;
  const edit = {
    action: "save-draft",
    actorId: "36c8ab45-62ca-421a-98a3-96c39d704099",
    operationId: "46c8ab45-62ca-421a-98a3-96c39d704099",
    revision: "initial",
    fields: {},
  };
  try {
    for (const scenario of [
      "stale",
      "audit-fails",
      "receipt-missing",
      "concurrent",
      "success",
      "operation-reused",
    ] as const) {
      await t.test(scenario, async () => {
        const calls: string[] = [];
        let receipt: Record<string, unknown> | undefined;
        const req = request(edit);
        req.payload = {
          db: {
            beginTransaction: async (options: { isolationLevel: string }) => {
              assert.equal(options.isolationLevel, "serializable");
              return "transaction";
            },
            rollbackTransaction: async () => {
              calls.push("rollback");
            },
            commitTransaction: async () => {
              calls.push("commit");
            },
          },
          find: async (options: { req?: PayloadRequest }) => {
            if (options.req) {
              assert.equal(options.req.transactionID, "transaction");
              return {
                docs:
                  scenario === "operation-reused"
                    ? [{ requestHash: "different", revision: "old" }]
                    : [],
              };
            }
            calls.push("verify-receipt");
            return { docs: scenario === "receipt-missing" ? [] : [receipt] };
          },
          findGlobal: async (options: { req?: PayloadRequest }) => ({
            updatedAt:
              scenario === "stale" || (scenario === "concurrent" && !options.req)
                ? "winner-revision"
                : undefined,
          }),
          updateGlobal: async (options: {
            req: PayloadRequest;
            draft: boolean;
            data: { _status: string };
          }) => {
            assert.equal(options.req.transactionID, "transaction");
            assert.equal(options.draft, true);
            assert.equal(options.data._status, "draft");
            calls.push("write");
            if (scenario === "concurrent") throw new Error("serialization failure");
            return { updatedAt: "next-revision" };
          },
          create: async (options: { req: PayloadRequest; data: Record<string, unknown> }) => {
            assert.equal(options.req.transactionID, "transaction");
            calls.push("audit");
            if (scenario === "audit-fails") throw new Error("private database detail");
            receipt = options.data;
          },
        } as unknown as PayloadRequest["payload"];
        const response = await companyEditor.handler(req);
        const expected =
          scenario === "success"
            ? 200
            : ["stale", "concurrent", "operation-reused"].includes(scenario)
              ? 409
              : 503;
        assert.equal(response.status, expected);
        const body = await response.text();
        assert.equal(body.includes("private database detail"), false);
        assert.equal(body.includes('"saved":true'), scenario === "success");
        if (["stale", "operation-reused"].includes(scenario)) assert.deepEqual(calls, ["rollback"]);
        if (scenario === "audit-fails") assert.deepEqual(calls, ["write", "audit", "rollback"]);
        if (scenario === "concurrent") assert.deepEqual(calls, ["write", "rollback"]);
        if (["success", "receipt-missing"].includes(scenario))
          assert.deepEqual(calls, ["write", "audit", "commit", "verify-receipt"]);
      });
    }
  } finally {
    if (before === undefined) delete process.env.PAYLOAD_EDITOR_SECRET;
    else process.env.PAYLOAD_EDITOR_SECRET = before;
  }
});

test("category editor reads without creating a row and rejects invalid narrative", async () => {
  const before = process.env.PAYLOAD_EDITOR_SECRET;
  process.env.PAYLOAD_EDITOR_SECRET = secret;
  try {
    const req = request({ action: "read", actorId: "36c8ab45-62ca-421a-98a3-96c39d704099" });
    req.routeParams = { key: "category-base-oils" };
    req.payload.find = async () => ({ docs: [] }) as never;
    const response = await companyEditor.handler(req);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.revision, "initial");
    assert.ok(body.schema.some((field: { name: string }) => field.name === "heroTitle"));
    const invalid = request({
      action: "publish",
      actorId: "36c8ab45-62ca-421a-98a3-96c39d704099",
      operationId: "46c8ab45-62ca-421a-98a3-96c39d704099",
      revision: "initial",
      fields: { heroTitle: " " },
    });
    invalid.routeParams = { key: "category-base-oils" };
    assert.equal((await companyEditor.handler(invalid)).status, 400);
  } finally {
    if (before === undefined) delete process.env.PAYLOAD_EDITOR_SECRET;
    else process.env.PAYLOAD_EDITOR_SECRET = before;
  }
});

test("category writes and receipts share a transaction for creation and publication", async (t) => {
  const { categoryTextFields } = await import("./collections/product-category-content");
  const before = process.env.PAYLOAD_EDITOR_SECRET;
  process.env.PAYLOAD_EDITOR_SECRET = secret;
  try {
    for (const action of ["save-draft", "publish"] as const) {
      for (const exists of [false, true]) {
        await t.test(`${action} existing=${exists}`, async () => {
          const fields = Object.fromEntries(
            categoryTextFields.map((field) => [
              "name" in field ? field.name : "",
              "Reviewed narrative",
            ]),
          );
          const req = request({
            action,
            actorId: "36c8ab45-62ca-421a-98a3-96c39d704099",
            operationId: "46c8ab45-62ca-421a-98a3-96c39d704099",
            revision: "initial",
            fields,
          });
          req.routeParams = { key: "category-base-oils" };
          let receipt: Record<string, unknown> | undefined;
          const calls: string[] = [];
          const write = async (options: {
            req: PayloadRequest;
            draft: boolean;
            data: Record<string, unknown>;
          }): Promise<{ id: number; updatedAt: string }> => {
            assert.equal(options.req.transactionID, "tx");
            assert.equal(options.draft, action === "save-draft");
            assert.equal(options.data._status, action === "publish" ? "published" : "draft");
            assert.equal(options.data.heroTitle, "Reviewed narrative");
            calls.push("write");
            return { id: 1, updatedAt: "next" };
          };
          req.payload = {
            db: {
              beginTransaction: async () => "tx",
              commitTransaction: async () => {
                calls.push("commit");
              },
              rollbackTransaction: async () => {
                calls.push("rollback");
              },
            },
            find: async (options: { collection: string; req?: PayloadRequest }) =>
              options.collection === "product-category-content"
                ? { docs: exists ? [{ id: 1 }] : [] }
                : { docs: options.req ? [] : [receipt] },
            update: write,
            create: async (options: {
              collection: string;
              req: PayloadRequest;
              draft: boolean;
              data: Record<string, unknown>;
            }) => {
              if (options.collection === "product-category-content") {
                assert.equal(options.data.categoryKey, "base-oils");
                return write(options);
              }
              assert.equal(options.req.transactionID, "tx");
              assert.equal(options.data.resource, "category-base-oils");
              calls.push("receipt");
              receipt = options.data;
              return {};
            },
          } as unknown as PayloadRequest["payload"];
          assert.equal((await companyEditor.handler(req)).status, 200);
          assert.deepEqual(calls, ["write", "receipt", "commit"]);
        });
      }
    }
  } finally {
    if (before === undefined) delete process.env.PAYLOAD_EDITOR_SECRET;
    else process.env.PAYLOAD_EDITOR_SECRET = before;
  }
});

test("FAQ writes and receipts share a transaction for creation and publication", async (t) => {
  const before = process.env.PAYLOAD_EDITOR_SECRET;
  process.env.PAYLOAD_EDITOR_SECRET = secret;
  try {
    for (const action of ["save-draft", "publish"] as const) {
      for (const exists of [false, true]) {
        await t.test(`${action} existing=${exists}`, async () => {
          const fields = {
            question: "Which products?",
            answer: "Contact our team.",
            topic: "products",
            relatedCategoryKeys: ["base-oils"],
            showOnContactPage: false,
            sortOrder: 0,
          };
          const req = request({
            action,
            actorId: "36c8ab45-62ca-421a-98a3-96c39d704099",
            operationId: "46c8ab45-62ca-421a-98a3-96c39d704099",
            revision: "initial",
            fields,
          });
          req.routeParams = { key: "faq-56c8ab45-62ca-421a-98a3-96c39d704099" };
          let receipt: Record<string, unknown> | undefined;
          const calls: string[] = [];
          const write = async (options: {
            req: PayloadRequest;
            draft: boolean;
            data: Record<string, unknown>;
          }): Promise<{ id: number; updatedAt: string }> => {
            assert.equal(options.req.transactionID, "tx");
            assert.equal(options.draft, action === "save-draft");
            assert.equal(options.data._status, action === "publish" ? "published" : "draft");
            assert.equal(options.data.question, "Which products?");
            calls.push("write");
            return { id: 1, updatedAt: "next" };
          };
          req.payload = {
            db: {
              beginTransaction: async () => "tx",
              commitTransaction: async () => {
                calls.push("commit");
              },
              rollbackTransaction: async () => {
                calls.push("rollback");
              },
            },
            find: async (options: { collection: string; req?: PayloadRequest }) =>
              options.collection === "faq-entries"
                ? { docs: exists ? [{ id: 1 }] : [] }
                : { docs: options.req ? [] : [receipt] },
            update: write,
            create: async (options: {
              collection: string;
              req: PayloadRequest;
              draft: boolean;
              data: Record<string, unknown>;
            }) => {
              if (options.collection === "faq-entries") {
                assert.equal(options.data.entryKey, "56c8ab45-62ca-421a-98a3-96c39d704099");
                return write(options);
              }
              assert.equal(options.req.transactionID, "tx");
              assert.equal(options.data.resource, "faq-56c8ab45-62ca-421a-98a3-96c39d704099");
              calls.push("receipt");
              receipt = options.data;
              return {};
            },
          } as unknown as PayloadRequest["payload"];
          assert.equal((await companyEditor.handler(req)).status, 200);
          assert.deepEqual(calls, ["write", "receipt", "commit"]);
        });
      }
    }
  } finally {
    if (before === undefined) delete process.env.PAYLOAD_EDITOR_SECRET;
    else process.env.PAYLOAD_EDITOR_SECRET = before;
  }
});
