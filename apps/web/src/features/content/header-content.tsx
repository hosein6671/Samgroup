"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { StructuralFields } from "@sam-group/types";
const HeaderContent = createContext<StructuralFields>({});
export function HeaderContentProvider({
  fields,
  children,
}: {
  fields: StructuralFields;
  children: ReactNode;
}): ReactNode {
  return <HeaderContent.Provider value={fields}>{children}</HeaderContent.Provider>;
}
export function useHeaderContent(): StructuralFields {
  return useContext(HeaderContent);
}
