# ADR-013 — Lead assignment and status workflow

**Status:** Accepted · 20 August 2026
**Supersedes nothing.** Closes the deferral that [API_CONTRACT_FINAL.md](../API_CONTRACT_FINAL.md) §2.10 recorded as _"the group is contracted as 'list, read, assign, status'; **assign and status are unbuilt**"_, and the one [DATA_MODEL.md](../DATA_MODEL.md) §2 Notes recorded as _"the status vocabulary, and the Admin/RBAC workflow that would operate it, remain deferred"_.

---

## Context

Two lead entities — `Inquiry` and `CustomFormulationRequest` — have been accepting public submissions since 18 August 2026, and an Admin read inbox has served them since 19 August. Neither could be acted on. `status` held exactly one value, `new`, explicitly framed as an initial ingestion state with **no authorized transition**; `assignedToId` existed on both tables and was never written, so a Sales Expert's server-scoped inbox was permanently empty by construction.

An audit of the repository before this decision established the following, **tested** against the schema and the live database rather than inferred:

1. `assignedToId` exists on both lead tables, `uuid NULL`, FK → `users` with **`ON DELETE SET NULL`**.
2. `status` is `text NOT NULL` with **no CHECK, no enum and no database default** — the value comes from a constant in `apps/api`.
3. **`StatusHistory` already exists**, polymorphic over `entityType`/`entityId`, with `changedById` also `ON DELETE SET NULL`. It records status only: there are no assignee columns, and `to_status` is `NOT NULL`.
4. There is **no `updatedAt`** anywhere in the schema.
5. **No status vocabulary beyond `new` exists in any document.** No ADR touched lead assignment or lead workflow.
6. Nothing prevents assigning a lead to a **disabled** account or to a **`customer`-role** account — both were accepted by PostgreSQL in a probe.
7. Deleting a `User` who holds an assigned lead **succeeds silently**: the lead becomes unassigned, and any `status_history` row that named them keeps existing with a `NULL` actor.

Fact 7 is the sharpest. [ADR-012](./ADR-012-application-session-and-account-status.md) §7 makes physical `User` deletion the platform's **strongest and documented** revocation, not an exceptional event — so an ordinary off-boarding would erase a person's name from every audit row they had written, with nothing recording that it had happened.

---

## Decision

### 1. Status vocabulary — three values

| Status        | Meaning                                                   | Terminal                           |
| ------------- | --------------------------------------------------------- | ---------------------------------- |
| `new`         | Accepted and persisted; **no work has begun**             | No                                 |
| `in_progress` | **Active work has begun.** Says nothing about who owns it | No                                 |
| `closed`      | **No further work currently intended**                    | Terminal by intent, **reopenable** |

`new` keeps its exact previous value and meaning, so no existing row moved or was reinterpreted.

**`assigned` is not a member.** Ownership is `assignedToId`, which already answers "is this assigned?"; a status saying the same thing would be a second source of truth able to disagree with the first — `status = 'assigned'` with a `NULL` assignee is representable and meaningless.

**`contacted`, `qualified`, `won`, `lost`, `cancelled`, `spam` and `duplicate` are not members.** `contacted` is an activity record wanting its own timestamp; `qualified` needs a definition of "qualified" that nobody has given; won/lost only pays off with pipeline reporting, which is deferred. A closing reason, where one is worth recording, goes in the **`note` column `StatusHistory` already has** — not in a new enum member.

### 2. Transition graph

```
new         -> in_progress      work begins
new         -> closed           closed without being worked
in_progress -> closed           work finishes
closed      -> in_progress      REOPENED
```

Refused: `in_progress -> new`, `closed -> new`, and every self-transition `X -> X`.

`new` means "nobody has looked at this"; once somebody has, returning to it would make the record assert something false. A self-transition is not a change and must not write an audit row saying nothing happened. **Reopening lands in `in_progress`, never `new`.**

**Assignment is not a precondition for any transition** — an Admin must be able to close spam without first assigning it. A Sales Expert can only transition a lead already assigned to them, which follows from their read scope rather than from a separate rule.

### 3. RBAC

| Capability                | admin  | content_manager | sales_expert             | customer |
| ------------------------- | ------ | --------------- | ------------------------ | -------- |
| read lead                 | all    | all             | **own assigned only**    | none     |
| assign / reassign / clear | ✅     | ❌              | ❌                       | ❌       |
| change status             | ✅ any | ❌              | ✅ **own assigned only** | ❌       |
| reopen                    | ✅     | ❌              | ✅ own                   | ❌       |
| read history              | ✅     | **❌**          | ✅ own                   | ❌       |

**Content Manager stays read-only**, per the `read` cell of [SECURITY.md](../SECURITY.md)'s matrix. **They are additionally excluded from history**: it records which member of staff did what and when, which is employee activity data rather than lead data, and their matrix cell gives them no operational reason to see it.

**A Sales Expert may not reassign, including away from themselves.** Working a lead and redistributing ownership are different acts.

### 4. Assignment eligibility

An assignee must be an **active `sales_expert`**. `NULL` (unassigned) is always valid, reassignment is direct A → B, and clearing is permitted — all Admin-only.

**Admin is not an eligible assignee.** Under the single-role model an Admin who also sells cannot own a lead; widening this is a role-model decision, not a validation tweak, and multi-role support is not introduced.

**Fresh unassigned leads are invisible to Sales Experts** until an Admin assigns them. This is accepted rather than worked around: Admin reads the full inbox, and the existing internal submission email remains the operational safety net. No automatic routing, and no claim-an-unassigned-lead capability — either would require widening the frozen read scope.

### 5. Enforcement is split three ways, deliberately

