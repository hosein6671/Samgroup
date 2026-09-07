"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Native keyboard disclosure; viewport changes set the initial presentation. */
export function FilterDisclosure({ children }: { readonly children: ReactNode }): ReactNode {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const viewport = window.matchMedia("(min-width: 651px)");
    const sync = (): void => {
      if (ref.current) ref.current.open = viewport.matches;
    };
    sync();
    viewport.addEventListener("change", sync);
    return () => viewport.removeEventListener("change", sync);
  }, []);
  return (
    <details ref={ref} className="pf-filterbox" open>
      <summary>Refine your selection</summary>
      {children}
    </details>
  );
}
