import config from "@payload-config";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { getPayload } from "payload";

if (process.env.SAM_ALLOW_SERVICE_KEY_ROTATION !== "true") {
  throw new Error("Set SAM_ALLOW_SERVICE_KEY_ROTATION=true for this approved credential rotation.");
}

const apiEnvUrl = new URL("../../../api/.env", import.meta.url);
const apiEnv = readFileSync(apiEnvUrl, "utf8");
const internalUrl = apiEnv
  .split(/\r?\n/u)
  .find((line) => line.startsWith("PAYLOAD_INTERNAL_URL="))
  ?.slice("PAYLOAD_INTERNAL_URL=".length)
  .trim()
  .replace(/^["']|["']$/gu, "");

if (!internalUrl) {
  throw new Error("PAYLOAD_INTERNAL_URL must be set in apps/api/.env before rotating the key.");
}

const payload = await getPayload({ config });
const serviceUsers = await payload.find({
  collection: "users",
  overrideAccess: true,
  where: { roles: { contains: "service" } },
  limit: 2,
});
const service = serviceUsers.docs[0];

if (serviceUsers.totalDocs !== 1 || service === undefined) {
  throw new Error(
    `Expected exactly one Payload service identity; found ${serviceUsers.totalDocs}.`,
  );
}

// 288 bits of entropy. The raw credential exists only in this process and the ignored API env file.
const apiKey = randomBytes(36).toString("base64url");

await payload.update({
  collection: "users",
  id: service.id,
  overrideAccess: true,
  data: { enableAPIKey: true, apiKey },
});

const nextApiEnv = /^PAYLOAD_API_KEY=.*$/mu.test(apiEnv)
  ? apiEnv.replace(/^PAYLOAD_API_KEY=.*$/mu, `PAYLOAD_API_KEY=${apiKey}`)
  : `${apiEnv.replace(/\s*$/u, "")}\nPAYLOAD_API_KEY=${apiKey}\n`;

writeFileSync(apiEnvUrl, nextApiEnv, { encoding: "utf8", mode: 0o600 });

const response = await fetch(`${internalUrl.replace(/\/+$/u, "")}/api/globals/about-us?locale=en`, {
  headers: { authorization: `users API-Key ${apiKey}`, accept: "application/json" },
  signal: AbortSignal.timeout(10_000),
});

if (!response.ok) {
  throw new Error(
    `The rotated service credential was saved, but Payload verification returned ${response.status}.`,
  );
}

console.log("Rotated and verified the Payload content-service credential without printing it.");
process.exit(0);
