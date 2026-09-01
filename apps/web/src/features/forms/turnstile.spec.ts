import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import {
  SECURITY_CHECK_UNAVAILABLE,
  TURNSTILE_LOAD_FAILED,
  TURNSTILE_SCRIPT_MARKER,
  TURNSTILE_SCRIPT_SRC,
  createTurnstileScriptLoader,
  isSubmitBlocked,
  mountTurnstile,
  turnstileInitialStatus,
  turnstileNeedsScript,
  turnstileNotice,
} from "./turnstile";

import type {
  TurnstileApi,
  TurnstileRenderOptions,
  TurnstileStatus,
  TurnstileWindow,
} from "./turnstile";

/**
 * The Turnstile lifecycle, against fakes.
 *
 * The runner is `environment: "node"` and neither `jsdom` nor React Testing Library may be added
 * without approval, which is exactly why the lifecycle was written as plain functions over injected
 * primitives. The document and Cloudflare's widget API are the two things this feature does not
 * own, so they are the two things faked; everything else below is the real code.
 *
 * The failures being guarded against are the ones that are invisible in review and total in effect:
 * a script loaded twice, a script never loaded again after one bad response, a widget left
 * registered after its container was discarded, and a spent token that is never replaced.
 */

/* ── the fake document ────────────────────────────────────────────────────── */

type FakeScript = {
  src: string;
  async: boolean;
  defer: boolean;
  readonly setAttribute: (name: string) => void;
  readonly addEventListener: (type: string, listener: () => void) => void;
  readonly remove: () => void;
  /** Whether the loader marked it as its own. */
  readonly marked: () => boolean;
  /** Deliver an event to whatever the loader registered. */
  readonly fire: (type: "load" | "error") => void;
  readonly removed: () => boolean;
};

type FakeDocument = {
  readonly doc: Document;
  /** Every script tag appended to `head`, in order. */
  readonly appended: FakeScript[];
  /** Put a tag in the document without going through the loader. */
  readonly preload: () => FakeScript;
};

function fakeDocument(): FakeDocument {
  const appended: FakeScript[] = [];

  function makeScript(): FakeScript {
    const listeners: Record<string, (() => void)[]> = {};
    const attributes = new Set<string>();
    let gone = false;

    return {
      src: "",
      async: false,
      defer: false,
      setAttribute: (name: string): void => {
        attributes.add(name);
      },
      addEventListener: (type: string, listener: () => void): void => {
        (listeners[type] ??= []).push(listener);
      },
      remove: (): void => {
        gone = true;
      },
      marked: (): boolean => attributes.has(TURNSTILE_SCRIPT_MARKER),
      fire: (type: "load" | "error"): void => {
        for (const listener of listeners[type] ?? []) listener();
      },
      removed: (): boolean => gone,
    };
  }

  const doc = {
    createElement: (): unknown => makeScript(),
    // The only selector this module uses is the marker one.
    querySelector: (): unknown =>
      appended.find((script) => script.marked() && !script.removed()) ?? null,
    head: {
      appendChild: (script: unknown): void => {
        appended.push(script as FakeScript);
      },
    },
  };

  return {
    doc: doc as unknown as Document,
    appended,
    preload: (): FakeScript => {
      const script = makeScript();

      script.setAttribute(TURNSTILE_SCRIPT_MARKER);
      appended.push(script);

      return script;
    },
  };
}

const SITE_KEY = "0x0000000000000000000000";

const API: TurnstileApi = {
  render: () => "widget-1",
  remove: () => undefined,
  reset: () => undefined,
};

