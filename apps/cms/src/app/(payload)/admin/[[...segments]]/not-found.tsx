/* Payload admin shell — see the note in ../../layout.tsx. */
import config from "@payload-config";
import { NotFoundPage, generatePageMetadata } from "@payloadcms/next/views";

import { importMap } from "../importMap.js";

import type { Metadata } from "next";
import type React from "react";

type Args = {
  readonly params: Promise<{ segments: string[] }>;
  readonly searchParams: Promise<Record<string, string | string[]>>;
};

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams });

const NotFound = ({ params, searchParams }: Args): Promise<React.JSX.Element> =>
  NotFoundPage({ config, importMap, params, searchParams });

export default NotFound;
