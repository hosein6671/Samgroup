"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { saveContent, uploadEditorialMedia } from "./actions";
import type { ReactNode } from "react";
export type EditorField = {
  name: string;
  label: string;
  type: string;
  hasMany?: boolean;
  fields?: EditorField[];
  options?: { label: string; value: string }[];
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
}: {
  schema: EditorField[];
  value: Record<string, unknown>;
  update: (value: Record<string, unknown>) => void;
  disabled: boolean;
  media: EditorialMedia[];
}): ReactNode {
  return schema.map((field) => {
    const current = value[field.name];
    const set = (next: unknown): void => update({ ...value, [field.name]: next });
    if (field.type === "array") {
      const rows = Array.isArray(current) ? current : [];
      return (
        <fieldset key={field.name} disabled={disabled}>
          <legend>{field.label}</legend>
          {rows.map((row, index) => (
            <div key={index}>
              <Fields
                schema={field.fields ?? []}
                value={object(row)}
                disabled={disabled}
                media={media}
                update={(next) => set(rows.map((item, i) => (i === index ? next : item)))}
              />
              <button type="button" onClick={() => set(rows.filter((_, i) => i !== index))}>
                Remove item {index + 1}
              </button>
            </div>
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
          <legend>{field.label}</legend>
          <Fields
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
            {field.label}
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
          {field.label}
        </label>
      );
    if (field.type === "select")
      return (
        <label key={field.name}>
          {field.label}
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
    if (field.type === "richText" || field.type === "textarea" || field.type === "stringArray")
      return (
        <label key={field.name}>
          {field.label}
          <textarea
            rows={6}
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
              Editing this field saves paragraphs as plain text; existing formatting is preserved
              until you edit it.
            </small>
          )}
        </label>
      );
    if (!["text", "email", "number", "date"].includes(field.type)) return null;
    return (
      <label key={field.name}>
        {field.label}
        <input
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
      </label>
    );
  });
}
export function ContentForm({
  pageKey,
  revision,
  operationId,
  schema,
  initial,
  resource = "company",
  media = [],
}: {
  pageKey: string;
  revision: string;
  operationId: string;
  schema: EditorField[];
  initial: Record<string, unknown>;
  resource?: "company" | "product" | "blog";
  media?: EditorialMedia[];
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
  return (
    <form action={action} className="ad-user-form ad-content-form">
      <input type="hidden" name="key" value={pageKey} />
      <input type="hidden" name="resource" value={resource} />
      <input type="hidden" name="fields" value={JSON.stringify(fields)} />
      <Fields
        schema={schema}
        value={fields}
        update={(next) => {
          setFields(next);
          setDirty(true);
        }}
        disabled={pending}
        media={media}
      />
      <div className="ad-content-actions">
        <button name="action" value="save-draft" disabled={pending}>
          Save draft
        </button>
        <button name="action" value="publish" disabled={pending}>
          Publish to website
        </button>
      </div>
      <p role="status" aria-live="polite">
        {pending ? "Saving…" : state.message}
      </p>
    </form>
  );
}
