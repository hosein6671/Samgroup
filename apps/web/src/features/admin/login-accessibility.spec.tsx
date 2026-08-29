import { describe, expect, it, vi } from "vitest";

import { accessibleName, elementsOf, findTags, tagOf, visibleTextOf } from "@test/element-tree";

import LoginPage from "@/app/(admin)/login/page";

import { LOGIN_MESSAGE } from "./login-state";

import type { LoginState } from "./login-state";
import type { ReactNode } from "react";

/**
 * `/login` against the **WCAG 2.2 AA** target.
 *
 * ## How a Client Component is rendered here
 *
 * `LoginForm` is a Client Component, and its only client-ness is two hooks: `useActionState` for
 * the Server Action result and `useFormStatus` for the pending state. Both are stubbed below so the
 * component can be called as the plain function it otherwise is, and the markup it returns can be
 * read. Nothing else about it is faked — the labels, the `autocomplete` values, the alert and the
 * submit control are the real ones.
 *
 * That is a deliberate alternative to mounting it: React Testing Library and a DOM environment
 * would be new dependencies, and adding either needs its own approval. Everything asserted here is
 * decidable from the returned tree, and what is not — focus order, focus visibility, whether the
 * alert is actually announced — was verified in a browser instead and is reported as such rather
 * than claimed here.
 */

const state: { current: LoginState } = { current: { status: "idle" } };

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: () => [state.current, vi.fn(), false],
}));

vi.mock("react-dom", () => ({ useFormStatus: () => ({ pending: false }) }));

vi.mock("./actions", () => ({ signIn: vi.fn() }));

function page(status: LoginState["status"] = "idle"): ReactNode {
  state.current = { status } as LoginState;

  return LoginPage();
}

describe("landmarks and headings", () => {
  it("has one main, and it is the skip link's target", () => {
    const mains = findTags(page(), "main");

    expect(mains).toHaveLength(1);
    expect(mains[0]?.props.id).toBe("main-content");
  });

  it("has exactly one h1, naming the screen", () => {
    const headings = findTags(page(), "h1");

    expect(headings).toHaveLength(1);
    expect(visibleTextOf(headings[0]?.props.children as ReactNode)).toBe("Admin sign-in");
  });

  it("skips no heading level", () => {
    const levels = elementsOf(page())
      .map((element) => tagOf(element))
      .filter((tag): tag is string => tag !== null && /^h[1-6]$/.test(tag))
      .map((tag) => Number(tag.slice(1)));

    expect(levels).toEqual([1]);
  });

  it("explains the real workspace without inventing a public capability", () => {
    const text = visibleTextOf(page());

    expect(text).toContain("Technical decisions, kept traceable.");
    expect(text).toContain("Catalog review");
    expect(text).toContain("Lead workflow");
    expect(text).toContain("Controlled access");
    expect(text).not.toMatch(/certificate|approval count|response time|available stock/i);
  });
});

describe("the form", () => {
  it("associates a real label with each field", () => {
    const labels = findTags(page(), "label");
    const inputs = findTags(page(), "input");

    expect(labels).toHaveLength(2);
    expect(inputs).toHaveLength(2);

    // `htmlFor` and `id` are the programmatic association — not proximity, and not a placeholder.
    for (const label of labels) {
      const target = inputs.find((input) => input.props.id === label.props.htmlFor);

      expect(target).toBeDefined();
    }

    expect(labels.map((label) => visibleTextOf(label.props.children as ReactNode))).toEqual([
      "Email address",
      "Password",
    ]);
  });

  /**
   * §1.3.5 Identify Input Purpose. `username`/`current-password` are the values a password manager
   * and an autofill implementation look for; anything else silently breaks both.
   */
  it("declares the sign-in autocomplete purposes", () => {
    const inputs = findTags(page(), "input");

    expect(inputs.map((input) => input.props.autoComplete)).toEqual([
      "username",
      "current-password",
    ]);
    expect(inputs.map((input) => input.props.type)).toEqual(["email", "password"]);
  });

  it("marks both fields required", () => {
    for (const input of findTags(page(), "input")) {
      expect(input.props.required).toBe(true);
    }
  });

  it("submits with a real button carrying a name", () => {
    const buttons = findTags(page(), "button");

    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.props.type).toBe("submit");
    expect(accessibleName(buttons[0]!)).toBe("Sign in");
  });

  /** No placeholder stands in for a label, and no label is hidden behind one. */
  it("uses no placeholder as a label substitute", () => {
    for (const input of findTags(page(), "input")) {
      expect(input.props.placeholder).toBeUndefined();
    }
  });
});

describe("the outcome banner", () => {
  it("renders nothing at all while idle — no empty live region to announce", () => {
    expect(
      elementsOf(page("idle")).filter((element) => element.props.role === "alert"),
    ).toHaveLength(0);
  });

  /**
   * The banner is *inserted* on failure rather than toggled with `hidden`, which is what makes a
   * `role="alert"` region announce. All three failures share one presentation and differ only in
   * words.
   */
  it.each(["invalid", "throttled", "unavailable"] as const)(
    "announces the %s failure through an alert",
    (status) => {
      const alerts = elementsOf(page(status)).filter((element) => element.props.role === "alert");

      expect(alerts).toHaveLength(1);
      expect(visibleTextOf(alerts[0]?.props.children as ReactNode)).toBe(LOGIN_MESSAGE[status]);
    },
  );

  /** Ordinary static copy is not announced: only the outcome carries a live-region role. */
  it("puts no live region on anything but the outcome", () => {
    const live = elementsOf(page("invalid")).filter(
      (element) => element.props["aria-live"] !== undefined,
    );

    expect(live).toHaveLength(0);
  });

  /**
   * A failed sign-in must not echo the password back into the markup — that would put a credential
   * in the rendered HTML, and the form deliberately keeps both fields uncontrolled.
   */
  it("echoes no submitted value back on failure", () => {
    for (const input of findTags(page("invalid"), "input")) {
      expect(input.props.defaultValue).toBeUndefined();
      expect(input.props.value).toBeUndefined();
    }
  });

  it("says nothing about which half of the credential was wrong", () => {
    const text = visibleTextOf(page("invalid")).toLowerCase();

    expect(text).toContain("invalid email or password");
    expect(text).not.toContain("no such user");
    expect(text).not.toContain("account does not exist");
  });
});