- **The vocabulary** is a database `CHECK` on both `status` columns. `text`, not a PostgreSQL enum: three values do not justify `ALTER TYPE` on every future change, and a CHECK gives identical integrity.
- **The graph** is the Forms module's. A row-level constraint cannot see the previous value, so `closed -> new` is not expressible as a CHECK.
- **Eligibility** is Identity's, through a narrow exported contract. Nothing in the database can express "an active Sales Expert".

### 6. History — two tables, and why not one

`StatusHistory` is reused unchanged for status. Assignment gets a **new `LeadAssignmentHistory`** rather than being folded into it, because `StatusHistory.to_status` is `NOT NULL`: an assignment-only row could not be written there without making a shipped column nullable, **on a polymorphic table `ContentTranslation` also uses**. One narrow table is the smaller and safer change.

Every successful mutation writes exactly one history row **in the same transaction as the lead update**. No mutation without history; no history without mutation. A rejected request — 400, 403, 404, 409 or a no-op — writes nothing.

### 7. Identity snapshots — the answer to fact 7

Both history tables carry `changedByEmailSnapshot`, and the assignment table additionally carries `fromAssigneeEmailSnapshot` and `toAssigneeEmailSnapshot`. Written once at mutation time, never updated.

**The foreign keys stay `ON DELETE SET NULL`.** Changing them to `RESTRICT` would make a `User` undeletable once they touch a lead, breaking ADR-012's revocation-by-deletion. The snapshot resolves the tension instead: the FK keeps the live link while it exists, the text keeps the record readable after it does not. An A → B reassignment therefore still names both people once either account is gone.

**Email only.** It is already the human-readable operator identity across this application; no password, token, role or profile field belongs in an audit row.

### 8. Concurrency — compare-and-set, no new column

Every mutation carries the caller's belief about the current value and updates conditionally:

```sql
UPDATE ... SET status = :to           WHERE id = :id AND status = :from
UPDATE ... SET assigned_to_id = :to   WHERE id = :id AND assigned_to_id IS NOT DISTINCT FROM :from
```

`updateMany` is used rather than `update` precisely because it reports a **count**: one means this caller won, zero means the row moved and the answer is **409**. Zero-because-stale is distinguished from zero-because-invisible by re-reading **within the caller's scope**, so a Sales Expert can never learn that a lead they cannot see exists.

**No `updatedAt`, no version column, no ETag, no row lock and no application mutex.** The predicate the caller already holds does the whole job, and a second mechanism would be a second thing to keep correct.

### 9. Narrow mutation commands, not a generic PATCH

```
PATCH /api/v1/admin/inquiries/:id/assignment
PATCH /api/v1/admin/inquiries/:id/status
PATCH /api/v1/admin/custom-formulation-requests/:id/assignment
PATCH /api/v1/admin/custom-formulation-requests/:id/status
GET   /api/v1/admin/{leads}/:id/history
```

They have **different role lists** — a generic handler would have to authorize per-field inside the body, which is where per-field authorization bugs live — they write **different audit tables**, and they validate differently. No `POST`, no `DELETE`, no bulk operation, no generic `PATCH /:id`.

History is nested under the lead so it cannot be reached without one, and is scoped identically. **There is no global audit-log API**, and this must not become one: the response publishes email snapshots rather than user ids, because the UI renders a person and an internal identifier would be published for nothing.

### 10. No workflow email

Assignment, reassignment, status change and reopen send **nothing**. The existing new-submission internal notification is unchanged, and no buyer is ever notified. The transport has no queue, no retry and no delivery record, no production mailbox exists, and reaching an assignee's address would mean publishing employee email across the module boundary to send a message the operator can already see on screen.

---

## Consequences

- A Sales Expert's inbox becomes usable for the first time — but only once an Admin assigns something. Nothing routes automatically, and that is a manual step somebody has to take.
- `status` is now mutable, so the immutability the consent-version trigger relies on is **not** weakened: that trigger guards `privacy_policy_version` specifically and permits every other column to move, which is what makes this gate possible without touching it.
- Two audit tables must be handled together by any future retention or lead-deletion work. **Neither has a foreign key to its lead**, so nothing cascades today: deleting a lead would silently leave orphan history. That is now a recorded decision to make rather than an accident — see [SECURITY.md](../SECURITY.md#personal-data-retention).
- The history rows contain **employee** personal data (who acted, when), which the retention policy did not previously have to consider.
- `assigneeId` is now published on the lead read projections. The previous gate deliberately withheld it; the assignment control needs it as its compare-and-set predicate, so withholding it would make a safe write impossible.

## Alternatives rejected

- **`new/assigned/in_progress/closed`** — `assigned` duplicates `assignedToId`. Rejected as overlapping.
- **`new/contacted/qualified/closed`** — pipeline semantics without a pipeline. Rejected as CRM.
- **A generic `closed` plus a reason enum** — `StatusHistory.note` already exists and needs no vocabulary decision.
- **Widening `StatusHistory`** to carry assignment — would null a shipped `NOT NULL` column on a table another feature depends on.
- **`ON DELETE RESTRICT`** on the assignee FK — protects the audit trail by breaking ADR-012's revocation.
- **An `updatedAt` / version column** for optimistic concurrency — a second mechanism for what compare-and-set already does.
- **Sales Experts claiming unassigned leads** — requires widening the frozen "own leads only" read scope.

## Deferred, explicitly NOT decided here

Lead lifecycle beyond three states · won/lost/cancelled/spam/duplicate outcomes · internal notes and comments · tags · pipeline analytics and dashboards · lead scoring · automation and routing rules · SLA timers and reminders · bulk actions · export · CRM sync · buyer-facing status · lead deletion and retention periods · `DistributorApplication` and `DownloadRequest` workflow (both already carry `assignedToId` and will reuse both history tables without a schema change).
