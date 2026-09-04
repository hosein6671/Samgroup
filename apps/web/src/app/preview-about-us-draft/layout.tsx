import type { Metadata } from "next";
import type { ReactNode } from "react";

import { FONT_VARIABLES } from "../fonts";

import "../globals.css";

/**
 * PERSISTENT DEV-ONLY VISUAL-VERIFICATION HARNESS. Not a public route, not linked from anywhere,
 * not in the sitemap. See `page.tsx` in this directory for the 404 gate and the reasoning.
 *
 * A root layout, on the same footing as `app/design-proof/layout.tsx`: the App Router resolves
 * the root layout positionally, `app/[locale]/layout.tsx` owns `<html>`/`<body>` for every
 * canonical route, and a page outside that segment needs its own root layout or Next.js scaffolds
 * a bare default with no fonts and no `globals.css`. Same font variables, same stylesheet,
 * `noindex` because this is not a public route even in the window it exists.
 */
export const metadata: Metadata = {
  title: "About Us — proposed copy (dev preview)",
  robots: { index: false, follow: false },
};

export default function PreviewAboutUsDraftLayout({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  return (
    <html lang="en" dir="ltr" className={FONT_VARIABLES}>
      <body>{children}</body>
    </html>
  );
}
