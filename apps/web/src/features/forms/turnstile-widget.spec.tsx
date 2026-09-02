import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findTags, textOf } from "@test/element-tree";

import { SubmitButton } from "./form-feedback";
import { SECURITY_CHECK_UNAVAILABLE, TURNSTILE_SCRIPT_SRC } from "./turnstile";
import { TurnstileWidget, type TurnstileGateState } from "./turnstile-widget";

import type { ReactNode } from "react";

/**
 * The challenge as a component, in all four of its configuration states.
 *
 * ── How this renders without a DOM ──────────────────────────────────────────
 *
 * `renderToStaticMarkup` from `react-dom/server`, which is part of the `react-dom` this app already
 * depends on — no `jsdom`, no React Testing Library, no new dependency. Hooks run; `useEffect` does
 * not, which is exactly right here: every property asserted below is about the markup a visitor
 * receives *before* any script could have run, and the first paint is precisely when a misconfigured
 * production form must already be refusing to send.
 *
 * The client-side lifecycle `useEffect` drives — loading, mounting, expiry, reset, cleanup — is
 * tested against fakes in `turnstile.spec.ts`.
 *
 * ── Why `production` is a prop ──────────────────────────────────────────────
 *
 * Next inlines `process.env.NODE_ENV` into the client bundle at build time, so it cannot be varied
 * at runtime, and a spec that assigned to it would be proving something about the spec rather than
 * about the build. `TurnstileWidget` therefore takes the answer as an argument with
 * `isProductionRuntime()` as its default — the same shape `siteKey` already had.
 */

/** Every element of the returned tree, without invoking function components. */
type RawElement = { type: unknown; props: Record<string, unknown> };

function rawElements(node: ReactNode, found: RawElement[] = []): RawElement[] {
  if (Array.isArray(node)) {
    for (const child of node) rawElements(child as ReactNode, found);

    return found;
  }

  if (typeof node !== "object" || node === null || !("props" in node)) return found;

  const element = node as unknown as RawElement;

  found.push({ type: element.type, props: element.props });
  rawElements(element.props.children as ReactNode, found);

  return found;
}

const SITE_KEY = "0x0000000000000000000000";

/** Stands in for the submit control the form passes as a child. */
function submitSlot(seen: TurnstileGateState[]): (gate: TurnstileGateState) => ReactNode {
  return (gate: TurnstileGateState): ReactNode => {
    seen.push(gate);

    return <button type="submit">Send</button>;
  };
}

/**
 * One rendered form, in the shape both real forms use: a field the visitor has typed into, then the
 * challenge wrapping the submit control.
 *
 * The typed value is not decoration. A blocked state that replaced the form with an error panel
 * would satisfy every other assertion here and still throw away everything the visitor had written,
 * so the markup is checked for that value as well as for the disabled control.
 */
function renderForm({
  siteKey,
  production,
  label = "Send enquiry",
}: {
  readonly siteKey: string;
  readonly production: boolean;
  readonly label?: string;
}): string {
  return renderToStaticMarkup(
    <form action={(): void => undefined}>
      <input name="companyName" defaultValue="Acme Lubricants" />
      <TurnstileWidget siteKey={siteKey} production={production}>
        {({ blocked, describedBy }) => (
          <div className="fm-actions">
            <SubmitButton
              label={label}
              pendingLabel="Sending…"
              blocked={blocked}
              describedBy={describedBy}
            />
            <p className="fm-required-note">Fields marked required must be completed.</p>
          </div>
        )}
      </TurnstileWidget>
    </form>,
  );
}

/** The submit button's `aria-describedby`, and the notice's id, so the two can be paired. */
function describedByOf(html: string): string | null {
  return /<button[^>]*\saria-describedby="([^"]+)"/.exec(html)?.[1] ?? null;
}

