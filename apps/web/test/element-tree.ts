import type { ReactElement, ReactNode } from "react";

/**
 * Tools for asserting on what an async Server Component returned — its text, and its structure.
 *
 * ── Why a tree walk rather than a mounted DOM ──────────────────────────────
 *
 * These pages are async Server Components. React Testing Library mounts client trees and has no
 * good story for awaiting one of these, and `jsdom` would be a dependency bought for a handful of
 * assertions — one this gate is not permitted to add without approval. Awaiting the component and
 * reading what it returned is simpler and, for the properties these specs care about, **stricter**:
 * it inspects prop values as well as text, so a token smuggled into a `data-` attribute, a hidden
 * input or an `href` — places a DOM text query would never look — still fails a leak assertion.
 *
 * ── Function components are invoked, because otherwise nothing is asserted ──
 *
 * A page that returns `<InboxFrame><InboxEmpty …/></InboxFrame>` returns two *elements*, and their
 * markup lives inside the functions. Walking the element tree alone would find the page title and
 * conclude the empty state renders correctly no matter what it says. `expand` therefore calls each
 * function component with its props and splices the result in place — a shallow render, repeated,
 * which is exactly enough for a tree of sync Server Components that take props and return JSX.
 *
 * **An async component is not invoked**: it returns a promise, which a synchronous walk cannot
 * await. None exists below a page today; if one appears it becomes `null` here rather than being
 * faked, so a spec asserting on that subtree fails loudly rather than passing vacuously. A
 * component that throws is dropped the same way, so a missing mock cannot quietly take down an
 * assertion about something else.
 *
 * `next/link` is **not** a plain function component (it is a forwardRef object), so it survives
 * expansion as an element carrying its `href` — which is what the link assertions read. That is
 * deliberate: it keeps the specs independent of Link's internals.
 *
 * ── The shipped shell spec keeps its own copy ──────────────────────────────
 *
 * `app/(admin)/admin/page.spec.tsx` carries a simpler walker and predates this file; it is left as
 * it is rather than rewritten, because a passing shipped test is not worth touching to remove a
 * duplicate.
 */

type FunctionComponent = (props: Record<string, unknown>) => ReactNode;

/** One element of an expanded tree, in the shape the assertions need. */
export type TreeElement = {
  readonly type: unknown;
  readonly props: Record<string, unknown>;
};

function isElement(node: unknown): node is ReactElement<Record<string, unknown>> {
  return typeof node === "object" && node !== null && "props" in node && "type" in node;
}

/** The tree with every sync function component replaced by what it rendered. */
export function expand(node: ReactNode): ReactNode {
  if (Array.isArray(node)) {
    return node.map((child) => expand(child as ReactNode));
  }

  if (!isElement(node)) {
    return node;
  }

  const { type, props } = node as unknown as { type: unknown; props: Record<string, unknown> };

  if (typeof type === "function") {
    let rendered: ReactNode;

    try {
      rendered = (type as FunctionComponent)(props);
    } catch {
      return null;
    }

    // An async component hands back a promise this synchronous walk cannot resolve.
    return rendered instanceof Promise ? null : expand(rendered);
  }

  /*
   * A host element (or a Fragment): keep it, expand its children. The result is a plain object with
   * the same shape rather than a real React element — nothing here re-renders it, and asserting on
   * `type`/`props` is all these specs do — so it is cast back to `ReactNode` for the walkers.
   */
  return {
    ...(node as object),
    props: { ...props, children: expand(props.children as ReactNode) },
  } as unknown as ReactNode;
}

/** Every element of the expanded tree, in document order. */
export function elementsOf(node: ReactNode): TreeElement[] {
  const found: TreeElement[] = [];

  const walk = (current: ReactNode): void => {
    if (Array.isArray(current)) {
      for (const child of current) walk(child as ReactNode);

      return;
    }

    if (!isElement(current)) return;

    const { type, props } = current as unknown as {
      type: unknown;
      props: Record<string, unknown>;
    };

    found.push({ type, props });
    walk(props.children as ReactNode);
  };

  walk(expand(node));

  return found;
}

