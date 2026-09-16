"use client";

import { useRef } from "react";

import type { ReactNode } from "react";

/**
 * The blog article body's editor — a plain `<textarea>` (still the field a no-JS submission
 * posts) with a toolbar that inserts Markdown syntax at the cursor.
 *
 * ── Why a toolbar over a textarea, and not a WYSIWYG library ─────────────────
 *
 * `BlogPost.content` stays plain Markdown source (`render-markdown.ts`'s module note explains why
 * on the read side). A rich-text editor component would produce its own internal model — HTML, a
 * ProseMirror/Lexical document — and require a second conversion step back to Markdown on save,
 * which is exactly the kind of translation layer that drifts from what it round-trips. Inserting
 * `**text**` into a textarea is not that: it IS the source, so what the editor sees typed is what
 * `render-markdown.ts` parses, with nothing in between.
 *
 * ── Progressive enhancement ───────────────────────────────────────────────────
 *
 * The toolbar is `"use client"` because it manipulates DOM selection, but the field submits
 * correctly with it entirely absent — a `<textarea name="content">` is the whole of the no-JS
 * form, exactly as every other field on this admin. The toolbar can only ever make typing faster,
 * never gate whether the form works.
 */

type Action =
  | { readonly kind: "wrap"; readonly before: string; readonly after: string }
  | { readonly kind: "line-prefix"; readonly prefix: string }
  | { readonly kind: "link" }
  | { readonly kind: "image" };

const BUTTONS: { readonly label: string; readonly title: string; readonly action: Action }[] = [
  { label: "B", title: "Bold", action: { kind: "wrap", before: "**", after: "**" } },
  { label: "I", title: "Italic", action: { kind: "wrap", before: "_", after: "_" } },
  { label: "H2", title: "Heading", action: { kind: "line-prefix", prefix: "## " } },
  { label: "H3", title: "Subheading", action: { kind: "line-prefix", prefix: "### " } },
  { label: "“”", title: "Quote", action: { kind: "line-prefix", prefix: "> " } },
  { label: "•", title: "Bulleted list", action: { kind: "line-prefix", prefix: "- " } },
  { label: "Link", title: "Insert link", action: { kind: "link" } },
  { label: "Image", title: "Insert image", action: { kind: "image" } },
];

/**
 * `window.prompt` itself, guarded: some embedded/automated browser contexts (this project has hit
 * it inside the in-app preview browser used to test this very field) disable `prompt()` and make it
 * throw rather than return `null` for a dismissed dialog. Both outcomes mean the same thing to a
 * toolbar action — "no value supplied" — so a throw is folded into that same `null`, rather than
 * left to escape the click handler and crash the surrounding form.
 */
function safePrompt(message: string): string | null {
  try {
    return window.prompt(message);
  } catch {
    return null;
  }
}

/** Every line the current selection touches, prefixed — a no-op on an empty selection's own line. */
function applyLinePrefix(value: string, start: number, end: number, prefix: string): string {
  const lineStart = value.lastIndexOf("\n", Math.max(start - 1, 0)) + 1;
  const lineEndIndex = value.indexOf("\n", end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const block = value.slice(lineStart, lineEnd);
  const prefixed = block
    .split("\n")
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
    .join("\n");

  return value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
}

function applyAction(
  textarea: HTMLTextAreaElement,
  action: Action,
  prompt: (message: string) => string | null,
): void {
  const { value, selectionStart: start, selectionEnd: end } = textarea;
  const selected = value.slice(start, end);

  if (action.kind === "wrap") {
    const next = value.slice(0, start) + action.before + selected + action.after + value.slice(end);

    textarea.value = next;
    textarea.setSelectionRange(start + action.before.length, end + action.before.length);
  } else if (action.kind === "line-prefix") {
    const next = applyLinePrefix(value, start, end, action.prefix);

    textarea.value = next;
    textarea.setSelectionRange(start, start + (next.length - value.length) + (end - start));
  } else if (action.kind === "link") {
    const url = prompt("Link URL (https://…)");

    if (!url) return;
    const label = selected || "link text";
    const markdown = `[${label}](${url})`;

    textarea.value = value.slice(0, start) + markdown + value.slice(end);
    textarea.setSelectionRange(start, start + markdown.length);
  } else {
    const url = prompt("Image URL — upload the image below first, then paste its URL here");

    if (!url) return;
    const alt = prompt("Descriptive alt text for this image") ?? "";
    const markdown = `![${alt}](${url})`;

    textarea.value = value.slice(0, start) + markdown + value.slice(end);
    textarea.setSelectionRange(start, start + markdown.length);
  }

  // A programmatic `.value` write does not fire `input`, and this field may be a React-managed
  // (defaultValue) uncontrolled textarea whose form data is read from the DOM node at submit
  // time regardless — but focus is still needed for the caret to land where setSelectionRange
  // put it, and dispatching `input` keeps any future controlled usage in sync for free.
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
}

/**
 * `id` is required and is placed on the `<textarea>` — the caller pairs it with a real
 * `<label htmlFor={id}>` outside this component, rather than this component wrapping itself in a
 * `<label>`. An implicit label around this whole block would associate a click with whichever
 * focusable element sits first inside it, which is a toolbar button, not the field.
 *
 * ── Controlled and uncontrolled, both ────────────────────────────────────────
 *
 * The "create new article" form (`new-blog-form.tsx`) is a plain server action form with no
 * external state — it passes `defaultValue` and lets the DOM own the value, same as every other
 * field there. The "edit existing article" admin (`content-form.tsx`) is a React-controlled form
 * that mirrors every field into `useState` so `JSON.stringify(fields)` can travel in a hidden
 * input — it passes `value`/`onChange` instead. Both are the same textarea contract React itself
 * supports, so one component serves both without either caller adapting to the other's shape.
 *
 * In controlled mode, a toolbar action mutates the DOM node directly (as it always has), then
 * reads `.value` back off that same node and hands it to `onChange` — rather than relying on the
 * dispatched `input` event to reach a controlled parent, which depends on React's internal value
 * tracking and is not something to build a form field's correctness on.
 */
export function MarkdownField({
  id,
  name,
  defaultValue,
  value,
  onChange,
  required,
  disabled,
  rows,
  maxLength,
}: {
  readonly id: string;
  readonly name: string;
  readonly defaultValue?: string;
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly rows?: number;
  readonly maxLength?: number;
}): ReactNode {
  const ref = useRef<HTMLTextAreaElement>(null);
  const controlled = value !== undefined;

  return (
    <div className="ad-markdown-field">
      <div className="ad-markdown-toolbar" role="toolbar" aria-label="Formatting">
        {BUTTONS.map((button) => (
          <button
            key={button.title}
            type="button"
            title={button.title}
            aria-label={button.title}
            disabled={disabled}
            onClick={() => {
              if (!ref.current) return;
              applyAction(ref.current, button.action, safePrompt);
              if (controlled) onChange?.(ref.current.value);
            }}
          >
            {button.label}
          </button>
        ))}
      </div>
      {controlled ? (
        <textarea
          id={id}
          ref={ref}
          name={name}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          required={required}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
        />
      ) : (
        <textarea
          id={id}
          ref={ref}
          name={name}
          defaultValue={defaultValue}
          required={required}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
        />
      )}
      <p className="ad-markdown-hint">
        Markdown: **bold**, _italic_, ## heading, [link](https://…), ![alt](image-url). Upload
        images below, then paste the URL here to place one inline.
      </p>
    </div>
  );
}
