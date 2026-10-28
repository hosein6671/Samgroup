import type { ReactNode } from "react";

import { translator } from "@/i18n/translate";

import { BidiText } from "../bidi-text";

import type { ProductEditorialSections } from "@sam-group/types";

const DOCUMENTS = [
  { code: "TDS", name: "Technical Data Sheet", note: "Properties, test methods and guidance" },
  { code: "SDS", name: "Safety Data Sheet", note: "Hazards, handling, storage and transport" },
  { code: "COA", name: "Certificate of Analysis", note: "Issued per batch, with its test results" },
] as const;

const FORMATS = ["Bulk", "Flexitank", "Drums", "IBC", "Pails & retail packs"] as const;
const INCOTERMS = "EXW · FOB · CFR · CIF";

/**
 * Questions beside documents and supply (redesign, 28 October 2026).
 *
 * The FAQ is native `<details>`, so it opens without JavaScript and every answer is in the page
 * for search engines. Documents are requested through the same Inquiry form the previous Technical
 * Documents section linked to; nothing here claims a file is attached. The supply formats and
 * Incoterms are the shared vocabulary every Family page already publishes.
 */
export function ProductFaqDocs({
  locale,
  dir,
  faq,
  editorialLocale,
  documentsHref,
  logisticsHref,
}: {
  readonly locale: string;
  readonly dir: "ltr" | "rtl";
  readonly faq: ProductEditorialSections["faq"];
  readonly editorialLocale: string | undefined;
  readonly documentsHref: string;
  readonly logisticsHref: string;
}): ReactNode {
  const t = translator(locale);
  const other = editorialLocale !== undefined && editorialLocale !== locale;

  return (
    <section className="fs-sec pd2-faqdocs" data-surface="light">
      <div className="fs-wrap pd2-faqdocs-grid">
        {faq.length > 0 && (
          <div id="faq">
            <h2 className="pd2-h2">{t("Questions")}</h2>
            <div
              className="pd2-faq"
              {...(other ? { lang: editorialLocale, dir: "auto" } : { dir })}
            >
              {faq.map((item, index) => (
                <details key={index} open={index === 0}>
                  <summary>
                    <BidiText text={item.question} dir={other ? "ltr" : dir} />
                  </summary>
                  <p>
                    <BidiText text={item.answer} dir={other ? "ltr" : dir} />
                  </p>
                </details>
              ))}
            </div>
          </div>
        )}

        <div id="documents">
          <h2 className="pd2-h2">{t("Documents & supply")}</h2>
          <ul className="pd2-docs">
            {DOCUMENTS.map((document) => (
              <li key={document.code}>
                <span className="pd2-doc-code" dir="ltr">
                  {document.code}
                </span>
                <span className="pd2-doc-text">
                  <span className="pd2-doc-name">{t(document.name)}</span>
                  <span className="pd2-doc-note">{t(document.note)}</span>
                </span>
                <a href={documentsHref}>{t("Request")}</a>
              </li>
            ))}
          </ul>
          <ul className="pd2-chips" aria-label={t("Supply formats")}>
            {FORMATS.map((format) => (
              <li key={format}>{t(format)}</li>
            ))}
            <li dir="ltr">{INCOTERMS}</li>
          </ul>
          <a className="pd2-link" href={logisticsHref}>
            {t("Export & Logistics")}
          </a>
        </div>
      </div>
    </section>
  );
}
