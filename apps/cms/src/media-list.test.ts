import assert from "node:assert/strict";
import { test } from "node:test";

import { mediaList, mediaUpload } from "./editor/media-list";

test("editor media feed is authenticated, bounded and projects only picker fields", async () => {
  const previousSecret = process.env["PAYLOAD_EDITOR_SECRET"];
  process.env["PAYLOAD_EDITOR_SECRET"] = "s".repeat(32);
  const findCalls: Record<string, unknown>[] = [];
  const response = await mediaList.handler({
    headers: new Headers({ "x-editor-secret": "s".repeat(32) }),
    user: { roles: ["service"] },
    payload: {
      config: {},
      find: async (options: Record<string, unknown>) => {
        findCalls.push(options);
        return {
          totalDocs: 1,
          docs: [
            {
              id: 4,
              alt: "Laboratory",
              url: "/media/cms/lab.webp",
              width: 1200,
              height: 800,
              filename: "lab.webp",
              filesize: 999,
            },
          ],
        };
      },
    },
  } as never);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    items: [
      {
        id: 4,
        alt: "Laboratory",
        url: "/media/cms/lab.webp",
        width: 1200,
        height: 800,
      },
    ],
    total: 1,
  });
  assert.equal(findCalls[0]?.limit, 100);
  assert.equal(findCalls[0]?.depth, 0);
  if (previousSecret === undefined) delete process.env["PAYLOAD_EDITOR_SECRET"];
  else process.env["PAYLOAD_EDITOR_SECRET"] = previousSecret;
});

test("editor upload stores a bounded image through Payload and sanitizes its name", async () => {
  const previousSecret = process.env["PAYLOAD_EDITOR_SECRET"];
  process.env["PAYLOAD_EDITOR_SECRET"] = "s".repeat(32);
  let createOptions: Record<string, unknown> | undefined;
  const response = await mediaUpload.handler({
    headers: new Headers({ "x-editor-secret": "s".repeat(32) }),
    user: { roles: ["service"] },
    text: async () =>
      JSON.stringify({
        alt: " Facility ",
        name: "../facility.jpg",
        mimeType: "image/jpeg",
        content: Buffer.from([0xff, 0xd8, 0xff]).toString("base64"),
      }),
    payload: {
      create: async (options: Record<string, unknown>) => {
        createOptions = options;
        return { id: 5, alt: "Facility", url: "/media/cms/facility.jpg", width: 10, height: 8 };
      },
    },
  } as never);
  assert.equal(response.status, 201);
  assert.equal((createOptions?.file as { name: string }).name, "facility.jpg");
  assert.deepEqual(createOptions?.data, { alt: "Facility" });
  if (previousSecret === undefined) delete process.env["PAYLOAD_EDITOR_SECRET"];
  else process.env["PAYLOAD_EDITOR_SECRET"] = previousSecret;
});
