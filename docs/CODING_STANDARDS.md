# Coding Standards

## Naming Conventions

- Files: `kebab-case` (e.g. `product-catalog.service.ts`)
- Classes, Interfaces, Types: `PascalCase`
- Variables, functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Database tables/columns (Prisma): `snake_case`
- React components: `PascalCase` filenames matching the component name

---

## Folder Structure

Each app follows its framework's standard layout:

- `apps/web` — Next.js App Router conventions (`app/`, `components/`, `lib/`)
- `apps/api` — NestJS module-per-feature (`src/modules/<module-name>/{controller,service,dto,entities}`)
- `apps/cms` — Payload collections grouped by domain (`collections/`)

One module = one business capability (see [ARCHITECTURE.md](./ARCHITECTURE.md#modules-modular-monolith-boundaries)). Do not create cross-module imports of internal files — only import a module's public service interface.

---

## TypeScript

- Strict mode always on (`strict: true` in `tsconfig.json`)
- No `any` — use `unknown` and narrow, or define a proper type
- Explicit return types on exported functions and public class methods
- Prefer `type` for data shapes, `interface` for extendable contracts

---

## Function & File Size

- Keep functions small and single-purpose (one clear responsibility)
- If a file exceeds ~300 lines, split it
- Avoid deeply nested conditionals — extract guard clauses

---

## Comments

- Add a comment only when the _why_ isn't obvious from the code (a workaround, a non-obvious constraint)
- Never leave commented-out code in a commit

---

## Linting & Formatting

- ESLint + Prettier, enforced via pre-commit hook (Husky + lint-staged)
- No merge with lint errors

---

## Git

### Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <subject>`

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`

Example: `feat(catalog): add product filtering by category`

### Branching

- `main` — always deployable
- `develop` — integration branch (if needed once a team forms)
- `feature/<short-name>`, `fix/<short-name>` — per unit of work, branched from `main` (or `develop`)

---

## Validation & Error Handling

- Validate all external input at the API boundary (NestJS `class-validator` DTOs)
- Never trust data from the CMS, forms, or query params without validation
- Errors follow the shape defined in [API_DESIGN.md](./API_DESIGN.md)

---

## Internationalization

- Never hardcode user-facing text inside a component. UI chrome (buttons, labels, messages) goes through `next-intl` translation keys; business content (page/product/blog copy) goes through Payload localized fields or Prisma's `ContentTranslation`, never a literal string in `apps/web`.
- Treat an un-keyed, hardcoded user-facing string as a defect, not a style nitpick — see [docs/i18n/INTERNATIONALIZATION_STRATEGY.md §5](./i18n/INTERNATIONALIZATION_STRATEGY.md#5-content-rules).

## CMS Content

- Never hardcode a list-shaped section (cards, milestones, team members, FAQ items, certifications — any repeating block) in a component. It renders from a Payload repeater/array field via `.map()`, always — a fixed number of hand-written items is the same class of defect as a hardcoded i18n string, and is treated as one in review. See [docs/frontend/FRONTEND_ARCHITECTURE.md §10](./frontend/FRONTEND_ARCHITECTURE.md#cms-content-modeling-rules).