describe("the script loads at most once per document", () => {
  it("requests Cloudflare's script in EXPLICIT render mode", async () => {
    const load = createTurnstileScriptLoader();
    const { doc, appended } = fakeDocument();
    const win: TurnstileWindow = {};

    const promise = load(doc, win);

    expect(appended).toHaveLength(1);
    expect(appended[0]?.src).toBe(`${TURNSTILE_SCRIPT_SRC}?render=explicit`);
    expect(appended[0]?.async).toBe(true);
    expect(appended[0]?.defer).toBe(true);
    expect(appended[0]?.marked()).toBe(true);

    win.turnstile = API;
    appended[0]?.fire("load");

    await expect(promise).resolves.toBe(API);
  });

  /**
   * Implicit rendering — `api.js` with no parameter — scans the document once, when it loads, and
   * never again. In an App Router application a form reached by client-side navigation arrives
   * after that scan, so no widget is ever created and every submission is silently refused. The
   * parameter above is the fix, and this is the assertion that keeps it.
   */
  it("never requests the implicit-rendering script", async () => {
    const load = createTurnstileScriptLoader();
    const { doc, appended } = fakeDocument();
    const win: TurnstileWindow = {};

    const promise = load(doc, win);

    expect(appended[0]?.src).not.toBe(TURNSTILE_SCRIPT_SRC);

    win.turnstile = API;
    appended[0]?.fire("load");
    await promise;
  });

  it("appends one tag for two concurrent callers, and resolves both", async () => {
    const load = createTurnstileScriptLoader();
    const { doc, appended } = fakeDocument();
    const win: TurnstileWindow = {};

    // Two forms on one page, mounting in the same tick.
    const first = load(doc, win);
    const second = load(doc, win);

    expect(appended).toHaveLength(1);

    win.turnstile = API;
    appended[0]?.fire("load");

    await expect(Promise.all([first, second])).resolves.toEqual([API, API]);
  });

  it("adds nothing once the API is already on the window", async () => {
    const load = createTurnstileScriptLoader();
    const { doc, appended } = fakeDocument();

    await expect(load(doc, { turnstile: API })).resolves.toBe(API);
    expect(appended).toHaveLength(0);
  });

  /**
   * A tag left in flight by an earlier mount — a client-side navigation away from a form page and
   * back to it, or a second loader instance. Running Cloudflare's script twice against one page is
   * what a second tag would do.
   */
  it("waits on a tag already in the document rather than adding a second", async () => {
    const load = createTurnstileScriptLoader();
    const { doc, appended, preload } = fakeDocument();
    const existing = preload();
    const win: TurnstileWindow = {};

    const promise = load(doc, win);

    expect(appended).toHaveLength(1);

    win.turnstile = API;
    existing.fire("load");

    await expect(promise).resolves.toBe(API);
  });
});

describe("when the script cannot be loaded", () => {
  it("rejects, and removes the dead tag so a later mount starts clean", async () => {
    const load = createTurnstileScriptLoader();
    const { doc, appended } = fakeDocument();

    const first = load(doc, {});

    appended[0]?.fire("error");

    await expect(first).rejects.toThrow(TURNSTILE_LOAD_FAILED);
    expect(appended[0]?.removed()).toBe(true);

    /*
     * The retry must append a NEW tag. Leaving the failed one in place would make every later
     * attempt attach listeners to a script that already fired and will never fire again — the form
     * would then wait for a token forever instead of reporting verification unavailable.
     */
    const win: TurnstileWindow = {};
    const second = load(doc, win);

    expect(appended).toHaveLength(2);

    win.turnstile = API;
    appended[1]?.fire("load");

    await expect(second).resolves.toBe(API);
  });

  /** A 200 that left no API behind: a blocked, rewritten or proxied script. */
  it("rejects when the load succeeds but no API appears", async () => {
    const load = createTurnstileScriptLoader();
    const { doc, appended } = fakeDocument();

    const promise = load(doc, {});

    appended[0]?.fire("load");

    await expect(promise).rejects.toThrow(TURNSTILE_LOAD_FAILED);
    expect(appended[0]?.removed()).toBe(true);
  });
});

/* ── the widget lifecycle ─────────────────────────────────────────────────── */

