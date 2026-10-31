import type { ReactNode } from "react";

import { NotFoundPage } from "@/features/site/not-found-page";
import { getActiveLocales } from "@/lib/locales";

/** Every `notFound()` under `[locale]` renders here, inside the locale's layout. */
export default async function LocaleNotFound(): Promise<ReactNode> {
  const locales = await getActiveLocales().catch(() => []);
  return <NotFoundPage locales={locales} />;
}