/** The host tag name (`"a"`, `"table"`, …), or `null` for a component element or a Fragment. */
export function tagOf(element: TreeElement): string | null {
  return typeof element.type === "string" ? element.type : null;
}

/** Every host element with the given tag. */
export function findTags(node: ReactNode, tag: string): TreeElement[] {
  return elementsOf(node).filter((element) => tagOf(element) === tag);
}

/**
 * Everything that navigates: a host `<a href>` and a `next/link` element alike, since both carry a
 * string `href` and both render as a link. Matching on the prop rather than on the component keeps
 * these assertions independent of how Link happens to be implemented.
 */
export function findLinks(node: ReactNode): TreeElement[] {
  return elementsOf(node).filter((element) => typeof element.props.href === "string");
}

/**
 * An element's accessible name, as far as this walker can determine it: an explicit `aria-label`,
 * otherwise the text it contains.
 *
 * It does not resolve `aria-labelledby`, and does not claim to be a full accessible-name
 * computation — it is enough to catch the failure these specs are looking for, which is a control
 * that has *no* name at all.
 */
export function accessibleName(element: TreeElement): string {
  const label = element.props["aria-label"];

  if (typeof label === "string") return label;

  return visibleTextOf(element.props.children as ReactNode);
}

export function collectStrings(node: ReactNode, found: string[] = []): string[] {
  if (typeof node === "string") {
    found.push(node);

    return found;
  }

  if (typeof node === "number") {
    found.push(String(node));

    return found;
  }

  if (Array.isArray(node)) {
    for (const child of node) collectStrings(child as ReactNode, found);

    return found;
  }

  if (isElement(node)) {
    const { props } = node as unknown as { props: Record<string, unknown> };

    for (const [key, value] of Object.entries(props)) {
      if (key === "children") continue;
      if (typeof value === "string") found.push(value);
    }

    collectStrings(props.children as ReactNode, found);
  }

  return found;
}

/**
 * Every string in the tree, joined and whitespace-collapsed — the usual subject of a `toContain`
 * assertion.
 *
 * The collapse matters: JSX splits `Page {page} of {pages}` into five separate text nodes, so a
 * naive join produces "Page  1  of  3" and an assertion written the way the sentence reads fails
 * for a reason that has nothing to do with the page. Collapsing runs of whitespace makes the
 * assertion match what a person would see rendered.
 */
export function textOf(node: ReactNode): string {
  return collectStrings(expand(node)).join(" ").replace(/\s+/g, " ").trim();
}

/** Whether an element is hidden from assistive technology. JSX yields "true" or true alike. */
function isAriaHidden(props: Record<string, unknown>): boolean {
  const hidden = props["aria-hidden"];

  return hidden === true || hidden === "true";
}

/**
 * Only the rendered text — element children, never prop values, and **never the contents of an
 * `aria-hidden` subtree**.
 *
 * That last exclusion is what makes this usable as an accessible-name approximation: a decorative
 * glyph wrapped in `aria-hidden` is not part of a control's name, and a helper that included it
 * would report "← Previous" where a screen reader announces "Previous" — and would therefore pass a
 * component that had forgotten the attribute.
 */
export function visibleTextOf(node: ReactNode): string {
  const found: string[] = [];

  const walk = (current: ReactNode): void => {
    if (typeof current === "string" || typeof current === "number") {
      found.push(String(current));

      return;
    }

    if (Array.isArray(current)) {
      for (const child of current) walk(child as ReactNode);

      return;
    }

    if (isElement(current)) {
      const { props } = current as unknown as { props: Record<string, unknown> };

      if (isAriaHidden(props)) return;

      walk(props.children as ReactNode);
    }
  };

  walk(expand(node));

  return found.join(" ").replace(/\s+/g, " ").trim();
}
