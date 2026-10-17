# Implementation Plan: CDS Business HR Platform

**Branch**: `001-hr-platform` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-hr-platform/spec.md`

## Summary

Build the CDS Business HR platform: a single-organization web application where Employees manage
profiles, submit configurable HR requests and weekly timesheets; Managers review and
approve/reject/return items for direct reports; HR administers employees, request types,
and workflows. Delivered as a Django + DRF modular monolith REST/JSON API behind Nginx,
with a React + TypeScript SPA (Vite, Tailwind, shadcn/ui, TanStack Query, RHF + Zod),
PostgreSQL storage, SimpleJWT auth, private local file storage, and Docker Compose
deployment. Every mutation is audited; every endpoint enforces server-side object-level
RBAC; all lists are paginated.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.x (frontend)

**Primary Dependencies**: Django 5.x, Django REST Framework, djangorestframework-simplejwt;
React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, Zod

**Storage**: PostgreSQL 16; private local filesystem (outside web root) for attachments

**Testing**: pytest + pytest-django + factory_boy (backend), Vitest + Testing Library
(frontend)

**Target Platform**: Linux server, Docker Engine + Docker Compose, Nginx reverse proxy

**Project Type**: Web application — backend REST API + frontend SPA (modular monolith)

**Performance Goals**: Interactive API responses under ~500ms at 10k records per category;
paginated lists only

**Constraints**: Server-side RBAC on every endpoint and object; audit record on every
status transition and admin change; atomic multi-step writes; no public file URLs;
no internals in error responses; accessibility baseline (semantic markup, keyboard nav)

**Scale/Scope**: Single organization per deployment; no company-size assumptions —
design targets ~10k items per category per SC-006

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Domain Neutrality & Role Model | Exactly 3 roles; no size assumptions | PASS — role enum `EMPLOYEE/MANAGER/HR`; generic org model |
| II. Server-Side Security & RBAC | Server-enforced object access; JWT; no secrets in logs | PASS — DRF permission classes + queryset scoping; SimpleJWT; settings via env |
| III. Audit Trail & Logging | Auditable business actions with actor+timestamp | PASS — `AuditEntry` append-only model, written in-action |
| IV. Data Integrity | Transaction-safe ops; invariants at data layer | PASS — transitions via atomic service; DB constraints + unique rules |
| V. Secure File Handling | Private storage; per-file authorization | PASS — files outside web root; authorized download endpoint |
| VI. Performance Discipline | Pagination; N+1 avoidance; indexing | PASS — default pagination class; `select_related`/`prefetch_related`; indexed filters |
| VII. Secure Error Handling | No internals to clients | PASS — DRF exception handler; `DEBUG=False` in deploy |
| VIII. Accessibility | Baseline a11y | PASS — shadcn/ui (Radix primitives) + labeling conventions |
| IX. Maintainability & Testability | Modular monolith; happy/edge/permission tests | PASS — Django apps per domain; test plan covers all three |
| Approved Stack | No deviations | PASS — all choices match constitution |

**Result**: No violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/001-hr-platform/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API endpoint contracts)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── config/                  # Django project: settings/, urls.py, wsgi.py, asgi.py
├── apps/
│   ├── core/                # Shared: base models, pagination, exception handler, permissions
│   ├── accounts/            # User, roles, employee profiles, reporting line, credentials
│   ├── workflows/           # Workflow + step definitions, transition engine
│   ├── requests/            # RequestType, Request, Attachments
│   ├── timesheets/          # Timesheet, TimesheetEntry
│   ├── notifications/       # Notification model + read state
│   └── audit/               # AuditEntry, history endpoints
└── tests/                   # pytest: unit/, integration/, permissions/
media/                       # Private attachment storage (NOT served by Nginx)

frontend/
├── src/
│   ├── components/          # shadcn/ui primitives + shared composites
│   ├── features/            # requests/, timesheets/, notifications/, admin/, dashboard/
│   ├── lib/                 # api client, auth/token store, rbac helpers (display-only)
│   ├── routes/              # role-gated route tree
│   └── types/               # shared TS types / zod schemas
└── tests/

deploy/
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── nginx/                   # reverse proxy config (API + SPA; no media location)
```

**Structure Decision**: Web application (Option 2) — `backend/` Django modular monolith with
one app per domain boundary (constitution IX), `frontend/` React SPA, `deploy/` for the
containerized topology. `media/` lives at repo root outside any web-served path.

## Complexity Tracking

No constitution violations — section not applicable.
