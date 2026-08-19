import { LoginForm } from "@/features/admin/login-form";

import type { ReactNode } from "react";

/**
 * `/login` — the Admin surface's sign-in page.
 *
 * ── The URL is frozen, and it is not `/admin/login` ─────────────────────────
 *
 * FRONTEND_ARCHITECTURE §1's route tree places `login/page.tsx` as a sibling of `admin/` inside the
 * `(admin)` group, and §2 names the pair as "`/admin/*` and `/login`". The group's parentheses keep
 * it out of the URL, so this file serves `/login`.
 *
 * ── It renders for anyone, signed in or not ─────────────────────────────────
 *
 * Middleware lets `/login` through without a session check — it has to, since every other branch
 * redirects here. An already-authenticated visitor is not bounced to `/admin`: answering that would
 * mean either trusting a decoded token claim, which this surface never does, or spending a
 * `GET /auth/me` on every login page view to answer a question nobody asked. The gate's smaller-is-
 * better instruction applies directly, and a signed-in operator who reaches this page can simply
 * navigate to `/admin`.
 *
 * ── Dynamic, never prerendered ──────────────────────────────────────────────
 *
 * `force-dynamic` is stated rather than inferred. The page has no dynamic API of its own — the form
 * is a Client Component and reads no cookie — so Next would happily prerender it into build output.
 * That is not wrong today, but a static auth page is one edit away from being a cached auth page,
 * and the whole surface is declared uncacheable on purpose. `revalidate = 0` says the same thing to
 * the other half of the caching machinery.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginPage(): ReactNode {
  return (
    <main className="ad-centre" id="main-content">
      <div className="ad-panel">
        <p className="ad-mark">SAM Group</p>
        <h1 className="ad-title">Admin sign-in</h1>
        <LoginForm />
      </div>
    </main>
  );
}
