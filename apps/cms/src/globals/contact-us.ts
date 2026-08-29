import { editorOnly, publishedForService } from "../access";

import type { GlobalConfig, TextFieldValidation } from "payload";

const optionalHttpsUrl: TextFieldValidation = (value) => {
  if (typeof value !== "string" || value.trim() === "") return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || "Use a complete https:// URL.";
  } catch {
    return "Use a complete https:// URL.";
  }
};

/** Confirmed contact facts for the public Contact Us page. Empty fields are never rendered. */
export const ContactUs: GlobalConfig = {
  slug: "contact-us",
  access: {
    read: publishedForService,
    update: editorOnly,
    readVersions: editorOnly,
  },
  admin: {
    group: "Company pages",
    description:
      "Official contact channels shown on Contact Us and used in structured data. Leave an unconfirmed channel empty.",
  },
  versions: { drafts: true },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Phones & email",
          fields: [
            {
              name: "mainPhone",
              type: "text",
              admin: { description: "Main office number, including country code." },
            },
            {
              name: "salesPhone",
              type: "text",
              admin: { description: "Sales team number, including country code." },
            },
            { name: "generalEmail", type: "email" },
            { name: "salesEmail", type: "email" },
          ],
        },
        {
          label: "Messaging & social",
          fields: [
            { name: "whatsappUrl", type: "text", validate: optionalHttpsUrl },
            { name: "linkedinUrl", type: "text", validate: optionalHttpsUrl },
            { name: "instagramUrl", type: "text", validate: optionalHttpsUrl },
            { name: "telegramUrl", type: "text", validate: optionalHttpsUrl },
          ],
        },
        {
          label: "Address",
          fields: [
            {
              name: "address",
              type: "textarea",
              localized: true,
              admin: { description: "Public postal address. Localize it for each site language." },
            },
          ],
        },
      ],
    },
  ],
};
