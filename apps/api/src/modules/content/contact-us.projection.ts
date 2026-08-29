import type { ContactUsContent } from "@sam-group/types";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function httpsUrl(value: unknown): string | null {
  const candidate = text(value);
  if (candidate === null) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Allow-listed projection: Payload metadata and unapproved fields cannot cross the API boundary. */
export function toContactUsContent(doc: Record<string, unknown>): ContactUsContent | null {
  const content: ContactUsContent = {
    mainPhone: text(doc.mainPhone),
    salesPhone: text(doc.salesPhone),
    generalEmail: text(doc.generalEmail),
    salesEmail: text(doc.salesEmail),
    whatsappUrl: httpsUrl(doc.whatsappUrl),
    linkedinUrl: httpsUrl(doc.linkedinUrl),
    instagramUrl: httpsUrl(doc.instagramUrl),
    telegramUrl: httpsUrl(doc.telegramUrl),
    address: text(doc.address),
  };

  return Object.values(content).some((value) => value !== null) ? content : null;
}
