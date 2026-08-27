import type { ReactNode } from "react";

export type JsonLdPrimitive = boolean | number | string | null;
export type JsonLdValue = JsonLdPrimitive | JsonLdObject | readonly JsonLdValue[];
export type JsonLdObject = Readonly<{ [key: string]: JsonLdValue }>;

/** One safe renderer for every structured-data object on the public site. */
export function JsonLd({ data }: { readonly data: JsonLdObject }): ReactNode {
  const json = JSON.stringify(data).replace(/</gu, "\\u003c");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