function noticeIdOf(html: string): string | null {
  return /<p class="fm-turnstile-note[^"]*" id="([^"]+)"/.exec(html)?.[1] ?? null;
}

/**
 * Cloudflare's script, and only Cloudflare's.
 *
 * React emits its own inline form-replay script whenever a `<form action>` is rendered, so a bare
 * "no script tags" assertion would fail for a reason with nothing to do with this feature.
 */
function loadsCloudflare(html: string): boolean {
  return html.includes(TURNSTILE_SCRIPT_SRC) || html.includes("challenges.cloudflare.com");
}

/* ────────────────────────────────────────────────────────────────────────────
   1 · Production with no site key — the state this component used to get wrong
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The correction, asserted from the markup a visitor would actually receive.
 *
 * Before it, a production build with no `NEXT_PUBLIC_TURNSTILE_SITE_KEY` rendered both forms exactly
 * as if no challenge existed: enabled, silent, and producing no token — so the API refused every
 * submission (403 with its secret set, 503 without) and the visitor lost a filled-in form to a
 * mistake that was entirely ours.
 */
describe("in production with no site key", () => {
  it.each(["", "   "])("disables the submit control for %j", (siteKey) => {
    const html = renderForm({ siteKey, production: true });

    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
  });

  it("explains why, assertively, in a live region", () => {
    const html = renderForm({ siteKey: "", production: true });

    expect(html).toContain('role="alert"');
    expect(html).toContain(SECURITY_CHECK_UNAVAILABLE);
    expect(html).toContain("fm-turnstile-note--alert");
  });

  /** A disabled control with an unexplained reason is the failure mode of the whole pattern. */
  it("points the disabled control at that explanation", () => {
    const html = renderForm({ siteKey: "", production: true });
    const describedBy = describedByOf(html);

    expect(describedBy).not.toBeNull();
    expect(describedBy).toBe(noticeIdOf(html));
  });

  /**
   * No third-party request to display an error we already know the answer to — and no container
   * waiting for a widget that is never coming.
   */
  it("loads no Cloudflare script and renders no widget container", () => {
    const html = renderForm({ siteKey: "", production: true });

    expect(loadsCloudflare(html)).toBe(false);
    expect(html).not.toContain('class="fm-turnstile"');
  });

  /** The form is blocked, not replaced. Everything typed into it is still there. */
  it("keeps the form and everything typed into it", () => {
    const html = renderForm({ siteKey: "", production: true });

    expect(html).toContain('value="Acme Lubricants"');
    expect(html).toContain('name="companyName"');
    expect(html).toContain("Fields marked required must be completed.");
  });

  /** Nothing a visitor reads may name the variable, the vendor, or the environment. */
  it("discloses nothing about the configuration", () => {
    const html = renderForm({ siteKey: "", production: true });

    for (const forbidden of [
      "NEXT_PUBLIC",
      "TURNSTILE",
      "Turnstile",
      "Cloudflare",
      "site key",
      "NODE_ENV",
      "production",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });

  /** The token field only ever exists alongside a real token, so there is none here to replay. */
  it("submits no token field", () => {
    expect(renderForm({ siteKey: "", production: true })).not.toContain("cf-turnstile-response");
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   2 · Outside production with no site key — the development no-op, unchanged
   ──────────────────────────────────────────────────────────────────────────── */

describe("outside production with no site key", () => {
  it.each(["", "   "])("leaves the submit control enabled for %j", (siteKey) => {
    const html = renderForm({ siteKey, production: false });

    expect(html).toMatch(/<button[^>]*type="submit"/);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it("says nothing, renders no container, and loads no script", () => {
    const html = renderForm({ siteKey: "", production: false });

    expect(html).not.toContain("fm-turnstile");
    expect(html).not.toContain(SECURITY_CHECK_UNAVAILABLE);
    expect(html).not.toContain('role="alert"');
    expect(loadsCloudflare(html)).toBe(false);
  });

  it("hands the form an unblocked gate with nothing to describe", () => {
    const seen: TurnstileGateState[] = [];

    TurnstileWidget({ siteKey: undefined, production: false, children: submitSlot(seen) });

    expect(seen).toHaveLength(1);
    expect(seen[0]?.blocked).toBe(false);
    expect(seen[0]?.describedBy).toBeUndefined();
  });

  /** Unconfigured means absent, not broken: the form's own markup still renders. */
  it("still renders whatever the form passed it", () => {
    const tree = TurnstileWidget({
      siteKey: undefined,
      production: false,
      children: submitSlot([]),
    });

    expect(findTags(tree, "button")).toHaveLength(1);
    expect(findTags(tree, "script")).toHaveLength(0);
    expect(textOf(tree)).not.toContain("JavaScript");
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   3 · Configured — the normal flow
   ──────────────────────────────────────────────────────────────────────────── */

describe("with a site key configured", () => {
  it.each([true, false])("starts verifying and blocked, alike in production=%s", (production) => {
    const html = renderForm({ siteKey: SITE_KEY, production });

    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
    expect(html).toContain("Checking your browser");
  });

  /**
   * Polite, not assertive: this state resolves on its own in a moment, and interrupting someone
   * mid-sentence to say "please wait" is worse than the wait.
   */
  it("announces the wait politely, and points the control at it", () => {
    const html = renderForm({ siteKey: SITE_KEY, production: true });

    expect(html).toContain('role="status"');
    expect(html).not.toContain("fm-turnstile-note--alert");
    expect(describedByOf(html)).toBe(noticeIdOf(html));
  });

  it("renders the container Turnstile will draw into, and tells a visitor without JavaScript", () => {
    const html = renderForm({ siteKey: SITE_KEY, production: true });

    expect(html).toContain('class="fm-turnstile"');
    expect(html).toContain("<noscript>");
    expect(html).toContain("requires JavaScript");
  });

  it("carries no token field until a token exists", () => {
    expect(renderForm({ siteKey: SITE_KEY, production: true })).not.toContain(
      'name="cf-turnstile-response"',
    );
  });

  it("delegates to the gate, carrying the trimmed key and the form's children", () => {
    const children = submitSlot([]);
    const tree = TurnstileWidget({ siteKey: `  ${SITE_KEY}  `, production: false, children });
    const gate = rawElements(tree).at(0);

    expect(gate).toBeDefined();
    expect(typeof gate?.type).toBe("function");
    expect(gate?.props.siteKey).toBe(SITE_KEY);
    expect(gate?.props.production).toBe(false);
    expect(gate?.props.children).toBe(children);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   4 · Both public forms
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Each form's own submit control, rendered through the challenge exactly as that form composes it.
 *
 * The source assertions further down prove the two forms use this composition; these prove the
 * composition blocks. Together they cover both controls without widening either form's props for
 * the benefit of a test.
 */
describe("both public submit controls take the blocked state", () => {
  const CONTROLS = [
    ["Inquiry", "Send enquiry"],
    ["Custom Formulation Request", "Submit request"],
  ] as const;

  it.each(CONTROLS)("%s is disabled in production with no site key", (_form, label) => {
    const html = renderForm({ siteKey: "", production: true, label });

    expect(html).toContain(label);
    expect(html).toMatch(/<button[^>]*\sdisabled=""/);
    expect(describedByOf(html)).toBe(noticeIdOf(html));
  });

  it.each(CONTROLS)("%s is enabled outside production with no site key", (_form, label) => {
    const html = renderForm({ siteKey: "", production: false, label });

    expect(html).toContain(label);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });
});

/**
 * The two properties the component cannot assert about itself, held at the source.
 *
 * Both are silent in review and total in effect. A widget rendered **outside** the `<form>` still
 * loads, still challenges, and still never reaches the server — `FormData` carries only what is
 * inside the element. A submit control rendered **outside** the widget is a control the challenge
 * cannot disable, which is the whole of what the client half does.
 */
describe("both public forms mount the challenge around their submit control", () => {
  const FORMS = [
    join(__dirname, "inquiry-form.tsx"),
    join(__dirname, "..", "customized-solutions", "sections", "custom-request-form.tsx"),
  ];

  /*
   * The `<form>` element now belongs to the shared wizard shell, so neither form file contains a
   * `</form>` to measure against and the original source-proximity check could no longer run.
   *
   * The property it protected has not changed and is still asserted, in two halves that together
   * say the same thing:
   *
   *   - each form hands its `TurnstileWidget` to the shell through `submitSlot`, and
   *   - the shell renders `submitSlot` inside its own `<form>`, on the review step.
   *
   * Splitting it this way is what the shared shell makes necessary, and it is also stricter than
   * the original: the second half is asserted once and therefore holds for every form that uses the
   * shell, including any added later.
   */
  it.each(FORMS)("%s hands TurnstileWidget to the shell as its submit slot", (file) => {
    const source = readFileSync(file, "utf8");
    const widget = source.indexOf("<TurnstileWidget>");
    const slot = source.indexOf("submitSlot={");

    expect(source).toContain("turnstile-widget");
    expect(slot).toBeGreaterThan(-1);
    expect(widget).toBeGreaterThan(slot);
  });

  it("the shell renders the submit slot inside its <form>", () => {
    const shell = readFileSync(join(__dirname, "wizard", "form-wizard.tsx"), "utf8");
    const openingForm = shell.indexOf("<form");
    const slot = shell.indexOf("{submitSlot}");
    const closingForm = shell.indexOf("</form>");

    expect(openingForm).toBeGreaterThan(-1);
    expect(slot).toBeGreaterThan(openingForm);
    expect(closingForm).toBeGreaterThan(slot);
  });

  it.each(FORMS)("%s renders its SubmitButton inside the widget", (file) => {
    const source = readFileSync(file, "utf8");
    const widget = source.indexOf("<TurnstileWidget>");
    const closingWidget = source.indexOf("</TurnstileWidget>");
    const button = source.indexOf("<SubmitButton");

    expect(button).toBeGreaterThan(widget);
    expect(button).toBeLessThan(closingWidget);
  });

  /** The reason has to reach the control, or the disabled state is unexplained. */
  it.each(FORMS)("%s passes both blocked and describedBy through", (file) => {
    const source = readFileSync(file, "utf8");

    expect(source).toContain("blocked={blocked}");
    expect(source).toContain("describedBy={describedBy}");
  });

  /**
   * Neither form may pin the configuration itself. Both read the environment through the component's
   * own defaults, or a deployment could end up blocked on one form and open on the other.
   */
  it.each(FORMS)("%s passes no configuration of its own", (file) => {
    const source = readFileSync(file, "utf8");

    expect(source).not.toContain("<TurnstileWidget siteKey");
    expect(source).not.toContain("<TurnstileWidget production");
  });
});

/**
 * Nothing in the browser bundle may carry the secret half.
 *
 * The site key is public and is meant to be rendered; the secret belongs to `apps/api` and to its
 * environment. A `NEXT_PUBLIC_` prefix on it would ship it to every visitor.
 */
describe("the two keys stay apart", () => {
  it("reads only the public site key from the environment", () => {
    const source = readFileSync(join(__dirname, "turnstile-widget.tsx"), "utf8");

    expect(source).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(source).not.toContain("TURNSTILE_SECRET_KEY");
  });

  it("puts no key in the module that the server action imports", () => {
    const source = readFileSync(join(__dirname, "turnstile.ts"), "utf8");

    expect(source).not.toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(source).not.toContain("TURNSTILE_SECRET_KEY");
  });
});
