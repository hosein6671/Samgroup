# ADR-012: Application Session Lifecycle and Account Status

## Status

Accepted, 19 August 2026. **§1 and §7 amended the same day, after security review** — see §7.

Closes the session-lifecycle deferral that [SECURITY.md](../SECURITY.md#authentication) and [API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md) §2.2a both recorded when the Identity & Access foundation shipped: `POST /auth/refresh` and `POST /auth/logout` were left unimplemented because _"'invalidate refresh token' needs server-side token state, and DATA_MODEL.md models no session or refresh-token entity"_, and account disable was left unbuilt because _"`User` has six fields and none of them expresses status"_. This ADR takes both decisions.

**No frozen architecture is changed.** ADR-002's database split, ADR-003's JWT ownership, ADR-004's argon2id and ADR-006's Payload separation all hold unchanged; this decision adds one table, one enum and one column to `sam_platform`, and resolves an ambiguity that [API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md) carried inside a single document.

## Context

### Four facts about this repository decided the outcome

1. **The access token is 15 minutes, carries `sub` and nothing else, and is resolved against `sam_platform` on every authenticated request.** That is what makes deleting a `User` revoke access on the next request rather than fifteen minutes later. Any session design has to keep that property rather than replace it.
2. **`GET /admin/users` was the only authenticated surface, and there is no frontend at all.** [SECURITY.md](../SECURITY.md#admin-dashboard-access) records why the Admin Dashboard could not be built first: _"An admin shell built on the access token alone would sign its user out every fifteen minutes with no recovery path — so cookie names, cookie attributes and the server-side refresh flow all have to be settled in the same gate that settles refresh-token persistence."_ This is that gate.
3. **`users` has six columns and no status.** Deleting the row was the only revocation that existed. "Disable this account" had no representation, and neither did the question of what disabling should mean for a token already issued.
4. **No browser ever calls NestJS.** [API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md) §1 states it — _"No browser-originated call ever reaches NestJS directly"_ — `apps/api`'s `main.ts` runs with `cors: false` because of it, and [FRONTEND_ARCHITECTURE.md](../frontend/FRONTEND_ARCHITECTURE.md) §11 routes every read through Server Components and every write through Server Actions. This is the fact that decides the cookie question, and it is a property of the architecture rather than a preference.

### The contradiction inside API_CONTRACT_FINAL

§2.2's table describes `POST /auth/login` as answering with an _"access token (body) + refresh token (httpOnly cookie)"_ and marks `POST /auth/refresh`'s auth as **Cookie**. §1 of the same document says no browser-originated call reaches NestJS.

Both cannot describe the same hop. A `Set-Cookie` emitted by NestJS lands on a Next.js server-side `fetch`, not on a browser; a browser's `Cookie` header never travels to NestJS at all. [SECURITY.md](../SECURITY.md#token-handling--a-clarification-that-follows-from-the-architecture) already noticed the tension and said so plainly — the token model _"assumed the common case of a browser calling an API directly. **This platform has no browser→NestJS calls at all**"_ — and concluded that both tokens live in httpOnly cookies read server-side by `apps/web`.

So §2.2 and §1 are not in conflict about _what the browser sees_. They are ambiguous about _which tier owns the cookie_, and that ambiguity had to be resolved before either endpoint could be written.

## Decision

### 1. Account status is a two-value enum: `active` and `disabled`

`UserStatus` (`user_status` in PostgreSQL) has exactly two labels. `User.status` is `NOT NULL DEFAULT 'active'`.

Semantics, complete:

| State      | Login   | Refresh | An access token already issued                    | Stored sessions                  |
| ---------- | ------- | ------- | ------------------------------------------------- | -------------------------------- |
| `active`   | allowed | allowed | valid until it expires                            | usable                           |
| `disabled` | refused | refused | **fails on the next authenticated request** (401) | **permanently revoked** — see §7 |

- **Refusal is never disclosed.** A disabled account answers `POST /auth/login` with the same 401, the same `UNAUTHENTICATED` code and the same `"Invalid email or password."` message as an unknown address or a wrong password — and the status check happens **after** the argon2 verification, so it is not distinguishable by timing either.
- **No endpoint writes `status`.** There is no disable endpoint, no `PATCH /admin/users/:id`, and no DTO field. Changing an account's status is a database operation until a user-management gate builds the surface for it.
- **Disabling revokes, permanently.** This bullet originally said the opposite — that rows merely became unusable and that re-enabling made them work again — and **that was rejected at security review**. §7 records what replaced it: a disable revokes every live session and advances a credential cutoff, and re-enabling restores neither.
- **`suspended`, `locked`, `pending` and a `deleted` soft-delete state are not members.** Nothing on this platform distinguishes them, and an enum label with no behaviour behind it reads as a promise to the next implementer. Deleting a `User` row remains a real delete and remains the strongest revocation.

### 2. `apps/web` owns the browser cookie; NestJS owns the token

```
Browser  ──HttpOnly cookie──▶  apps/web  ──raw token in the request body──▶  NestJS
```

- **NestJS sets no cookie, reads no cookie, and clears no cookie.** No cookie parser is a dependency of `apps/api`, and none may become one.
- **The raw refresh token crosses the internal hop as a body value** — `{ "refreshToken": "…" }` on `POST /auth/refresh` and `POST /auth/logout`. That hop is server-to-server behind one origin ([ADR-005](./ADR-005-vps-docker-deployment.md), [DEVOPS.md](../DEVOPS.md#public-routing)) and never reaches browser JavaScript.
- **§2.2's "httpOnly cookie" remains true of the browser**, which is the only place a cookie exists. §2.2's **Cookie** auth marker describes the same browser-visible fact, not a `Cookie` header arriving at NestJS.
- **Cookie name, `SameSite`, `Secure`, `Path` and `Max-Age` are `apps/web`'s to fix**, in the frontend session gate, because that is the tier that issues them. Deciding them here would have been deciding them for a tier that does not yet exist.

### 3. Refresh tokens are opaque, and only their digest is stored

- **Generated** as 32 bytes (256 bits) from `randomBytes`, base64url-encoded — 43 characters, no `+`, `/` or `=`.
- **Persisted** as `sha256(token)` in lowercase hex, 64 characters, under a unique index. The raw token is never written to any column.
- **Not a JWT.** A self-validating refresh token would need a revocation list to be revocable — which is the table this design already has, minus the benefit.
- **Not argon2id.** That is the platform's _password_ hash and stays so. Its cost exists to slow the guessing of human-chosen secrets; this value is 256 bits from a CSPRNG, so there is nothing to slow down. More decisively, argon2's per-hash salt is not deterministic, and the digest here **is a lookup key** — a salted hash could not be one without scanning every row.

### 4. Rotation, with a single winner guaranteed by the database

A successful `POST /auth/refresh` revokes the presented session and creates exactly one replacement, **in one transaction**. The claim is a conditional `UPDATE`:

```sql
UPDATE auth_sessions SET revoked_at = now
 WHERE token_hash = … AND revoked_at IS NULL AND expires_at > now AND <user is active>
```

and the rotation proceeds only if it reports exactly one affected row.

Under PostgreSQL's READ COMMITTED, a second transaction reaching the same row blocks on the first's lock and, when the first commits, **re-evaluates its own `WHERE` clause against the new row version** — in which `revoked_at` is set. It therefore matches nothing and fails. Two concurrent refreshes of one token produce one success, one generic 401, and one replacement session. **No advisory lock, no in-process mutex and no Redis**, which also means the guarantee does not depend on there being one container.

The account check is a relation filter _inside_ that same `UPDATE`, so a disabled account cannot win the claim rather than being rejected after winning it.

### 5. Logout revokes one session and does not blacklist anything

`POST /auth/logout` is authenticated (§2.2's **A**) **and** carries the raw refresh token. The access token says who is asking; the refresh token says which session to end. Revocation is scoped to the authenticated `userId`, so presenting another account's token revokes nothing.

It answers **204** and is idempotent: a second logout, an already-rotated token and a stranger's token all answer identically, because reporting the difference would disclose whether a token the caller holds is live elsewhere.

**The access token is not invalidated and no deny-list exists.** It stays valid for the remainder of its fifteen minutes. Keeping a deny-list would mean persisting every access token ever issued to answer a question that expires on its own — and the platform already has a stronger answer for the case that matters: disabling or deleting the account fails the very next request.

### 6. Refresh-token family reuse detection is deferred

Replaying an already-rotated token answers the generic 401 and nothing else happens. No `familyId`, no `parentId`, no `replacedById`, no lineage table and no revoke-all-descendants logic — none of it is in the schema, because no document freezes the semantics and a half-modelled version would be worse than an absent one. Its own gate.

## Consequences

- **A session now lasts seven days**, renewed every fifteen minutes, instead of ending after fifteen. The frontend session gate is unblocked — [SECURITY.md](../SECURITY.md#implementation-status--none-of-this-is-built)'s stated blocker was precisely this.
- **Revocation exists in three strengths**: logout (one session), disable (all of an account's access, reversibly), delete (everything, permanently). All three take effect on the next request.
- **`auth_sessions` grows and is never swept.** Revoked and expired rows are retained; there is no cleanup job, because a row is small, the table is bounded by staff headcount, and inventing a retention policy is a decision [SECURITY.md](../SECURITY.md#data-retention)'s retention section should take rather than this one.
- **A stolen refresh token is usable until it is rotated or expires.** Rotation limits the window and makes the theft eventually visible (the legitimate holder is logged out), but without family reuse detection nothing actively detects it. Accepted, and named.
- **`GET /admin/users` now serves `status`.** It is the one surface where the field is not a constant. It remains read-only.
- **Two endpoints are outside every rate-limit bucket.** §Rate limits budgets seven groups and refresh is in none of them; login keeps 5 per 15 minutes, form submissions keep 5 per hour, and the two budgets stay isolated from each other and from the new routes.

## Alternatives Considered

**JWT refresh tokens, stateless.** Rejected: revoking one requires server-side state, so the table reappears with none of the simplicity, and a leaked signing key would mint unlimited refresh tokens rather than fifteen-minute ones.

**Refresh-token fields on `User` (`refreshTokenHash`, `refreshExpiresAt`).** Rejected: one column pair means one session, so signing in on a second machine silently signs you out of the first — a behaviour nothing in this platform contracts, presented as a schema accident.

**argon2id for the refresh-token digest.** Rejected on both correctness and performance: the per-hash salt makes an indexed lookup impossible, and the work factor buys nothing against a 256-bit CSPRNG value.

**NestJS emits `Set-Cookie` and parses the `Cookie` header.** Rejected as contradicting [API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md) §1: the cookie would be set on a server-side `fetch` rather than on a browser, `apps/web` would have to forward and re-emit it anyway, and `apps/api` would gain a cookie dependency to serve a client it never talks to.

**A `SELECT … FOR UPDATE` then `UPDATE` for rotation.** Rejected as strictly weaker than the conditional `UPDATE` while being more code: it needs the same transaction, takes the same lock, and adds a round trip — and it invites the check-then-act shape the conditional form makes impossible.

**An access-token deny-list, so logout is immediate.** Rejected: it would require persisting every issued access token, and it duplicates a revocation the account-status check already performs on the next request.

**A richer status vocabulary now** (`suspended`, `locked`, `pending`). Rejected: no behaviour in this platform distinguishes them, and unused enum labels are read as commitments. Adding a third is a migration and a decision, which is the point.

---

## 7. Amendment, 19 August 2026 — disable is revocation, not suspension

### What was wrong

§1 as first accepted made `disabled` a **gate**: every authentication path re-read the account and refused while the status said so. Nothing was invalidated. Re-enabling the account therefore brought back every credential minted before the disable — an unexpired 15-minute access token and a 7-day refresh session alike.

That makes "we disabled that account" mean _paused_, not _revoked_. An account disabled in response to a suspected credential theft would hand the stolen credential straight back the moment it was switched on again, and the operator who disabled it would have no way to know. Security review rejected it, and this section replaces it.

### The rule

**`active → disabled` permanently invalidates every credential issued at or before that moment.**

`disabled → active` restores the ability to authenticate with a password and to be issued **new** credentials. It restores nothing that was already issued — not a refresh session, not an access token whose `exp` is still in the future.

### The mechanism: one nullable column and two triggers

`users.credentials_revoked_at` (`TIMESTAMPTZ`, nullable). NULL means no credential has ever been revoked for this account, which is how every user is created.

1. **`users_credential_revocation_guard`** — `BEFORE UPDATE FOR EACH ROW`. On `active → disabled` it stamps the column with `clock_timestamp()`. It also enforces **monotonicity**: the value can never be cleared and never moved backwards, so re-enabling leaves it exactly where the disable put it and no later `UPDATE` — from a future endpoint, a migration, or a hand-typed `psql` line — can revive a credential by rewinding it.
2. **`users_revoke_sessions_on_disable`** — `AFTER UPDATE FOR EACH STATEMENT` with transition tables, following the ADR-011 convention. It revokes every unrevoked `auth_sessions` row belonging to a user that transitioned, in the same transaction as the status change.

The guard then requires, on every authenticated request:

    credentials_revoked_at IS NULL  OR  credentials_revoked_at < to_timestamp(iat)

### Why the database and not the application

**There is no status-management endpoint.** Every status transition today is a direct `UPDATE` — from `psql`, from a script, from a future admin API nobody has written. An invariant living in a NestJS service would be enforced on none of the paths that actually perform the transition, and would be bypassed by this gate's own verification. Same position ADR-011 took and the privacy-policy-version immutability trigger implements: durable invariants belong to the database; application validation is for message quality.

### `iat`, not `jti`

The frozen claim set (`sub`, `iat`, `exp`) is unchanged. `iat` already says when a token was minted, which is the only fact the cutoff needs — **no `jti`, no `status` claim, no session id in the token**. A per-token identifier would need a table of every issued access token to check against, which is exactly the deny-list §5 refuses to keep. One nullable column revokes every token an account holds, at once.

### Second-resolution boundary

`iat` is whole seconds; the cutoff is microsecond-precision. The comparison above rejects a token whenever its `iat` second is **at or before** the second the revocation happened, so the rounding always resolves against the token and never in its favour. The cost is bounded and stated: if an account were disabled and re-enabled inside one second, a token minted in that same second would also be refused. It costs one retry and self-heals on the next tick.

`clock_timestamp()` rather than `now()` is load-bearing: `now()` is transaction _start_ time, so a transaction that opened at 12:00:00 and disabled at 12:00:09 would stamp 12:00:00 and let a token minted at 12:00:05 survive.

### Consequences

- `auth_sessions` rows are revoked, never deleted, so a disable leaves an auditable record rather than a hole.
- Disabling one account cannot touch another's sessions or cutoff — the trigger is scoped to transitioning rows.
- A repeated disable is idempotent: nothing transitioned, so no cutoff moves and no session is re-revoked.
- **Bootstrap is unaffected.** A rerun of `pnpm seed:admin` finds the existing row and returns; it does not re-enable a disabled admin, reset a password, or move a cutoff.
- **`GET /admin/users` still does not serve `credentials_revoked_at`.** It is authorization machinery, not staff-list information.
