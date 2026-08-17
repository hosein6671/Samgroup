/* THIS FILE IS THE PAYLOAD ADMIN SHELL. Generated from Payload's own template shape — it wires
 * Payload's root layout into this Next application and holds no project logic. Everything that is
 * actually ours lives in src/payload.config.ts and the collections beside it.
 */
import config from "@payload-config";
import { RootLayout, handleServerFunctions } from "@payloadcms/next/layouts";
import React from "react";

import { importMap } from "./admin/importMap.js";

import type { ServerFunctionClient } from "payload";

import "@payloadcms/next/css";

type Args = {
  readonly children: React.ReactNode;
};

const serverFunction: ServerFunctionClient = async function (args) {
  "use server";

  return handleServerFunctions({ ...args, config, importMap });
};

const Layout = ({ children }: Args): React.JSX.Element => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
);

export default Layout;
