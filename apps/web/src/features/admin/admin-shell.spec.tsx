import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { findLinks, findTags, visibleTextOf } from "@test/element-tree";

import { ReviewFrame } from "./catalog/review/queue-views";
import { InboxFrame } from "./leads/inbox-frame";

import type { ReactNode } from "react";

/**
 * The neutral Admin shell, and the two areas that compose it.
 *
 * ## Why this file lives here
 *
 * It is the one place allowed to know about both Leads and Technical Review. They are siblings and
 * neither may import the other — a cross-feature comparison written inside either one would create
 * exactly the dependency the extraction removed. `features/admin/` is their common parent, it owns
 * `AdminShell` and `AdminNav`, and so it is where "both consumers agree" is asserted.
 *
 * ## What is pinned
 *
 * That there is **one** implementation of the Admin chrome, that both areas render it identically,
 * that each keeps its own heading and its own current navigation entry, and that the Leads output
 * did not move when the chrome did.
 */

vi.mock("@/features/admin/actions", () => ({ signOut: vi.fn() }));

const ADMIN = { email: "admin@samgp.com", role: "admin" };

describe("AdminShell — one implementation, two consumers", () => {
  it("puts Leads and Review inside the same shell", () => {
    const review = <ReviewFrame user={ADMIN}>{null}</ReviewFrame>;
    const leads = (
      <InboxFrame title="Inquiries" user={ADMIN} section="inquiries">
        {null}
      </InboxFrame>
    );

    for (const page of [review, leads]) {
      const main = findTags(page, "main")[0];
      expect(main?.props.id).toBe("main-content");
      expect(main?.props.className).toBe("ad-shell ad-shell--wide");
      expect(findTags(page, "h1")).toHaveLength(1);
      // The identity bar, the sign-out form and the module navigation, in every area.
      expect(visibleTextOf(page)).toContain("SAM Group Admin");
      expect(visibleTextOf(page)).toContain("Sign out");
      expect(findTags(page, "nav")).toHaveLength(1);
    }
  });

  it("gives each area its own h1 and its own current navigation entry", () => {
    const review = <ReviewFrame user={ADMIN}>{null}</ReviewFrame>;
    const leads = (
      <InboxFrame title="Inquiries" user={ADMIN} section="inquiries">
        {null}
      </InboxFrame>
    );

    expect(visibleTextOf(findTags(review, "h1")[0]?.props.children as ReactNode)).toBe(
      "Technical review",
    );
    expect(visibleTextOf(findTags(leads, "h1")[0]?.props.children as ReactNode)).toBe("Inquiries");

    const current = (page: ReactNode): string[] =>
      findLinks(page)
        .filter((link) => link.props["aria-current"] === "page")
        .map((link) => String(link.props.href));

    expect(current(review)).toEqual(["/admin/catalog/review"]);
    expect(current(leads)).toEqual(["/admin/leads/inquiries"]);
  });

  it("shows the same navigation from either area — Leads and Review as siblings", () => {
    const hrefs = (page: ReactNode): string[] =>
      findLinks(page).map((link) => String(link.props.href));

    expect(hrefs(<ReviewFrame user={ADMIN}>{null}</ReviewFrame>)).toEqual(
      hrefs(
        <InboxFrame title="Inquiries" user={ADMIN} section="inquiries">
          {null}
        </InboxFrame>,
      ),
    );
  });

  it("omits identity and navigation when the platform could not say who you are", () => {
    const page = <ReviewFrame user={null}>{null}</ReviewFrame>;

    expect(findTags(page, "nav")).toHaveLength(0);
    expect(visibleTextOf(page)).not.toContain("@");
    // The way out survives, so the page is not a dead end.
    expect(visibleTextOf(page)).toContain("Sign out");
  });

  it("renders one shell, not a shell inside a shell", () => {
    for (const page of [
      <ReviewFrame key="r" user={ADMIN}>
        {null}
      </ReviewFrame>,
      <InboxFrame key="l" title="Inquiries" user={ADMIN} section="inquiries">
        {null}
      </InboxFrame>,
    ]) {
      expect(findTags(page, "main")).toHaveLength(1);
      expect(findTags(page, "p").filter((p) => p.props.className === "ad-mark")).toHaveLength(1);
    }
  });
});

