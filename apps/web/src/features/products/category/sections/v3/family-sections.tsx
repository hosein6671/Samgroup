import { VisuallyHidden } from "@sam-group/ui";
import Image from "next/image";
import type { ReactNode } from "react";

import { Arrow } from "@/features/site/logo-mark";
import { ROUTES } from "@/features/site/site-routes";
import { formatCount, translator } from "@/i18n/translate";

import { actionHref } from "../../category-contract";
import { COLUMN_LABEL } from "../../family-matrix";
import { loadFamilyCatalog } from "../../family-data";

import type { ProductCategoryContent } from "../../category-contract";
import type { FamilyColumnKey } from "../../family-matrix";
import type { ProductFamily } from "../../../products-data";

/*
 * The redesigned Product Family page (owner-approved design, 28 October 2026): a dark hero with a
 * data summary, a sticky row of application groups, the family's products grouped by application
 * with their headline values, then quality, supply and documents as one compact row.
 */

type Props = {
  readonly content: ProductCategoryContent;
  readonly family: ProductFamily;
  readonly locale: string;
};

/* ---------------------------------------------------------------------------- hero */

export function FamilyHero({ content, family, locale }: Props): ReactNode {
  const t = translator(locale);
  const { hero } = content;
  return (
    <section className="fs-sec pf3-hero" data-surface="midnight">
      <div className="fs-blueprint" aria-hidden="true" />
      <span className="pf3-hero-ghost" aria-hidden="true" dir="ltr">
        {family.code}
      </span>
      <div className="fs-wrap pf3-hero-inner">
        <div className="pf3-hero-identity">
          <nav className="pf3-crumbs" aria-label={t("Breadcrumb")}>
            <ol>
              <li>
                <a href={`/${locale}${ROUTES.products}`}>{t("Products")}</a>
              </li>
              <li aria-current="page">{t(family.name)}</li>
            </ol>
          </nav>
          <h1 className="pf3-title">{t(family.name)}</h1>
          <p className="pf3-lead">{hero.headline}</p>
          <p className="pf3-sublead">{hero.lead}</p>
          <div className="pf3-actions">
            <a className="fs-btn fs-btn--gold" href="#catalogue">
              {t("Browse the products")}
              <Arrow />
            </a>
            <a className="fs-btn fs-btn--glass" href={actionHref(locale, hero.secondary.route)}>
              {hero.secondary.label}
            </a>
          </div>
        </div>
        <figure className="pf3-hero-media">
          {hero.image ? (
            <span className="pf3-hero-frame">
              <Image
                src={hero.image.src}
                alt={hero.image.alt}
                fill
                priority
                sizes="(max-width: 960px) calc(100vw - 40px), 40vw"
              />
            </span>
          ) : (
            <span className="pf3-hero-frame media-slot-empty" aria-hidden="true" />
          )}
        </figure>
      </div>
      <FamilySummary family={family} locale={locale} />
    </section>
  );
}

function spanText(column: FamilyColumnKey, span: { low: string; high: string }): string {
  return column === "pour_point" || span.low === span.high ? span.low : `${span.low}–${span.high}`;
}

