"use client";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { saveContent, uploadEditorialMedia } from "./actions";
import { payloadRichTextEditable } from "../editor/payload-rich-text";
import { PayloadRichTextField } from "../editor/payload-rich-text-field";
import { RichField } from "../editor/rich-field";
import type { ReactNode } from "react";
import {
  EDITORIAL_HREF_HINT,
  inlinePlainText,
  validEditorialHref,
} from "@sam-group/types/structural-lists";
export type EditorField = {
  name: string;
  label: string;
  type: string;
  hasMany?: boolean;
  fields?: EditorField[];
  options?: { label: string; value: string }[];
  description?: string;
  /** A body-copy field: edited with the formatting toolbar (`STRUCTURAL_RICH_TEXT`). */
  rich?: boolean;
};
export type EditorialMedia = {
  id: number;
  alt: string;
  url: string;
  width: number | null;
  height: number | null;
};
function MediaUpload({
  disabled,
  onUploaded,
}: {
  disabled: boolean;
  onUploaded: (media: EditorialMedia) => void;
}): ReactNode {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <span className="ad-media-upload">
      <label>
        New image
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={disabled || pending}
        />
      </label>
      <label>
        Descriptive alt text
        <input type="text" name="alt" maxLength={300} disabled={disabled || pending} />
      </label>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={(event) => {
          const container = event.currentTarget.closest(".ad-media-upload");
          const image =
            container?.querySelector<HTMLInputElement>('input[name="image"]')?.files?.[0];
          const alt = container?.querySelector<HTMLInputElement>('input[name="alt"]')?.value ?? "";
          const data = new FormData();
          if (image) data.set("image", image);
          data.set("alt", alt);
          startTransition(async () => {
            const result = await uploadEditorialMedia(data);
            setMessage(result.message);
            if (result.media) onUploaded(result.media);
          });
        }}
      >
        {pending ? "Uploading…" : "Upload and select"}
      </button>
      <small role="status" aria-live="polite">
        {message}
      </small>
    </span>
  );
}
/**
 * A field's label as people read it: Payload falls back to the field name (`body`,
 * `who_we_are`) where no label was written, so underscores become spaces and the first letter is
 * capitalised.
 */
function labelOf(field: EditorField): string {
  const text = field.label.replaceAll("_", " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A plain text box sized to what it holds: two lines for a label, up to eight for a paragraph. */
function textRows(value: unknown): number {
  const text = Array.isArray(value) ? value.join("\n") : typeof value === "string" ? value : "";
  const lines = text
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 90)), 0);
  return Math.min(8, Math.max(2, lines + 1));
}

/** The words a list row is known by: its name, title or label, else the item it stands for. */
function rowTitle(row: Record<string, unknown>, schema: EditorField[], index: number): string {
  for (const key of ["name", "title", "label", "heading", "question", "term", "term_name"]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return inlinePlainText(value.trim());
  }
  const source = schema.find((field) => field.name === "source");
  const option = source?.options?.find((item) => item.value === row.source);
  if (option) return option.label;
  const first = schema.find((field) => typeof row[field.name] === "string" && row[field.name]);
  const text = first ? inlinePlainText(String(row[first.name])) : "";
  return text ? (text.length > 70 ? `${text.slice(0, 70)}…` : text) : `Item ${index + 1}`;
}

