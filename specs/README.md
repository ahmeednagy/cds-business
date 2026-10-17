# CDS Business — Specification Map

**Last audited**: 2026-10-16 (reorganized: `002-reports` and `003-ui-ux-shell`
merged into `001-hr-platform`; former `004/005/006` renumbered to `002/003/004`;
originals preserved in `specs/archive/`)

Status legend: **COMPLETED** = implemented + verified · **PARTIAL** = live but
with open verification/test items · **ACTIVE** = in development ·
**PLANNED** = specified, not started.

## Current Development

- **Active Spec**: [`004-voice-video-calling`](004-voice-video-calling/) —
  Phases 1–7 complete
- **Active Phase**: Phase 8 — Production Networking (deployment blocker)
- **Last Completed Task**: V020 — two-context live E2E across all nine
  voice/video scenarios (verified 2026-10-16)
- **Next Incomplete Task**: **V016** — TURN server configuration
  (`004-voice-video-calling/tasks.md` → Phase 8)
- **Also open**: `001` Phase 13 reports debt — next task **RT002**
  (backend report tests); `002-notifications` deferred N011/N012.

A fresh session should read: this file → the active spec's `tasks.md` → first
`[ ]` task.

## Specs

| ID | Domain | Status | Current Phase | Next Task |
|----|--------|--------|---------------|-----------|
| 001 | [HR Platform](001-hr-platform/) | **PARTIAL** | Reports & Exports (Phase 13) — impl live, tests missing | RT002 `test_reports.py` |
| 002 | [Notifications](002-notifications/) | **COMPLETED** | — | deferred: N011 WS push, N012 localized messages |
| 003 | [Chat & Messaging](003-chat-messaging/) | **COMPLETED** | — | deferred: C017 multi-worker layer (joint with 004-V018) |
| 004 | [Voice & Video Calling](004-voice-video-calling/) | **ACTIVE** | Phase 8 — Production Networking | V016 TURN configuration |

## Spec index

| ID | Domain | Status | Purpose |
|----|--------|--------|---------|
| 001 | [HR Platform](001-hr-platform/) | **PARTIAL** | Core product: auth/JWT, RBAC, employees/profiles, requests+workflows, timesheets, attendance, dashboards, admin, notifications backend, presentation rules (shell/theme/i18n/RTL), reports & exports. |
| 002 | [Notifications](002-notifications/) | **COMPLETED** | Notification model, bell + unread badge + dropdown, `/notifications` page, read/read-all, deep links, polling delivery. |
| 003 | [Chat & Messaging](003-chat-messaging/) | **COMPLETED** | Direct conversations (existing-conversations-only lists, lazy creation), messages, WS realtime, unread, presence, call-history events. |
| 004 | [Voice & Video Calling](004-voice-video-calling/) | **ACTIVE** | WebRTC + WS signaling, call lifecycle/outcomes (missed/cancelled/declined/completed/failed), server timeout, call history, missed-call notifications. |
| — | [Archive](archive/) | merged | `002-reports`, `003-ui-ux-shell` preserved verbatim with merge mapping. |

## Established decisions (do not regress)

- Roles are exactly **EMPLOYEE / MANAGER / HR**; "Developer"/"Implementor" are
  job designations, not roles.
- **HR least-privilege**: org insight via aggregate dashboards/reports only —
  no blanket item-level access.
- Business week **Sunday–Saturday** (timesheet `week_start` = contained Monday).
- `WITHDRAWN` displays as **Cancelled** (localized labels only; payloads keep
  internal values).
- **Attachments on requests only** — timesheets carry none.
- Inverted date ranges = validation errors, never silent correction.
- Records/audit retained indefinitely; deactivation ≠ deletion.
- Chats lists show **existing conversations only**; directory lives behind
  **New message**; conversations persist lazily.
- Calls: **one attempt = one persisted event**; per-viewer wording per the
  outcome table in `004-voice-video-calling/spec.md`.

## Cross-spec dependencies

- **002 Notifications** ← workflow events (001) + missed/cancelled calls (004);
  unread model is independent of chat unread.
- **003 Chat** ← accounts/user identity (001); host of the WS transport that
  004 reuses.
- **004 Calling** ← 003 transport/persistence (`Message`/`Call` link,
  `chat.user.<id>` groups) + 002 notification emission for missed/cancelled.
- **001 Reports** ← attendance/timesheets/requests/accounts (same spec).

## Ownership rules (avoid duplicated requirements)

- Auth/RBAC, retention, workflows, attendance, timesheets, requests,
  dashboards, presentation rules, reports → **001**
- Notification delivery/read state/page/bell → **002**
- Conversations/messages/chat unread/presence → **003**
- WebRTC, call lifecycle, call events → **004**

## Conventions

- Active spec dirs hold `spec.md`, `plan.md`, `tasks.md` minimum; 001 also has
  `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `checklists/`.
- `ai_docs/` (repo root) = per-module developer docs (`*_sop/_ai/_guide`) per
  the mandatory docs rule; specs here are domain-level.
