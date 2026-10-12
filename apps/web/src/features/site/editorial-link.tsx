import Link from "next/link";
import type { ReactNode } from "react";

import { editorialHrefKind } from "@sam-group/types/structural-lists";

/**
 * A link whose address an editor typed in /admin. One place decides how each kind opens:
 * - a page on this site goes through `next/link`, so it is a client-side navigation and plays the
 *   page transition;
 * - an https:// page elsewhere opens in a new tab, without handing it `window.opener`;
 * - an anchor, mailto: and tel: are plain links.
 * An address the shared rule (`editorialHrefKind`) does not accept renders no link at all — only
 * the content — so a bad value can never become a live `javascript:` or similar href.
 */
export function EditorialLink({
  href,
  className,
  children,
}: {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
}): ReactNode {
  const kind = editorialHrefKind(href);
  if (kind === null) return <span className={className}>{children}</span>;
  if (kind === "internal")
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  if (kind === "external")
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
