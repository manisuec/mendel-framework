# Contributing to Mendel Framework

First off — **thank you** for taking the time to contribute. 🎉

Mendel Framework is built by and for engineers who want a self-hostable experimentation platform that doesn't compromise on rigor. Whether you're filing your first bug report, fixing a typo in the docs, or proposing a major architectural change, your contribution is genuinely appreciated.

This document captures the conventions and workflow we follow so that contributions can be reviewed and merged quickly.

> 📦 **File name:** GitHub looks for `CONTRIBUTING.md` (without the trailing `S`) — this is the canonical OSS convention, so we use it here even when referred to colloquially as "contributions".

---

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Ways to contribute](#-ways-to-contribute)
- [Reporting bugs](#-reporting-bugs)
- [Suggesting enhancements](#-suggesting-enhancements)
- [Your first code contribution](#-your-first-code-contribution)
- [Development setup](#-development-setup)
- [Project structure](#-project-structure)
- [Coding guidelines](#-coding-guidelines)
- [Commit message style](#-commit-message-style)
- [Branching & pull requests](#-branching--pull-requests)
- [Testing](#-testing)
- [Documentation](#-documentation)
- [Security disclosures](#-security-disclosures)
- [License](#-license)

---

## 🤝 Code of Conduct

This project and everyone participating in it is governed by a simple principle: **be kind, be patient, and assume good intent.** Personal attacks, harassment, and discrimination of any kind are not tolerated. Maintainers reserve the right to remove comments, commits, code, issues, and contributors that violate this spirit.

If you witness or experience unacceptable behavior, please reach out privately to the maintainers.

---

## 💡 Ways to contribute

You don't have to write code to contribute. We value:

- 🐛 **Bug reports** with reproducible examples
- 💭 **Feature requests** grounded in real use cases
- 📝 **Documentation improvements** — typos, clarifications, new guides, translations
- 🧪 **Tests** — increasing coverage, edge-case scenarios, regression suites
- 🎨 **Admin UI improvements** — design tweaks, accessibility fixes, dark mode
- 🌐 **Client SDKs** — implementations of the bucketing algorithm in other languages
- 💬 **Helping others** by answering issues and discussions

---

## 🐛 Reporting bugs

Before opening a new issue, please:

1. **Search [existing issues](../../issues)** to avoid duplicates.
2. **Reproduce on the latest `main`** if you can — the bug may already be fixed.
3. **Strip your repro to a minimum** — the smaller, the faster we can fix it.

When you file the issue, include:

- **What you expected to happen** and **what actually happened**.
- **A minimal reproducer** (snippet or repo link).
- **Environment details** — Node.js version, MongoDB version, OS, `mendel-framework` version.
- **Relevant logs** — audit hooks, exposure logs, stack traces.

> 💡 Tip: if the bug is in evaluation, include the **experiment definition** (variants, targeting, rollout) and the **exact attribute bag** you passed. Bucketing is deterministic, so we should be able to reproduce your result byte-for-byte.

---

## ✨ Suggesting enhancements

Open a [feature request issue](../../issues/new) describing:

1. **The problem you're trying to solve** — start with the user pain, not the implementation.
2. **Your proposed solution**, and any alternatives you considered.
3. **Who else would benefit** — is this a one-off, or a recurring need?

For larger proposals (new APIs, breaking changes, architectural shifts), please open a **discussion** or a **draft RFC** before writing code. We'd rather give early feedback than ask you to rewrite a 1,000-line PR.

---

## 🌱 Your first code contribution

Looking for somewhere to start? Browse issues labeled:

- [`good first issue`](../../labels/good%20first%20issue) — well-scoped, beginner-friendly
- [`help wanted`](../../labels/help%20wanted) — actively seeking contributors
- [`docs`](../../labels/docs) — improve guides, examples, JSDoc

If nothing matches your interests, **open a discussion** describing what you'd like to work on. We're happy to brainstorm.

---

## 🛠 Development setup

### Prerequisites

- **Node.js ≥ 22**
- **MongoDB 7+** (locally or via Docker)
- **npm** (the lockfile is npm-based)
- (Optional) **Docker + Docker Compose** for the one-command full-stack setup

### Clone & install

```bash
git clone https://github.com/<your-username>/mendel-framework.git
cd mendel-framework

# Install backend deps
npm install

# Install UI deps
cd ui && npm install && cd ..
```

### Run locally

Option 1 — **everything in Docker** (recommended):

```bash
docker compose up --build
```

| Service | URL                                        |
| ------- | ------------------------------------------ |
| UI      | http://localhost:3100/                     |
| Backend | http://localhost:3000/                     |
| Mongo   | mongodb://localhost:27017/mendel-framework |

Option 2 — **run pieces manually**:

```bash
# 1. Mongo
docker run -d -p 27017:27017 --name mendel-mongo mongo:7

# 2. Backend
MONGO_URI=mongodb://127.0.0.1:27017/mendel-framework npm start

# 3. UI (separate terminal)
cd ui && npm run dev
```

### Environment variables

| Variable    | Default                                          | Purpose                       |
| ----------- | ------------------------------------------------ | ----------------------------- |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/mendel-framework`     | Mongo connection string       |
| `PORT`      | `3001`                                           | Express server port           |
| `NODE_ENV`  | `prod`                                           | Sets the framework environment |

---

## 🗂 Project structure

```
mendel-framework/
├── index.js                  # Public API surface — `createMendelFramework` and exports
├── lib/
│   ├── ExperimentService.js  # Mutations + single-flag evaluation
│   ├── ExperimentManager.js  # Batched, cached reads (used by SDKs)
│   ├── targeting.js          # Rule predicates (eq, in, regex, …)
│   ├── bucketing.js          # FNV-1a deterministic hashing
│   ├── cache.js              # In-process TTL cache
│   ├── constants.js          # Enums & event names
│   └── models/               # Mongoose model factories
├── express/
│   ├── controller.js         # Express request handlers
│   ├── routes.js             # Client-facing routes
│   ├── adminRoutes.js        # Admin / management routes
│   └── validators.js         # celebrate + Joi schemas
├── examples/
│   ├── server.js             # Minimal runnable backend
│   └── integration.js        # Annotated end-to-end example
├── ui/                       # React + Vite admin dashboard
└── docker-compose.yml        # Mongo + backend + UI
```

---

## 🧹 Coding guidelines

We don't have a heavy style guide — we just ask that your code looks at home next to its neighbors.

- **JavaScript** uses CommonJS (`require` / `module.exports`) — match the existing style.
- **`'use strict';`** at the top of every backend file.
- **2-space indentation**, single quotes, semicolons.
- **JSDoc** every public method with `@param` / `@returns`. Internal helpers can be brief.
- **No new dependencies** without a strong justification — Mendel Framework's value is partly in being lean.
- **Mongo writes** should be idempotent where possible (upserts, `$setOnInsert`).
- **Read paths** should be cache-aware — invalidate via `manager.invalidateCache()` on mutation.
- **Avoid feature flags inside the framework itself** (yes, the irony is noted). Keep the runtime behavior obvious.

### UI guidelines (`ui/`)

- **React 19** with functional components and hooks.
- **No CSS frameworks** — we keep styles in `src/styles.css`. Match the existing tokens.
- **No prop-types or TypeScript** in the current codebase — keep components small enough that types aren't needed.

---

## 📝 Commit message style

We loosely follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body — wrap at 72 chars>

<footer — issues closed, breaking changes>
```

Common `type`s: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.

Examples:

```
feat(targeting): add `between` operator for numeric ranges
fix(bucketing): handle empty variants array gracefully
docs(readme): clarify layer holdout semantics
```

Subject line guidelines:

- **Imperative mood** — "add", not "added" or "adds".
- **Lowercase**, no trailing period.
- **≤ 72 characters.**
- If the change is breaking, include `BREAKING CHANGE:` in the body.

---

## 🌿 Branching & pull requests

1. **Fork** the repository and create a feature branch from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make focused commits.** One logical change per commit beats one mega-commit.

3. **Keep your branch up to date** with `main` via rebase (preferred) or merge.

4. **Open a pull request** against `main` once your branch is ready. PRs should include:

   - A clear title following the commit-style convention.
   - A summary of **what** changed and **why**.
   - Screenshots / GIFs for UI changes.
   - Links to related issues (`Closes #123`).
   - A note on backward compatibility if anything observable changed.

5. **PR checklist** before requesting review:

   - [ ] I've run the relevant examples (`npm start`) against a real Mongo and verified my change.
   - [ ] I've added or updated tests where appropriate.
   - [ ] I've updated documentation (README, JSDoc, examples) for any API change.
   - [ ] My commits follow the [commit message style](#-commit-message-style).
   - [ ] I've checked that `docker compose up --build` still works.

6. **Be patient with review.** Maintainers may suggest changes, ask questions, or push back. That's how we keep the codebase healthy — please don't take it personally.

7. **One approval is required** for most changes; **two** for breaking changes or major architecture shifts.

---

## 🧪 Testing

A formal test suite has not yet been wired up — **adding one is one of the highest-impact contributions you can make.**

In the meantime, please **manually verify** your change against a running Mongo:

```bash
docker compose up --build
# Exercise the change via the admin UI, the example server, or a curl script.
```

If you're adding new bucketing or targeting logic, please include a small standalone script that demonstrates the deterministic behavior so reviewers can reproduce it.

> If you're interested in setting up Jest / Vitest + a Mongo-memory-server fixture for the project, please open an issue first — we'd love to align on conventions before the test scaffolding is laid down.

---

## 📚 Documentation

If your change is user-facing, **update the docs in the same PR** — out-of-date documentation is worse than no documentation.

- Public API change? Update [`README.md`](./README.md) and the relevant JSDoc.
- New example / use case? Add to [`examples/`](./examples).
- UI change? Refresh the screenshot in `docs/screenshots/` (or note that one is needed).

---

## 🔒 Security disclosures

**Please do not file security issues as public GitHub issues.**

If you believe you've found a security vulnerability, email the maintainers privately. We'll respond within a reasonable window and coordinate a disclosure timeline with you. We deeply appreciate responsible disclosure.

---

## 📜 License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](./LICENSE).

---

<div align="center">

**Thank you again for contributing to Mendel Framework!**

Every issue triaged, every doc fix, every test added makes the project better for everyone. 💛

</div>