/** The hero's data row: product count and the family-wide span of its headline properties. */
async function FamilySummary({
  family,
  locale,
}: {
  readonly family: ProductFamily;
  readonly locale: string;
}): Promise<ReactNode> {
  const catalog = await loadFamilyCatalog(family.id, locale);
  if (!catalog.ok || catalog.total === 0) return null;
  const t = translator(locale);
  const stats = catalog.columns.slice(0, 3).flatMap((column) => {
    const span = catalog.spans.get(column);
    return span ? [{ column, span }] : [];
  });
  return (
    <div className="fs-wrap">
      <ul className="pf3-stats">
        <li>
          <span className="pf3-stat-name">{t("Products")}</span>
          <span className="pf3-stat-value">{formatCount(locale, catalog.total)}</span>
          <span className="pf3-stat-note">
            {t("{count} publish typical values", { count: formatCount(locale, catalog.withData) })}
          </span>
        </li>
        {stats.map(({ column, span }) => (
          <li key={column}>
            <span className="pf3-stat-name">
              {column === "pour_point" ? t("Pour point, down to") : t(COLUMN_LABEL[column].label)}
            </span>
            <span className="pf3-stat-value" dir="ltr">
              {spanText(column, span)}
              {COLUMN_LABEL[column].unit !== null && (
                <span className="pf3-stat-unit">{COLUMN_LABEL[column].unit}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------- catalogue */

export async function FamilyCatalogue({
  family,
  locale,
}: Omit<Props, "content">): Promise<ReactNode> {
  const t = translator(locale);
  const catalog = await loadFamilyCatalog(family.id, locale);

  if (!catalog.ok) {
    return (
      <section className="fs-sec pf3-catalogue" id="catalogue" data-surface="light">
        <div className="fs-wrap">
          <p className="pf3-unavailable" role="status">
            {t("The product list is temporarily unavailable. Please try again shortly.")}
          </p>
        </div>
      </section>
    );
  }

  const grouped = catalog.sections.some((section) => section.group !== null);

  if (catalog.total === 0) {
    return (
      <section className="fs-sec pf3-catalogue" id="catalogue" data-surface="light">
        <div className="fs-wrap">
          <p className="pf3-unavailable" role="status">
            {t("No products are published in this family yet.")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      {grouped && (
        <nav className="pf3-groupnav" aria-label={t("Product groups")}>
          <div className="fs-wrap pf3-groupnav-inner">
            <span className="pf3-groupnav-label">{t("Machine")}</span>
            <ul>
              {catalog.sections.map((section) => (
                <li key={section.group?.slug ?? "other"}>
                  <a href={`#group-${section.group?.slug ?? "other"}`}>
                    {section.group?.name ?? t("Other products")}
                    <span className="pf3-groupnav-count">
                      {formatCount(locale, section.rows.length)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}

      <section className="fs-sec pf3-catalogue" id="catalogue" data-surface="light">
        <div className="fs-wrap">
          <header className="pf3-head">
            <div>
              <p className="fs-eyebrow">{t("In the catalogue")}</p>
              <h2 className="pf3-h2">
                {t("All {count} products", { count: formatCount(locale, catalog.total) })}
              </h2>
            </div>
            <div className="pf3-head-side">
              <a className="pf3-link" href={`/${locale}${ROUTES.productFinder}`}>
                {t("Compare in Product Finder")}
              </a>
              {catalog.columns.length > 0 && (
                <p className="pf3-head-note">
                  {t("Ranges span each product’s grades · typical values")}
                </p>
              )}
            </div>
          </header>

          <div className="pf3-groups">
            {catalog.sections.map((section) => (
              <div
                className="pf3-group"
                key={section.group?.slug ?? "other"}
                id={`group-${section.group?.slug ?? "other"}`}
              >
                {/* A family with no groups at all is one plain list: no "Other products" heading. */}
                {grouped && (
                  <div className="pf3-group-head">
                    <h3>{section.group?.name ?? t("Other products")}</h3>
                    <span>
                      {section.rows.length === 1
                        ? t("1 product")
                        : t("{count} products", {
                            count: formatCount(locale, section.rows.length),
                          })}
                    </span>
                  </div>
                )}
                <div className="pf3-table-box">
                  <table className="pf3-table">
                    <colgroup>
                      <col className="pf3-col-product" />
                      <col className="pf3-col-grades" />
                      {catalog.columns.map((column) => (
                        <col key={column} />
                      ))}
                      <col className="pf3-col-go" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">{t("Product")}</th>
                        <th scope="col">{t("Grades")}</th>
                        {catalog.columns.map((column) => (
                          <th scope="col" key={column}>
                            {t(COLUMN_LABEL[column].label)}{" "}
                            {COLUMN_LABEL[column].unit !== null && (
                              <span className="pf3-th-unit" dir="ltr">
                                {COLUMN_LABEL[column].unit}
                              </span>
                            )}
                          </th>
                        ))}
                        <th scope="col">
                          <VisuallyHidden>{t("Specifications")}</VisuallyHidden>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row) => {
                        const href = `/${locale}${ROUTES.products}/${row.slug}`;
                        return (
                          <tr key={row.id}>
                            <th scope="row">
                              <a className="pf3-product" href={href}>
                                <span className="pf3-thumb" aria-hidden="true">
                                  {row.image && (
                                    <Image src={row.image.url} alt="" width={48} height={48} />
                                  )}
                                </span>
                                <span className="pf3-product-text">
                                  <bdi className="pf3-product-name">{row.name}</bdi>
                                  {row.type !== null && (
                                    <span className="pf3-product-type">{t(row.type)}</span>
                                  )}
                                </span>
                              </a>
                            </th>
                            <td>
                              {row.grades.length > 0 ? (
                                <ul className="pf3-grades">
                                  {row.grades.slice(0, 3).map((grade) => (
                                    <li key={grade} dir="ltr">
                                      {grade}
                                    </li>
                                  ))}
                                  {row.grades.length > 3 && (
                                    <li className="pf3-grades-more" dir="ltr">
                                      +{row.grades.length - 3}
                                    </li>
                                  )}
                                </ul>
                              ) : (
                                <span className="pf3-muted">
                                  {row.hasData ? t("Single grade") : t("No published values yet")}
                                </span>
                              )}
                            </td>
                            {row.cells.map((cell, index) => (
                              <td key={catalog.columns[index]} className="pf3-num" dir="ltr">
                                {cell ?? "—"}
                              </td>
                            ))}
                            <td className="pf3-go">
                              <a href={href} tabIndex={-1} aria-hidden="true">
                                <Arrow size={14} />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function FamilyCatalogueSkeleton({ locale }: { readonly locale: string }): ReactNode {
  return (
    <section className="fs-sec pf3-catalogue" id="catalogue" data-surface="light" aria-busy="true">
      <div className="fs-wrap">
        <p className="pf3-muted">{translator(locale)("Loading products…")}</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- reference */

export function FamilyReference({ content, locale }: Omit<Props, "family">): ReactNode {
  const t = translator(locale);
  const { quality, supply, documentation, faq } = content;
  return (
    <>
      <section className="fs-sec pf3-reference" data-surface="light">
        <div className="fs-wrap pf3-cards">
          <article className="pf3-card pf3-card--dark">
            <p className="fs-eyebrow">{t("Quality")}</p>
            <h3>{quality.heading}</h3>
            <p>{quality.intro}</p>
            <ol className="pf3-stages">
              {quality.stages.map((stage) => (
                <li key={stage.id}>{stage.name}</li>
              ))}
            </ol>
          </article>
          <article className="pf3-card">
            <p className="fs-eyebrow">{t("Packaging & supply")}</p>
            <h3>{supply.heading}</h3>
            <ul className="pf3-chips">
              {supply.formats.map((format) => (
                <li key={format}>{format}</li>
              ))}
            </ul>
            <p>
              <span dir="ltr">{supply.incoterms.join(" · ")}</span>
            </p>
            <a className="pf3-link" href={actionHref(locale, supply.link.route)}>
              {supply.link.label}
            </a>
          </article>
          <article className="pf3-card">
            <p className="fs-eyebrow">{t("Documents")}</p>
            <h3>{documentation.heading}</h3>
            <ul className="pf3-docs">
              {documentation.documents.map((document) => (
                <li key={document.code}>
                  <span className="pf3-doc-code" dir="ltr">
                    {document.code}
                  </span>
                  <span>{document.label}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      {faq.length > 0 && (
        <section className="fs-sec pf3-faq" id="faq" data-surface="light">
          <div className="fs-wrap pf3-faq-inner">
            <h2 className="pf3-h2">{t("Questions")}</h2>
            <div className="pf3-faq-list">
              {faq.map((entry, index) => (
                <details key={entry.id} open={index === 0}>
                  <summary>{entry.question}</summary>
                  <p>{entry.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
