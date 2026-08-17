/* Payload admin shell — see the note in ../../layout.tsx. */
import config from "@payload-config";
import { RootPage, generatePageMetadata } from "@payloadcms/next/views";

import { importMap } from "../importMap.js";

import type { Metadata } from "next";
import type React from "react";

type Args = {
  readonly params: Promise<{ segments: string[] }>;
  readonly searchParams: Promise<Record<string, string | string[]>>;
};

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams });

const Page = ({ params, searchParams }: Args): Promise<React.JSX.Element> =>
  RootPage({ config, importMap, params, searchParams });

export default Page;