function spyApi(widgetId = "widget-1"): {
  readonly api: TurnstileApi;
  readonly render: ReturnType<typeof vi.fn>;
  readonly remove: ReturnType<typeof vi.fn>;
  readonly reset: ReturnType<typeof vi.fn>;
  readonly options: () => TurnstileRenderOptions;
} {
  const render = vi.fn(() => widgetId);
  const remove = vi.fn();
  const reset = vi.fn();

  return {
    api: { render, remove, reset } as unknown as TurnstileApi,
    render,
    remove,
    reset,
    options: (): TurnstileRenderOptions =>
      (render.mock.calls[0] as unknown as [unknown, TurnstileRenderOptions])[1],
  };
}

function events(): {
  readonly onToken: Mock<(token: string) => void>;
  readonly onExpired: Mock<() => void>;
  readonly onUnavailable: Mock<() => void>;
} {
  return {
    onToken: vi.fn((_token: string): void => undefined),
    onExpired: vi.fn((): void => undefined),
    onUnavailable: vi.fn((): void => undefined),
  };
}

describe("the widget is rendered invisibly, and owns no form field", () => {
  it("asks for the interaction-only appearance, never a visible challenge", () => {
    const spy = spyApi();

    mountTurnstile(spy.api, {}, "site-key", events());

    expect(spy.options().appearance).toBe("interaction-only");
    expect(spy.options().sitekey).toBe("site-key");
  });

  /**
   * Turnstile would otherwise inject its own `cf-turnstile-response` input into the enclosing form.
   * This application writes that field from the token it was handed, so the field exists exactly
   * while a token is held — and a spent token cannot be left behind in the DOM by a widget nobody
   * reset.
   */
  it("suppresses Cloudflare's own hidden input", () => {
    const spy = spyApi();

    mountTurnstile(spy.api, {}, "site-key", events());

    expect(spy.options()["response-field"]).toBe(false);
  });

  it("lets Turnstile refresh an expired token and retry a failed challenge on its own", () => {
    const spy = spyApi();

    mountTurnstile(spy.api, {}, "site-key", events());

    expect(spy.options()["refresh-expired"]).toBe("auto");
    expect(spy.options().retry).toBe("auto");
  });
});

describe("what the widget reports back", () => {
  it("hands a new token to onToken", () => {
    const spy = spyApi();
    const handlers = events();

    mountTurnstile(spy.api, {}, "site-key", handlers);
    spy.options().callback("the-token");

    expect(handlers.onToken).toHaveBeenCalledWith("the-token");
  });

  /** Both are the same fact to a form: there is no usable token, and one is on its way. */
  it("treats expiry and timeout alike", () => {
    const spy = spyApi();
    const handlers = events();

    mountTurnstile(spy.api, {}, "site-key", handlers);
    spy.options()["expired-callback"]();
    spy.options()["timeout-callback"]();

    expect(handlers.onExpired).toHaveBeenCalledTimes(2);
  });

  it("reports Cloudflare's own error as unavailable", () => {
    const spy = spyApi();
    const handlers = events();

    mountTurnstile(spy.api, {}, "site-key", handlers);
    spy.options()["error-callback"]();

    expect(handlers.onUnavailable).toHaveBeenCalledTimes(1);
  });
});

describe("resetting a spent token", () => {
  it("asks Turnstile for a new one", () => {
    const spy = spyApi("widget-7");

    mountTurnstile(spy.api, {}, "site-key", events()).reset();

    expect(spy.reset).toHaveBeenCalledWith("widget-7");
  });

  it("reports a reset that throws rather than swallowing it into a form that waits forever", () => {
    const handlers = events();
    const api = {
      render: () => "widget-1",
      remove: () => undefined,
      reset: () => {
        throw new Error("gone");
      },
    } as unknown as TurnstileApi;

    mountTurnstile(api, {}, "site-key", handlers).reset();

    expect(handlers.onUnavailable).toHaveBeenCalledTimes(1);
  });
});

