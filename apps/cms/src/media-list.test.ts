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
  assert.match(
    (createOptions?.file as { name: string }).name,
    /^facility-[0-9a-f]{8}\.jpg$/,
    "strips the path segment, keeps the readable stem and extension, and adds a collision-safe suffix",
  );
  assert.deepEqual(createOptions?.data, { alt: "Facility" });
  if (previousSecret === undefined) delete process.env["PAYLOAD_EDITOR_SECRET"];
  else process.env["PAYLOAD_EDITOR_SECRET"] = previousSecret;
});

test("editor upload sanitizes a name with spaces, commas and mixed case", async () => {
  const previousSecret = process.env["PAYLOAD_EDITOR_SECRET"];
  process.env["PAYLOAD_EDITOR_SECRET"] = "s".repeat(32);
  let createOptions: Record<string, unknown> | undefined;
  const response = await mediaUpload.handler({
    headers: new Headers({ "x-editor-secret": "s".repeat(32) }),
    user: { roles: ["service"] },
    text: async () =>
      JSON.stringify({
        alt: "Team photo",
        // The exact shape a browser's own file picker hands back for a downloaded ChatGPT image,
        // or any phone/screenshot default name — the bug this test guards against.
        name: "ChatGPT Image Sep 17, 2026, 02_30_10 PM.png",
        mimeType: "image/png",
        content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64"),
      }),
    payload: {
      create: async (options: Record<string, unknown>) => {
        createOptions = options;
        return { id: 6, alt: "Team photo", url: "/media/cms/team.png", width: 10, height: 8 };
      },
    },
  } as never);
  assert.equal(response.status, 201);
  assert.match(
    (createOptions?.file as { name: string }).name,
    /^chatgpt-image-sep-17-2026-02-30-10-pm-[0-9a-f]{8}\.png$/,
    "a space or comma in the original name must never reach the storage key or the public URL",
  );
  if (previousSecret === undefined) delete process.env["PAYLOAD_EDITOR_SECRET"];
  else process.env["PAYLOAD_EDITOR_SECRET"] = previousSecret;
});
