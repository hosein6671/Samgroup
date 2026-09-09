import { timingSafeEqual } from "node:crypto";
import type { PayloadRequest } from "payload";
import { isService } from "../access";

export function editorAuthenticated(req: PayloadRequest): boolean {
  const secret = req.headers.get("x-editor-secret");
  const expected = process.env["PAYLOAD_EDITOR_SECRET"];
  if (!isService(req.user) || !secret || !expected || expected.length < 32) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