describe("cleanup", () => {
  /**
   * Turnstile keeps its own registry of rendered widgets, independent of the DOM. Both forms
   * remount their whole subtree after every failed attempt, so a container is discarded and rebuilt
   * on the ordinary path — a widget left registered there is a leak on the common case, not a rare
   * one.
   */
  it("removes the widget from Turnstile's registry, not just from the page", () => {
    const spy = spyApi("widget-3");

    mountTurnstile(spy.api, {}, "site-key", events()).remove();

    expect(spy.remove).toHaveBeenCalledWith("widget-3");
  });

  it("is idempotent", () => {
    const spy = spyApi();
    const mount = mountTurnstile(spy.api, {}, "site-key", events());

    mount.remove();
    mount.remove();

    expect(spy.remove).toHaveBeenCalledTimes(1);
  });

  it("never throws, because unmount cleanup cannot be allowed to", () => {
    const api = {
      render: () => "widget-1",
      reset: () => undefined,
      remove: () => {
        throw new Error("already gone");
      },
    } as unknown as TurnstileApi;

    expect(() => {
      mountTurnstile(api, {}, "site-key", events()).remove();
    }).not.toThrow();
  });

  it("does not reset a widget it has already removed", () => {
    const spy = spyApi();
    const mount = mountTurnstile(spy.api, {}, "site-key", events());

    mount.remove();
    mount.reset();

    expect(spy.reset).not.toHaveBeenCalled();
  });
});