/** A small preview of the row's photograph, when it has one. */
function RowThumbnail({
  row,
  schema,
  media,
}: {
  row: Record<string, unknown>;
  schema: EditorField[];
  media: EditorialMedia[];
}): ReactNode {
  const field = schema.find((item) => item.type === "media");
  if (!field) return null;
  const value = row[field.name];
  const id =
    typeof value === "number"
      ? value
      : value && typeof value === "object" && "id" in value
        ? Number((value as { id: unknown }).id)
        : 0;
  const image = media.find((item) => item.id === id);
  return image ? (
    <img className="ad-row-thumb" src={image.url} alt="" width={40} height={28} />
  ) : null;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function plainText(value: unknown): string {
  const node = object(value);
  if (typeof node.text === "string") return node.text;
  if (node.root) return plainText(node.root);
  if (Array.isArray(node.children))
    return node.children.map(plainText).join(node.type === "root" ? "\n\n" : "");
  return "";
}
function lexical(text: string): unknown {
  return {
    root: {
      type: "root",
      version: 1,
      direction: null,
      format: "",
      indent: 0,
      children: text.split(/\n\s*\n/).map((value) => ({
        type: "paragraph",
        version: 1,
        direction: null,
        format: "",
        indent: 0,
        children: [
          {
            type: "text",
            version: 1,
            text: value,
            format: 0,
            detail: 0,
            mode: "normal",
            style: "",
          },
        ],
      })),
    },
  };
}
function Fields({
  schema,
  value,
  update,
  disabled,
  media,
  path = "field",
}: {
  schema: EditorField[];
  value: Record<string, unknown>;
  update: (value: Record<string, unknown>) => void;
  disabled: boolean;
  media: EditorialMedia[];
  /** Where these fields sit in the form, so ids stay unique across repeated list rows. */
  path?: string;
}): ReactNode {
  return schema.map((field) => {
    const current = value[field.name];
    const set = (next: unknown): void => update({ ...value, [field.name]: next });
    if (field.type === "array") {
      const rows = Array.isArray(current) ? current : [];
      const toggleAll = (event: { currentTarget: HTMLElement }, open: boolean): void => {
        event.currentTarget
          .closest("fieldset")
          ?.querySelectorAll<HTMLDetailsElement>(":scope > details.ad-row")
          .forEach((row) => {
            row.open = open;
          });
      };
      return (
        <fieldset key={field.name} disabled={disabled} className="ad-rows">
          <legend>{labelOf(field)}</legend>
          {rows.length > 1 && (
            <div className="ad-rows-tools">
              <button type="button" onClick={(event) => toggleAll(event, true)}>
                Open all
              </button>
              <button type="button" onClick={(event) => toggleAll(event, false)}>
                Close all
              </button>
            </div>
          )}
          {rows.map((row, index) => (
            // Collapsed to its title, so a list of ten items is ten lines, not ten screens.
            <details key={index} className="ad-row" open={rows.length === 1}>
              <summary>
                <RowThumbnail row={object(row)} schema={field.fields ?? []} media={media} />
                <span className="ad-row-title">
                  {rowTitle(object(row), field.fields ?? [], index)}
                </span>
              </summary>
              <div className="ad-row-body">
                <Fields
                  path={`${path}-${field.name}-${index}`}
                  schema={field.fields ?? []}
                  value={object(row)}
                  disabled={disabled}
                  media={media}
                  update={(next) => set(rows.map((item, i) => (i === index ? next : item)))}
                />
                <button
                  type="button"
                  className="ad-row-remove"
                  onClick={() => set(rows.filter((_, i) => i !== index))}
                >
                  Remove item {index + 1}
                </button>
              </div>
            </details>
          ))}
          <button type="button" onClick={() => set([...rows, {}])}>
            Add item
          </button>
        </fieldset>
      );
    }
    if (field.fields)
      return (
        <fieldset key={field.name} disabled={disabled}>
          <legend>{labelOf(field)}</legend>
          <Fields
            path={`${path}-${field.name}`}
            schema={field.fields}
            value={object(current)}
            disabled={disabled}
            media={media}
            update={set}
          />
        </fieldset>
      );
    if (field.type === "media") {
      const selectedId =
        typeof current === "number"
          ? current
          : current && typeof current === "object" && "id" in current
            ? Number((current as { id: unknown }).id)
            : 0;
      const selected = media.find((item) => item.id === selectedId);
      return (
        <div key={field.name} className="ad-media-field">
          <label>
            {labelOf(field)}
            <select
              value={selectedId || ""}
              disabled={disabled}
              onChange={(event) => set(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">No image</option>
              {media.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.alt}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <span className="ad-media-preview">
              <img src={selected.url} alt="" width={160} />
              <small>{selected.alt}</small>
            </span>
          )}
          <MediaUpload
            disabled={disabled}
            onUploaded={(uploaded) => {
              if (!media.some((item) => item.id === uploaded.id)) media.unshift(uploaded);
              set(uploaded.id);
            }}
          />
        </div>
      );
    }
    if (field.type === "checkbox")
      return (
        <label key={field.name}>
          <input
            type="checkbox"
            checked={current === true}
            disabled={disabled}
            onChange={(event) => set(event.target.checked)}
          />
          {labelOf(field)}
        </label>
      );
    if (field.type === "select")
      return (
        <label key={field.name}>
          {labelOf(field)}
          <select
            multiple={field.hasMany}
            value={
              field.hasMany
                ? Array.isArray(current)
                  ? current.map(String)
                  : []
                : typeof current === "string"
                  ? current
                  : ""
            }
            disabled={disabled}
            onChange={(event) =>
              set(
                field.hasMany
                  ? Array.from(event.target.selectedOptions, (option) => option.value)
                  : event.target.value,
              )
            }
          >
            {!field.hasMany && <option value="">Select</option>}
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    if (field.type === "markdown") {
      const fieldId = `field-${field.name}`;
      return (
        <div key={field.name}>
          <label htmlFor={fieldId}>{labelOf(field)}</label>
          <RichField
            id={fieldId}
            name={field.name}
            mode="document"
            disabled={disabled}
            value={typeof current === "string" ? current : ""}
            onChange={set}
          />
        </div>
      );
    }
    if (field.type === "textarea" && field.rich) {
      const fieldId = `${path}-${field.name}`;
      return (
        <div key={field.name} className="ad-field">
          <label htmlFor={fieldId}>{labelOf(field)}</label>
          <RichField
            id={fieldId}
            mode="inline"
            disabled={disabled}
            value={typeof current === "string" ? current : ""}
            onChange={set}
          />
        </div>
      );
    }
    if (field.type === "richText" && payloadRichTextEditable(current)) {
      const fieldId = `${path}-${field.name}`;
      return (
        <div key={field.name} className="ad-field">
          <label htmlFor={fieldId}>{labelOf(field)}</label>
          <PayloadRichTextField id={fieldId} value={current} onChange={set} disabled={disabled} />
        </div>
      );
    }
    if (field.type === "richText" || field.type === "textarea" || field.type === "stringArray")
      return (
        <label key={field.name}>
          {labelOf(field)}
          <textarea
            rows={textRows(current)}
            disabled={disabled}
            value={
              field.type === "stringArray"
                ? Array.isArray(current)
                  ? current.join("\n")
                  : ""
                : field.type === "richText"
                  ? plainText(current)
                  : typeof current === "string"
                    ? current
                    : ""
            }
            onChange={(event) =>
              set(
                field.type === "stringArray"
                  ? event.target.value.split("\n")
                  : field.type === "richText"
                    ? lexical(event.target.value)
                    : event.target.value,
              )
            }
          />
          {field.type === "richText" && (
            <small>
              This text uses formatting the visual editor cannot keep (an image, a block, underline
              or alignment). Editing it here saves paragraphs as plain text; existing formatting is
              preserved until you edit it.
            </small>
          )}
        </label>
      );
    if (!["text", "email", "number", "date"].includes(field.type)) return null;
    // A link field is checked as it is typed, against the same rule the CMS enforces on save.
    const badLink =
      field.name === "href" &&
      typeof current === "string" &&
      current.trim() !== "" &&
      !validEditorialHref(current.trim());
    return (
      <label key={field.name}>
        {labelOf(field)}
        <input
          placeholder={field.name === "href" ? "/en/products/engine-oils" : undefined}
          aria-invalid={badLink || undefined}
          disabled={disabled}
          type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
          value={typeof current === "string" || typeof current === "number" ? current : ""}
          onChange={(event) =>
            set(
              field.type === "number"
                ? event.target.value === ""
                  ? null
                  : Number(event.target.value)
                : event.target.value,
            )
          }
        />
        {field.description && <small>{field.description}</small>}
        {badLink && <small role="alert">This address is not allowed. {EDITORIAL_HREF_HINT}</small>}
      </label>
    );
  });
}
/** The "All sections" view. */
const ALL = "all";

type FormSection = {
  id: string;
  label: string;
  schema: EditorField[];
  read: (fields: Record<string, unknown>) => Record<string, unknown>;
  write: (
    fields: Record<string, unknown>,
    next: Record<string, unknown>,
  ) => Record<string, unknown>;
};

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The form split into the parts of the page it edits, for the section menu: each group (Hero,
 * Who we are, Photographs, SEO…) is one entry, each editable list is its own entry, and loose
 * top-level fields share a "General" entry. Every section still reads and writes the one form
 * value, so what is saved is unchanged.
 */
function formSections(schema: EditorField[]): FormSection[] {
  const general: EditorField[] = [];
  const sections: FormSection[] = [];
  for (const field of schema) {
    if (field.name === "lists" && field.fields) {
      for (const list of field.fields)
        sections.push({
          id: `list-${list.name}`,
          label: `${capitalise(list.label.replaceAll("_", " "))} (list)`,
          schema: [list],
          read: (fields) => object(fields.lists),
          write: (fields, next) => ({ ...fields, lists: next }),
        });
    } else if (field.fields || field.type === "array") {
      sections.push({
        id: field.name,
        label: capitalise(field.label.replaceAll("_", " ")),
        schema: [field],
        read: (fields) => fields,
        write: (_fields, next) => next,
      });
    } else general.push(field);
  }
  if (general.length)
    sections.unshift({
      id: "general",
      label: "General",
      schema: general,
      read: (fields) => fields,
      write: (_fields, next) => next,
    });
  return sections;
}

export function ContentForm({
  pageKey,
  revision,
  operationId,
  schema,
  initial,
  resource = "company",
  media = [],
  viewHref,
  locale,
}: {
  pageKey: string;
  revision: string;
  operationId: string;
  schema: EditorField[];
  initial: Record<string, unknown>;
  resource?: "company" | "product" | "blog";
  media?: EditorialMedia[];
  /** The public page this content appears on, opened from the action bar. */
  viewHref?: string;
  /** The locale being edited; absent edits the default locale, as before. */
  locale?: string;
}): ReactNode {
  const [fields, setFields] = useState(initial);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent): void => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  const [state, action, pending] = useActionState(saveContent, {
    message: "",
    saved: false,
    revision,
    operationId,
  });
  useEffect(() => {
    if (state.saved) setDirty(false);
  }, [state]);
  const update = (next: Record<string, unknown>): void => {
    setFields(next);
    setDirty(true);
  };
  const sections = useMemo(() => formSections(schema), [schema]);
  const [active, setActive] = useState<string>(ALL);
  // The open section follows the address (#section-hero), so a reload or a shared link lands on it.
  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#section-/, "");
    setActive(
      sections.some((section) => section.id === fromHash) ? fromHash : (sections[0]?.id ?? ALL),
    );
  }, [sections]);
  const choose = (id: string): void => {
    setActive(id);
    window.history.replaceState(null, "", `#section-${id}`);
    document.querySelector(".ad-content-main")?.scrollIntoView({ block: "start" });
  };
  const shown = active === ALL ? sections : sections.filter((section) => section.id === active);

  return (
    <form action={action} className="ad-user-form ad-content-form">
      <input type="hidden" name="key" value={pageKey} />
      <input type="hidden" name="resource" value={resource} />
      {locale !== undefined && <input type="hidden" name="locale" value={locale} />}
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />
      <div className={sections.length > 1 ? "ad-content-layout" : undefined}>
        {sections.length > 1 && (
          <nav className="ad-content-nav" aria-label="Page sections">
            <ul>
              {sections.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    aria-current={active === section.id ? "true" : undefined}
                    onClick={() => choose(section.id)}
                  >
                    {section.label}
                  </button>
                </li>
              ))}
              <li className="ad-content-nav-all">
                <button
                  type="button"
                  aria-current={active === ALL ? "true" : undefined}
                  onClick={() => choose(ALL)}
                >
                  All sections
                </button>
              </li>
            </ul>
          </nav>
        )}
        <div className="ad-content-main">
          {shown.map((section) => (
            <Fields
              key={section.id}
              path={`field-${section.id}`}
              schema={section.schema}
              value={section.read(fields)}
              update={(next) => update(section.write(fields, next))}
              disabled={pending}
              media={media}
            />
          ))}
        </div>
      </div>
      <div className="ad-content-actions">
        <button name="action" value="save-draft" disabled={pending}>
          Save draft
        </button>
        <button name="action" value="publish" disabled={pending}>
          Publish to website
        </button>
        {viewHref && (
          <a className="ad-content-view" href={viewHref} target="_blank" rel="noopener noreferrer">
            View page
          </a>
        )}
        <p role="status" aria-live="polite">
          {pending ? "Saving…" : state.message || (dirty ? "Unsaved changes" : "")}
        </p>
      </div>
    </form>
  );
}
