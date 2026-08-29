import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ContactUs } from "./globals/contact-us";

import type { Field } from "payload";

function nestedFields(fields: Field[]): Field[] {
  return fields.flatMap((field) => {
    if ("tabs" in field && Array.isArray(field.tabs)) {
      return field.tabs.flatMap((tab) => nestedFields(tab.fields));
    }
    return [field];
  });
}

describe("contact-us Global", () => {
  test("is reviewable and published-only for the service", () => {
    assert.equal(ContactUs.slug, "contact-us");
    assert.deepEqual(ContactUs.versions, { drafts: true });
    assert.deepEqual(ContactUs.access?.read?.({ req: { user: { roles: ["service"] } } } as never), {
      _status: { equals: "published" },
    });
  });

  test("models every approved channel independently and no placeholder value", () => {
    const fields = nestedFields(ContactUs.fields);
    const names = fields.flatMap((field) => ("name" in field ? [field.name] : []));

    assert.deepEqual(names, [
      "mainPhone",
      "salesPhone",
      "generalEmail",
      "salesEmail",
      "whatsappUrl",
      "linkedinUrl",
      "instagramUrl",
      "telegramUrl",
      "address",
    ]);
    assert.ok(fields.every((field) => !("defaultValue" in field) || field.defaultValue == null));
  });

  test("localizes only the public address", () => {
    const fields = nestedFields(ContactUs.fields);
    const localized = fields.flatMap((field) =>
      "name" in field && "localized" in field && field.localized ? [field.name] : [],
    );

    assert.deepEqual(localized, ["address"]);
  });
});