describe("when the widget cannot be created", () => {
  it("reports unavailable when render throws", () => {
    const handlers = events();
    const api = {
      render: () => {
        throw new Error("bad sitekey");
      },
      remove: () => undefined,
      reset: () => undefined,
    } as unknown as TurnstileApi;

    mountTurnstile(api, {}, "site-key", handlers);

    expect(handlers.onUnavailable).toHaveBeenCalled();
  });

  /** No widget means no token will ever arrive; the form must be told rather than left waiting. */
  it("reports unavailable when render answers no widget id", () => {
    const handlers = events();
    const remove = vi.fn();
    const reset = vi.fn();
    const api = {
      render: () => undefined,
      remove,
      reset,
    } as unknown as TurnstileApi;

    const mount = mountTurnstile(api, {}, "site-key", handlers);

    expect(handlers.onUnavailable).toHaveBeenCalledTimes(1);

    // Nothing was created, so there is nothing to reset or remove — and calling either must not
    // reach Turnstile with an id it never issued.
    mount.reset();
    mount.remove();

    expect(reset).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

/* ── the state machine ────────────────────────────────────────────────────── */

describe("which states may be submitted from", () => {
  it.each<[TurnstileStatus, boolean]>([
    ["unconfigured", false],
    ["ready", false],
    ["verifying", true],
    ["expired", true],
    ["unavailable", true],
    ["misconfigured", true],
  ])("blocked in %s: %s", (status, blocked) => {
    expect(isSubmitBlocked(status)).toBe(blocked);
  });

  /**
   * Exactly one state lets a submission through without a token, and it is the development default.
   * `misconfigured` — the same absent site key, in a production build — is the correction: it used
   * to be indistinguishable from `unconfigured`, so a production deployment that had never been
   * given a site key served two forms that looked ready, produced no token, and lost every
   * submission to the API's refusal.
   */
  it("blocks every state that has no token except the development no-op", () => {
    const withoutToken: TurnstileStatus[] = [
      "verifying",
      "expired",
      "unavailable",
      "misconfigured",
    ];

    expect(withoutToken.every(isSubmitBlocked)).toBe(true);
    expect(isSubmitBlocked("unconfigured")).toBe(false);
  });
});

/**
 * The configuration rule, which is where the production gap was.
 *
 * `production` is taken as an argument rather than read from `process.env` so these run without
 * mutating global state — Next inlines `NODE_ENV` into the client bundle at build time, so a test
 * that assigned to it would be proving something about the test, not about the build.
 */
describe("which state a form starts in", () => {
  it.each<[string, boolean, TurnstileStatus]>([
    [SITE_KEY, true, "verifying"],
    [SITE_KEY, false, "verifying"],
    ["", false, "unconfigured"],
    ["", true, "misconfigured"],
    ["   ", true, "misconfigured"],
    ["   ", false, "unconfigured"],
  ])("site key %j, production %s -> %s", (siteKey, production, expected) => {
    expect(turnstileInitialStatus(siteKey, production)).toBe(expected);
  });

  /** The correction, stated as the property rather than as a row. */
  it("never leaves a production form submittable without a site key", () => {
    for (const siteKey of ["", " ", "\t", "\n  "]) {
      expect(isSubmitBlocked(turnstileInitialStatus(siteKey, true))).toBe(true);
    }
  });

  it("keeps the development no-op for the same values", () => {
    for (const siteKey of ["", " ", "\t", "\n  "]) {
      expect(isSubmitBlocked(turnstileInitialStatus(siteKey, false))).toBe(false);
    }
  });
});

/**
 * Neither unconfigured state contacts Cloudflare.
 *
 * A production build missing its key must not fetch a third-party script to display an error it
 * already knows about, and a development environment with no key must make no third-party request
 * at all — which is the state the Privacy Policy draft currently describes.
 */
describe("when Cloudflare is contacted", () => {
  it.each([
    [SITE_KEY, true],
    ["", false],
    ["   ", false],
  ])("site key %j needs the script: %s", (siteKey, needed) => {
    expect(turnstileNeedsScript(siteKey)).toBe(needed);
  });
});

describe("what each state says", () => {
  it.each<TurnstileStatus>(["ready", "unconfigured"])("says nothing in %s", (status) => {
    expect(turnstileNotice(status)).toBeNull();
  });

  /** The two that resolve on their own wait for a pause; the two dead ends interrupt. */
  it.each<[TurnstileStatus, "status" | "alert"]>([
    ["verifying", "status"],
    ["expired", "status"],
    ["unavailable", "alert"],
    ["misconfigured", "alert"],
  ])("announces %s as role=%s", (status, role) => {
    expect(turnstileNotice(status)?.role).toBe(role);
  });

  it("explains every blocking state, so a disabled control always has a stated reason", () => {
    const blocking: TurnstileStatus[] = ["verifying", "expired", "unavailable", "misconfigured"];

    for (const status of blocking) {
      expect(turnstileNotice(status)?.text.length ?? 0).toBeGreaterThan(20);
    }
  });

  /**
   * A provider outage and a deployment missing its site key read identically to a visitor, and that
   * is deliberate: telling them apart would disclose which of the two it is, and the second is a
   * fact about our configuration that no visitor has any use for.
   */
  it("says the same thing whether the provider failed or we did", () => {
    expect(turnstileNotice("misconfigured")?.text).toBe(SECURITY_CHECK_UNAVAILABLE);
    expect(turnstileNotice("unavailable")?.text).toBe(SECURITY_CHECK_UNAVAILABLE);
  });

  /** A visitor learns neither the vendor nor anything about how this deployment is configured. */
  it("names no provider, token, captcha or configuration", () => {
    const blocking: TurnstileStatus[] = ["verifying", "expired", "unavailable", "misconfigured"];

    for (const status of blocking) {
      const text = turnstileNotice(status)?.text.toLowerCase() ?? "";

      for (const forbidden of [
        "turnstile",
        "cloudflare",
        "captcha",
        "token",
        "robot",
        "widget",
        "site key",
        "secret",
        "environment",
        "configur",
        "production",
        "next_public",
      ]) {
        expect(text).not.toContain(forbidden);
      }
    }
  });

  it("offers a way through when the check is a dead end", () => {
    expect(turnstileNotice("unavailable")?.text).toContain("contact us");
    expect(turnstileNotice("misconfigured")?.text).toContain("contact us");
  });
});
