import { test } from "node:test";
import assert from "node:assert/strict";
import { emailAdapter, parseSender, publishAlert } from "./editor/mail";

test("the sender splits into Payload's name and address", () => {
  assert.deepEqual(parseSender("SAM Group <noreply@samgp.com>"), {
    name: "SAM Group",
    address: "noreply@samgp.com",
  });
  assert.deepEqual(parseSender('"SAM Group Website" <noreply@samgp.com>'), {
    name: "SAM Group Website",
    address: "noreply@samgp.com",
  });
  assert.deepEqual(parseSender("noreply@samgp.com"), {
    name: "SAM Group",
    address: "noreply@samgp.com",
  });
});

test("without a relay Payload keeps its default and no adapter is built", () => {
  const saved = { ...process.env };
  try {
    delete process.env.SMTP_HOST;
    assert.equal(emailAdapter(), undefined);
    process.env.SMTP_HOST = "mail.example.invalid";
    process.env.SMTP_PORT = "587";
    process.env.MAIL_FROM = "SAM <noreply@example.invalid>";
    process.env.SMTP_USER = "user";
    delete process.env.SMTP_PASSWORD; // half a credential pair is not a configuration
    assert.equal(emailAdapter(), undefined);
  } finally {
    process.env = saved;
  }
});

test("a publish alert is plain text with no way to break the subject line", () => {
  const message = publishAlert(
    "about-us\r\nBcc: x@evil.example",
    "actor-1",
    new Date("2026-10-12T17:30:00Z"),
  );
  assert.ok(!/[\r\n]/.test(message.subject), message.subject);
  assert.match(message.subject, /^\[SAM Admin\] Page published: about us/);
  assert.match(message.text, /2026-10-12 17:30:00 UTC/);
  assert.match(message.text, /actor-1/);
});
