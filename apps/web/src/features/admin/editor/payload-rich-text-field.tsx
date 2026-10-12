"use client";

import { useMemo, useState, type ReactNode } from "react";

import { markdownToPayload, payloadToMarkdown } from "./payload-rich-text";
import { RichField } from "./rich-field";

/**
 * A Payload rich-text field in the visual editor. The stored value is read once into the editor's
 * Markdown, and every change is written back as Payload's own JSON (`markdownToPayload`), so what
 * Payload saves — and turns into the page's HTML — has the shape it always had, links included.
 * Only used for a value `payloadRichTextEditable` accepts; anything else keeps the plain view.
 */
export function PayloadRichTextField({
  id,
  value,
  onChange,
  disabled,
}: {
  readonly id: string;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
  readonly disabled?: boolean;
}): ReactNode {
  // Read once, when the field opens: the editor owns the text from then on.
  const initial = useMemo(() => payloadToMarkdown(value), []);
  const [markdown, setMarkdown] = useState(initial);
  return (
    <RichField
      id={id}
      mode="document"
      disabled={disabled}
      value={markdown}
      onChange={(next) => {
        setMarkdown(next);
        onChange(markdownToPayload(next));
      }}
    />
  );
}
