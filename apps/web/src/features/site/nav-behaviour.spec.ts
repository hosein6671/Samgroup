import { describe, expect, it } from "vitest";

import { ACTIVE_LOCALE_CODES } from "@test/active-locales";

import {
  DRAWER_FOCUSABLE,
  firstFocusable,
  localeCookie,
  lockBackground,
  lockScroll,
  rememberLocale,
} from "./nav-behaviour";

import type { BackgroundNode, CookieJar, ScrollLockTarget } from "./nav-behaviour";

/**
 * The drawer's browser behaviour and the locale-preference cookie.
 *
 * ## What this file does and does not prove
 *
 * The runner is `environment: "node"` — no jsdom, no React Testing Library, and this gate may add
 * no dependency. These functions are therefore written over the smallest structural type each one
 * touches, and driven here with hand-built fakes: a real `HTMLElement` satisfies `BackgroundNode`,
 * `document.documentElement` satisfies `ScrollLockTarget`, and `document` satisfies `CookieJar`, so
 * what is asserted here is the same code path the browser runs.
 *
 * **It is still not a browser.** That `inert` genuinely removes a subtree from the tab order, that
 * a real `focus()` moves a caret, and that the panel is visible at 375px are properties of a user
 * agent, not of this algorithm, and are reported separately as runtime verification.
 */

/* ------------------------------------------------------------- fake elements */

type FakeNode = BackgroundNode & {
  name: string;
  children: FakeNode[];
  parentElement: FakeNode | null;
};

function node(name: string, children: FakeNode[] = []): FakeNode {
  const created: FakeNode = { name, inert: false, children, parentElement: null };

  for (const child of children) child.parentElement = created;

  return created;
}

/**
 * The real shape: `<body>` holds the skip link and the branded wrapper, and the wrapper holds the
 * header (which contains the drawer), the main content and the footer.
 */
function page(): { body: FakeNode; header: FakeNode; byName: (name: string) => FakeNode } {
  const header = node("header");
  const main = node("main");
  const footer = node("footer");
  const skipLink = node("skip-link");
  const root = node("flagship-root", [header, main, footer]);
  const body = node("body", [skipLink, root]);

  const all = [header, main, footer, skipLink, root, body];

  return {
    body,
    header,
    byName: (name) => all.find((element) => element.name === name)!,
  };
}

describe("lockBackground", () => {
  it("makes everything outside the header inert, at every level up to the body", () => {
    const { body, header, byName } = page();

    lockBackground(header, body);

    expect(byName("main").inert).toBe(true);
    expect(byName("footer").inert).toBe(true);
    // Outside the branded wrapper entirely — the root layout's skip link lives here.
    expect(byName("skip-link").inert).toBe(true);
  });

  it("never inerts the header, its ancestors or the body", () => {
    const { body, header, byName } = page();

    lockBackground(header, body);

    expect(header.inert).toBe(false);
    expect(byName("flagship-root").inert).toBe(false);
    expect(body.inert).toBe(false);
  });

  it("restores every node it changed, and only those", () => {
    const { body, header, byName } = page();

    // Something was already inert for its own reasons before the drawer opened.
    byName("footer").inert = true;

    const release = lockBackground(header, body);

    expect(byName("main").inert).toBe(true);

    release();

    expect(byName("main").inert).toBe(false);
    expect(byName("skip-link").inert).toBe(false);
    // Left as it was found — closing the drawer must not make something interactive that was not.
    expect(byName("footer").inert).toBe(true);
  });

  it("leaves no residue after repeated open/close cycles", () => {
    const { body, header, byName } = page();

    for (let i = 0; i < 3; i += 1) lockBackground(header, body)();

    for (const name of ["main", "footer", "skip-link", "flagship-root", "body"]) {
      expect(byName(name).inert).toBe(false);
    }
  });

  it("stops at a detached node instead of looping", () => {
    const orphan = node("orphan");

    expect(() => lockBackground(orphan, null)()).not.toThrow();
  });
});

describe("lockScroll", () => {
  it("locks the document and restores exactly what was there before", () => {
    const target: ScrollLockTarget = { style: { overflow: "scroll" } };

    const release = lockScroll(target);

    expect(target.style.overflow).toBe("hidden");

    release();

    expect(target.style.overflow).toBe("scroll");
  });

  it("restores an empty value rather than inventing one", () => {
    const target: ScrollLockTarget = { style: { overflow: "" } };

    lockScroll(target)();

    expect(target.style.overflow).toBe("");
  });
});

describe("firstFocusable", () => {
  it("takes the first candidate", () => {
    expect(firstFocusable(["a", "b"])).toBe("a");
  });

  it("answers null for an empty drawer rather than moving focus somewhere arbitrary", () => {
    expect(firstFocusable([])).toBeNull();
  });

  it("looks for links and enabled buttons, and not for disabled or removed-from-order controls", () => {
    expect(DRAWER_FOCUSABLE).toContain("a[href]");
    expect(DRAWER_FOCUSABLE).toContain("button:not([disabled])");
    expect(DRAWER_FOCUSABLE).toContain('[tabindex]:not([tabindex="-1"])');
  });
});

/* ------------------------------------------------------- the locale preference */

describe("localeCookie", () => {
  it("writes the ratified session cookie and nothing more", () => {
    expect(localeCookie("fa", false)).toBe("NEXT_LOCALE=fa; Path=/; SameSite=Lax");
  });

  it("adds Secure on HTTPS only", () => {
    expect(localeCookie("fa", true)).toBe("NEXT_LOCALE=fa; Path=/; SameSite=Lax; Secure");
  });

  it("sets no Max-Age, no Expires, no Domain and no HttpOnly", () => {
    for (const secure of [true, false]) {
      const cookie = localeCookie("ar", secure);

      expect(cookie).not.toContain("Max-Age");
      expect(cookie).not.toContain("Expires");
      expect(cookie).not.toContain("Domain");
      expect(cookie).not.toContain("HttpOnly");
    }
  });

  it("carries a locale code and no other data", () => {
    expect(localeCookie("en", false).split(";")[0]).toBe("NEXT_LOCALE=en");
  });
});

describe("rememberLocale", () => {
  it("writes only on an explicit choice from the active set", () => {
    const jar: CookieJar = { cookie: "" };

    expect(rememberLocale("fa", ACTIVE_LOCALE_CODES, jar, false)).toBe(true);
    expect(jar.cookie).toBe("NEXT_LOCALE=fa; Path=/; SameSite=Lax");
  });

  it("refuses a code the locale table does not have, and writes nothing", () => {
    const jar: CookieJar = { cookie: "" };

    expect(rememberLocale("de", ACTIVE_LOCALE_CODES, jar, false)).toBe(false);
    expect(rememberLocale("", ACTIVE_LOCALE_CODES, jar, false)).toBe(false);
    expect(jar.cookie).toBe("");
  });

  it("writes nothing when there is no jar — a server render never sets it", () => {
    expect(rememberLocale("fa", ACTIVE_LOCALE_CODES, null, false)).toBe(false);
  });

  it("touches no other cookie name — the Admin session cookies are not this module's", () => {
    const jar: CookieJar = { cookie: "" };

    rememberLocale("ar", ACTIVE_LOCALE_CODES, jar, true);

    expect(jar.cookie).not.toContain("sam_admin_access");
    expect(jar.cookie).not.toContain("sam_admin_refresh");
    expect(jar.cookie.startsWith("NEXT_LOCALE=")).toBe(true);
  });
});