/* ========================================================================== */

describe("the areas stay siblings, and the chrome stays in one place", () => {
  const ADMIN_DIR = fileURLToPath(new URL(".", import.meta.url));

  function walk(directory: string, found: string[] = []): string[] {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path, found);
      else if (/\.tsx?$/.test(entry.name)) found.push(path);
    }
    return found;
  }

  /** Comments stripped, so a sentence naming the other feature is not read as an import. */
  const codeOf = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

  const sep = (): string => (join("a", "b").includes("\\") ? "\\" : "/");
  const inFeature = (path: string, feature: string): boolean =>
    path.includes(`${sep()}${feature}${sep()}`);

  const files = walk(ADMIN_DIR).map((path) => ({
    path,
    code: codeOf(readFileSync(path, "utf8")),
  }));

  /**
   * Implementations only. A spec that asserts on `.ad-bar` or on the navigation's accessible name
   * is describing the chrome, not rendering a second copy of it, and counting it as an owner would
   * make these checks fail the moment anyone tested the thing they protect.
   */
  const implementations = files.filter(({ path }) => !path.includes(".spec."));

  it("finds both features, so the checks below are not passing on an empty set", () => {
    expect(files.filter((file) => inFeature(file.path, "leads")).length).toBeGreaterThan(0);
    expect(files.filter((file) => inFeature(file.path, "review")).length).toBeGreaterThan(0);
  });

  /**
   * Neither sibling may reach into the other. This file is the deliberate exception — it is in the
   * neutral parent, not in either feature — and it is excluded by that same rule rather than by
   * name.
   */
  it("lets no feature import its sibling", () => {
    for (const { path, code } of files) {
      if (inFeature(path, "leads")) {
        expect(code, path).not.toMatch(/from\s+["'][^"']*catalog\/review/);
      }
      if (inFeature(path, "review")) {
        expect(code, path).not.toMatch(/from\s+["'][^"']*\/leads\//);
      }
    }
  });

  /**
   * One implementation of the chrome.
   *
   * `.ad-bar` is the identity bar, and it is the marker because it cannot be rendered by accident:
   * a second copy of the header would have to reproduce it. Only `admin-shell.tsx` may contain it,
   * and only this spec may mention it while checking that.
   */
  it("leaves no second implementation of the Admin bar", () => {
    const owners = implementations
      .filter(({ code }) => code.includes('"ad-bar"'))
      .map(({ path }) => path.split(sep()).pop());

    expect(owners).toEqual(["admin-shell.tsx"]);
  });

  /**
   * Same for the module navigation inside the Admin feature area: `admin-nav.tsx` renders it and
   * nothing else does.
   *
   * Scoped to `features/admin/`, which is what this walk covers. The dashboard route at
   * `app/(admin)/admin/page.tsx` renders its own module menu — a landing-page list of destinations
   * rather than the shell's inline navigation, and it does not compose `AdminShell` at all. The two
   * never appear on the same page. Folding them together would be a redesign of an unrelated Admin
   * page, which this gate is explicitly not doing.
   */
  it("leaves no second implementation of the module navigation", () => {
    const owners = implementations
      .filter(({ code }) => code.includes(`aria-label="Admin modules"`))
      .map(({ path }) => path.split(sep()).pop());

    expect(owners).toEqual(["admin-nav.tsx"]);
  });

  /** The shell and the navigation live in the neutral area, not inside either feature. */
  it("keeps AdminShell and AdminNav out of both features", () => {
    for (const name of ["admin-shell.tsx", "admin-nav.tsx"]) {
      const matches = implementations.filter(({ path }) => path.endsWith(name));

      expect(matches).toHaveLength(1);
      expect(inFeature(matches[0]?.path ?? "", "leads")).toBe(false);
      expect(inFeature(matches[0]?.path ?? "", "review")).toBe(false);
    }
  });
});
