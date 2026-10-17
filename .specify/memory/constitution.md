<!--
Sync Impact Report (temporary — remove before committing)
- Version change: 1.0.0 → 2.0.0 (MAJOR: all Odoo-specific principles removed and
  replaced with CDS Business HR platform principles — backward-incompatible redefinition)
- Modified principles: all previous principles replaced (Odoo-specific rules removed)
- Added sections:
  - Core Principles I–IX (Domain Neutrality & Role Model; Server-Side Security &
    RBAC; Audit Trail & Operational Logging; Data Integrity & Workflow Consistency;
    Secure File Handling; Performance Discipline; Secure Error Handling;
    Accessibility Baseline; Maintainability & Testability)
  - "Approved Technical Stack" section
  - "Development Workflow" section
  - "Governance" section
- Removed sections: all Odoo-specific principles and constraints
- Follow-up TODOs: none — all placeholders resolved
- Source of values: decisions established in the current session (user-provided)
-->

# CDS Business Constitution

## Core Principles

### I. Domain Neutrality & Role Model

CDS Business is an HR platform for general companies with employees and HR staff; no assumption is
made about company size, industry, or structure. The platform defines exactly three roles —
Employee, Manager, and HR — and every feature MUST map cleanly onto these roles without
introducing implicit or hidden permission tiers.

### II. Server-Side Security & RBAC (NON-NEGOTIABLE)

Authentication uses email + password issuing JWTs (Simple JWT). Role-Based Access Control
MUST be enforced on the server for every endpoint and object access; the client is never a
security boundary. Tokens MUST be handled securely (short-lived access tokens, protected
storage, no secrets in code or logs). Personal and HR data MUST be protected in transit and
at rest consistent with data-protection expectations for employee records.

### III. Audit Trail & Operational Logging

Important business actions (e.g., approval decisions, record changes, permission-sensitive
operations) MUST produce audit trail entries attributable to an actor and a timestamp.
Operational and security logging MUST support investigation without exposing credentials or
personal data beyond what is necessary.

### IV. Data Integrity & Workflow Consistency

Multi-step business operations MUST be transaction-safe: partial writes are not acceptable.
Entity relationships and status transitions MUST enforce their invariants at the data layer,
not only in UI validation, so that workflow consistency holds regardless of entry point.

### V. Secure File Handling

Attachments MUST be stored privately and served only after authorization checks that verify
the requester is allowed to access that specific file. No publicly guessable or unauthenticated
URLs to employee documents.

### VI. Performance Discipline

APIs MUST remain responsive as data grows: list endpoints MUST be paginated, queries MUST be
evaluated for N+1 patterns and appropriate indexing, and expensive operations MUST NOT run in
the request path when they can be deferred.

### VII. Secure Error Handling

Errors MUST be handled gracefully and MUST NOT leak internals (stack traces, SQL, secrets,
existence of protected records) to clients. User-facing messages are safe and actionable;
diagnostic detail stays in server logs.

### VIII. Accessibility Baseline

User interfaces MUST meet a reasonable accessibility baseline: semantic markup, keyboard
navigability, sufficient contrast, and accessible labeling of interactive elements.

### IX. Maintainability & Testability

The backend follows a modular monolith architecture with clear module boundaries; code MUST
remain readable and reviewable. Features MUST ship with meaningful test coverage — at minimum
happy-path, edge-case, and permission/security tests — and MUST pass verification (lint,
typecheck, tests) before being considered complete.

## Approved Technical Stack

The following stack decisions are ratified. Deviations require explicit approval and, where
they change these constraints, a constitution amendment.

- Frontend: React + TypeScript, built with Vite
- UI: Tailwind CSS + shadcn/ui
- Server state: TanStack Query
- Forms/validation: React Hook Form + Zod
- Backend: Django + Django REST Framework (modular monolith)
- Authentication: Simple JWT
- Database: PostgreSQL
- File storage: private local filesystem for MVP
- Deployment: Docker Engine + Docker Compose, behind Nginx as reverse proxy
- API style: REST/JSON

## Development Workflow

- Server-side authorization and audit requirements (Principles II–III) are checked on every
  endpoint-bearing change.
- Changes are verified with the project's verification commands (lint, typecheck, tests)
  before being reported complete.
- Ambiguous requests are clarified before implementation; assumptions are not silently made.
- Git: no auto-commit or auto-push; commits only when requested.

## Governance

This constitution supersedes ad-hoc practices and conflicting prior versions. It records the
governing principles and ratified stack for CDS Business; implementation details live in feature
plans, not here.

Amendment procedure: propose the change, document the rationale, update this file with a Sync
Impact Report comment, and increment the version per semantic versioning — MAJOR for backward
incompatible principle removals/redefinitions, MINOR for new or materially expanded
principles/sections, PATCH for clarifications and non-semantic refinements.

Compliance: every spec, plan, and implementation review MUST verify adherence to these
principles; violations of NON-NEGOTIABLE principles block the work until resolved or
explicitly waived by the project owner.

**Version**: 2.0.0 | **Ratified**: 2026-10-04 | **Last Amended**: 2026-10-04
