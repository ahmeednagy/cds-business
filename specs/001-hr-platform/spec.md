# Feature Specification: HR Platform (core product)

**Feature Branch**: `001-hr-platform`

**Modules**: Authentication & Accounts (US1) · Employees & Profiles (US2) ·
Requests & Attachments (US3, US4) · Workflow & Review (US5, US8) · Timesheets
(US6) · Notifications backend contract (US7 → UX in `002-notifications`) ·
Dashboards/Search (US9) · Post-spec: Attendance check-in/out, self-service
password reset · Presentation Layer (merged `003-ui-ux-shell`) · Reports &
Exports (merged `002-reports`)

**Created**: 2026-10-04

**Status**: COMPLETED — all 70 tasks in `tasks.md` verified implemented. See
"Post-implementation deltas" below for later additions that extend (not replace)
this scope.

**Input**: User description: "Build the CDS Business HR management platform for general companies. Three roles — Employee, Manager, HR. Employees manage their profile, submit/track HR requests with configurable request types, provide text and file attachments, submit timesheets, view notifications and history. Managers review requests and timesheets for direct reports and approve, reject, or return items per the defined workflow. HR manages employees, configures request types, reviews organization-level items, manages workflows, and accesses reports/history. Authentication is Email + Password + JWT; authorization is server-side RBAC. The system supports request and timesheet workflows with controlled status transitions, audit/history tracking, notifications, secure file attachments, search/filtering, dashboards, and role-appropriate access."

## Clarifications

### Session 2026-10-04

- Q: Can an employee withdraw a submitted request (or timesheet) that is still pending review? → A: Yes — withdrawal is allowed while pending; the item moves to a final "Withdrawn" state, is recorded in history, and cannot be withdrawn after a reviewer acts.
- Q: What time period does a timesheet cover, and at what granularity does an employee record time? → A: Weekly period with per-day hour entries — one timesheet per employee per week.
- Q: How does HR get employee accounts into the system — one at a time, or also in bulk? → A: Manual one-at-a-time creation only; bulk import is out of scope for this iteration.
- Q: How do users receive their initial password and reset a forgotten one, given no email delivery is assumed? → A: HR-mediated — HR sets a temporary password at account creation (user must change it on first sign-in) and resets passwords on request; no self-service email reset in this iteration.
- Q: How long must employee records, requests, timesheets, and their audit history be retained? → A: Retain indefinitely — deactivated employees and closed items are kept with full history; no automatic deletion or anonymization.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In and Role-Appropriate Access (Priority: P1)

A user opens CDS Business, signs in with their company email and password, and lands on a
role-appropriate view: Employees see their own requests, timesheets, and notifications;
Managers additionally see pending items for their direct reports; HR sees organization-wide
administration and review areas. Users can only reach functions their role permits — anything
else is denied, whether navigated to or requested directly.

**Why this priority**: Nothing else in the platform works without authenticated,
role-aware access. This is the security boundary the entire system is built on and is
non-negotiable per the project constitution.

**Independent Test**: Create one account per role, sign in as each, and verify each lands on
the correct view and is denied access to other roles' areas (including by direct URL or
request). Delivers a working sign-in with enforced access control.

**Acceptance Scenarios**:

1. **Given** a registered user with valid credentials, **When** they sign in, **Then** they
   are authenticated and routed to their role-appropriate home view.
2. **Given** an authenticated Employee, **When** they attempt to access a Manager review
   area or HR administration function, **Then** the system denies access and does not reveal
   the protected content.
3. **Given** an unauthenticated visitor, **When** they attempt to access any protected area,
   **Then** they are redirected to sign in.
4. **Given** a signed-in user whose session credential has expired, **When** they continue
   working, **Then** they can renew the session without losing their place, or are signed
   out cleanly.
5. **Given** a user entering an incorrect password, **When** sign-in fails, **Then** they see
   a generic error that does not reveal whether the email exists.
6. **Given** a user whose `must_change_password` flag is set, **When** they sign in,
   **Then** they are required to set a new password before accessing any other function.

---

### User Story 2 - Employee Profile Management (Priority: P1)

An employee views and updates their own profile — personal details, contact information, and
other fields the organization makes editable. They can see which fields are read-only
(managed by HR) versus editable, and their changes are saved with confirmation.

**Why this priority**: The employee profile is the foundational record every other feature
references (requests, timesheets, reporting lines). Without it, no workflow has an actor.

**Independent Test**: Sign in as an employee, edit editable profile fields, save, and verify
the values persist on reload and that HR-managed fields cannot be modified. Delivers working
self-service profile management.

**Acceptance Scenarios**:

1. **Given** a signed-in employee, **When** they update editable profile fields and save,
   **Then** the changes persist and a confirmation is shown.
2. **Given** a signed-in employee, **When** they attempt to modify an HR-managed field,
   **Then** the system prevents the change.
3. **Given** a signed-in employee, **When** they attempt to view or edit another employee's
   profile (unless their role permits it), **Then** access is denied.
4. **Given** an invalid value in an editable field, **When** the employee saves, **Then** a
   clear field-level error is shown and nothing is persisted.

---

### User Story 3 - Employee HR Requests (Priority: P1)

An employee creates an HR request by choosing a request type configured by HR (e.g., leave,
document, correction, or other configured types), filling in the type's required fields,
adding a text explanation, and optionally attaching files. After submission the employee can
track the request's status, see where it sits in the workflow, view its history, and respond
if it is returned for revision.

**Why this priority**: Requests are the core transactional flow of the platform — the main
reason employees use CDS Business day to day. A viable MVP can exist with just auth + requests.

**Independent Test**: With one configured request type, an employee submits a request with an
attachment and tracks it through submission; the request appears in their list with correct
status and full submission details retrievable. Delivers an end-to-end request lifecycle from
the employee side.

**Acceptance Scenarios**:

1. **Given** an active request type, **When** an employee submits a complete request,
   **Then** it is created in the workflow's initial state and appears in their request list.
2. **Given** a request type with required fields, **When** an employee submits without a
   required field, **Then** the submission is rejected with clear field-level errors.
3. **Given** a submitted request, **When** the employee opens it, **Then** they see its
   current status, submitted content, attachments, and history of actions taken.
4. **Given** a request returned for revision, **When** the employee edits and resubmits it,
   **Then** it re-enters the workflow and the revision is recorded in its history.
5. **Given** a request that has reached a final status, **When** the employee views it,
   **Then** it is read-only and shows its outcome.

---

### User Story 4 - Secure Attachments on Requests (Priority: P2)

Employees attach supporting files to requests; reviewers can open those attachments while
reviewing. Files are only downloadable by users authorized to see the parent request — no
direct or guessable access for anyone else.

**Why this priority**: Attachments carry sensitive employee documents; security is mandatory,
but the upload/preview UX can be layered onto the basic request flow from Story 3.

**Independent Test**: Attach a file to a request, then verify (a) the employee and authorized
reviewers can download it, and (b) an unrelated employee and an unauthenticated visitor
cannot — including via a direct file link. Delivers authorized-only file access.

**Acceptance Scenarios**:

1. **Given** a request in an editable state (pending before any reviewer action, or
   returned), **When** the employee attaches a file within allowed type/size limits,
   **Then** the file is stored and listed on the request.
2. **Given** a submitted request with an attachment, **When** an authorized reviewer opens
   the attachment, **Then** the file is served.
3. **Given** a user without access to the parent request, **When** they attempt to download
   its attachment by any means, **Then** access is denied.
4. **Given** a file exceeding allowed limits or of a disallowed type, **When** the employee
   uploads it, **Then** the upload is rejected with a clear reason.

---

### User Story 5 - Manager Review of Direct Reports' Items (Priority: P2)

A manager sees a work queue of pending requests and timesheets submitted by their direct
reports. For each item they can view full detail (content, attachments, history) and take the
workflow-appropriate action: approve, reject, or return for revision — with an optional or
required comment as the workflow defines. The item transitions to the correct next status and
the employee is informed.

**Why this priority**: Review is what makes submitted items actionable. It completes the
two-sided request loop that delivers the platform's core value.

**Independent Test**: With one employee reporting to a manager, submit a request, then as the
manager approve it — verify the status transition, the audit record, and that the employee
sees the outcome. Delivers a complete submit→review cycle.

**Acceptance Scenarios**:

1. **Given** a pending request from a direct report, **When** the manager approves it,
   **Then** it advances to the workflow's next status and the decision is recorded with
   actor and timestamp.
2. **Given** a pending request, **When** the manager returns it with a comment, **Then** it
   moves to a returned status editable by the employee, and the comment is visible.
3. **Given** a pending request from someone who is NOT the manager's direct report, **When**
   the manager attempts to review it, **Then** access is denied (unless the workflow
   explicitly assigns them).
4. **Given** an item already actioned by another authorized reviewer, **When** a second
   reviewer attempts to act on it, **Then** the system prevents double-processing and shows
   its current state.
5. **Given** a rejected request, **When** the employee views it, **Then** they see the
   rejection and the reviewer's reason where provided.

---

### User Story 6 - Timesheet Submission and Approval (Priority: P2)

Employees record time as per-day hour entries and submit one timesheet per week. The
timesheet enters an approval workflow: the manager (and/or HR, per workflow configuration)
reviews and approves, rejects, or returns it. Employees track status and history; returned
timesheets can be corrected and resubmitted.

**Why this priority**: Timesheets are the second core transactional flow, sharing the same
workflow machinery as requests but with period/time data instead of request-type fields.

**Independent Test**: An employee submits a timesheet for a period; the manager approves it;
the timesheet shows approved status with a complete history. Delivers an end-to-end
timesheet cycle.

**Acceptance Scenarios**:

1. **Given** an open work period, **When** an employee submits a complete timesheet,
   **Then** it enters the workflow's pending state and appears in the manager's queue.
2. **Given** a submitted timesheet, **When** the employee tries to edit it before any action,
   **Then** editing rules follow the workflow (either editable until first action, or locked —
   consistently applied).
3. **Given** a returned timesheet, **When** the employee corrects and resubmits it, **Then**
   it re-enters review with the revision recorded.
4. **Given** a timesheet already submitted for a week, **When** the employee attempts a
   duplicate submission for the same week, **Then** the system prevents the duplicate.
5. **Given** an approved timesheet, **When** anyone views it, **Then** it is read-only.

---

### User Story 7 - Notifications and Activity History (Priority: P2)

Users receive in-app notifications when something needs their attention or changes: a
request is returned, an item awaits their review, a decision is made on their submission.
Each user can view their notification list, see read/unread state, and navigate to the
related item. Separately, every item exposes a chronological history of the actions taken
on it.

**Why this priority**: Notifications make the workflow usable in practice — without them,
users must poll for changes. History is the user-visible face of the audit trail.

**Independent Test**: Trigger a status change on an employee's request; verify a notification
appears for the employee, marks read when opened, and links to the request — whose history
shows the same event. Delivers working notification + history surfacing.

**Acceptance Scenarios**:

1. **Given** a request awaiting a manager's review, **When** it is submitted, **Then** the
   responsible reviewer receives a notification.
2. **Given** a decision on an employee's request, **When** the decision is recorded,
   **Then** the employee receives a notification that navigates to the item.
3. **Given** a notification list, **When** the user opens it, **Then** unread items are
   distinguishable and can be marked read individually or in bulk.
4. **Given** any request or timesheet, **When** an authorized viewer opens its history,
   **Then** they see every status transition and action with actor and timestamp in order.

---

### User Story 8 - HR Administration and Configuration (Priority: P3)

HR users administer the organization: create and maintain employee records (including role
and manager assignment), activate/deactivate accounts, configure request types (their fields,
requirements, attachment rules, and which workflow they follow), and manage workflow
definitions (statuses, allowed transitions, and which roles act at each step). HR can also
review requests and timesheets assigned to an HR workflow step, and access aggregate
reports and history across the organization.

**Why this priority**: Administration enables scale and self-service configuration, but an
MVP can run with seeded request types and a simple default workflow before full admin UI
exists.

**Independent Test**: As HR, create a new request type with its fields and workflow, then run
an employee→manager cycle using it — proving configuration drives behavior without code
changes. Also verify a deactivated user cannot sign in. Delivers working administration.

**Acceptance Scenarios**:

1. **Given** an HR user, **When** they create an employee with a role and manager, **Then**
   the account is usable and the reporting line takes effect for review routing.
2. **Given** an HR user, **When** they deactivate an employee, **Then** that user can no
   longer sign in or act, while their historical records remain intact.
3. **Given** an HR user, **When** they configure a request type with required fields and an
   approval workflow, **Then** employees can immediately submit that type and it follows the
   configured workflow.
4. **Given** a non-HR user, **When** they attempt any administration function, **Then**
   access is denied.
5. **Given** a request type in use by existing requests, **When** HR changes its workflow,
   **Then** in-flight requests continue under consistent rules (completed items are never
   retroactively altered).

---

### User Story 9 - Dashboards, Search, and Filtering (Priority: P3)

Each role lands on a dashboard summarizing what matters to them: employees see their open
requests, timesheet status, and recent notifications; managers see pending review counts and
team activity; HR sees organization-level volumes and pending items. All lists (requests,
timesheets, employees, notifications) support searching and filtering by relevant attributes
(status, type, date range, person) and are paginated.

**Why this priority**: Dashboards and search make the platform efficient at volume but are
not required for the core flows to function — they enhance rather than enable.

**Independent Test**: Seed a set of items in mixed statuses; verify each role's dashboard
shows correct counts and that filtering a list by status/date/person returns exactly the
matching subset with pagination. Delivers working navigation at scale.

**Acceptance Scenarios**:

1. **Given** a manager with pending items, **When** they open their dashboard, **Then**
   pending review counts are accurate and link to the filtered queue.
2. **Given** a long request list, **When** a user filters by status and date range, **Then**
   only matching items are shown, paginated.
3. **Given** an employee searching their requests, **When** they enter a keyword, **Then**
   matching results are returned and they never see other employees' items.
4. **Given** an HR user on the employee directory, **When** they filter or search, **Then**
   matching employees are returned within their permission scope.

---

### Edge Cases

- Concurrent review: two authorized reviewers open the same pending item and both submit a
  decision — only the first takes effect; the second sees the item's updated state.
- Withdrawal race: an employee withdraws a pending item at the same moment a reviewer
  submits a decision — the first-recorded transition wins; the loser sees the item's
  updated state.
- Manager changes mid-workflow: an employee's manager is reassigned while a request is
  pending — review rights follow the defined workflow assignment; in-flight items are not
  orphaned.
- Resubmission loops: a request can be returned and resubmitted repeatedly; each cycle is
  recorded and does not lose earlier history.
- Deactivated actor: review scope is computed from the live reporting line — when a
  reviewer is deactivated and reports are reassigned, pending items automatically appear
  in the new manager's queue; no items are stranded.
- Unsubmitted composition: request drafts are client-side only — files selected but never
  uploaded leave no server-side artifacts; attachments exist only on persisted items.
- Removed attachment: an attachment removed while its item is editable disappears from
  views and downloads (404) but the record and file are retained per retention policy.
- Expired session mid-action: a session expiring between form fill and submit must not
  silently lose user input beyond reasonable recovery.
- Boundary filters: invalid or out-of-range filter values (e.g., end date before start date)
  produce a clear error, not a broken result set.
- Notification for own action: users are not notified about actions they performed
  themselves.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Access Control**

- **FR-001**: Users MUST authenticate with email and password; the system issues a token
  credential for subsequent access.
- **FR-002**: Every protected function MUST enforce role-based authorization on the server;
  no access decision may rely on the client.
- **FR-003**: The system MUST support exactly three roles — Employee, Manager, HR — with
  role-appropriate default access; a user's effective permissions derive from their role.
- **FR-004**: Failed authentication MUST return a generic error that does not disclose
  whether an email exists.
- **FR-005**: Session credentials MUST expire and support renewal; expired credentials MUST
  be rejected.
- **FR-006**: Object-level access MUST be enforced — users can only read/act on items their
  role and relationship (self, direct report, organization-level) permit.
- **FR-007**: HR MUST be able to set a temporary password when creating an account and to
  reset a user's password on request; a user authenticating with a temporary password MUST
  be required to choose a new password before proceeding.
- **FR-008**: Users MUST be able to change their own password while signed in.

**Employee Profiles**

- **FR-009**: Employees MUST be able to view and update their own editable profile fields.
- **FR-010**: Fields designated HR-managed MUST be read-only to the employee.
- **FR-011**: Employees MUST NOT be able to view or edit other employees' profiles unless
  their role permits it (Manager for direct reports, HR per their permissions).

**Request Types & Requests**

- **FR-012**: HR MUST be able to configure request types, including each type's fields,
  which are required, attachment rules, and the workflow the type follows.
- **FR-013**: Employees MUST be able to create a request from an active request type, with
  required-field validation at submission.
- **FR-014**: Employees MUST be able to view, filter, and track all of their own requests
  with current status.
- **FR-015**: Employees MUST be able to revise and resubmit a request that was returned;
  each cycle MUST be preserved in history.
- **FR-016**: Requests in a final status (approved/rejected/withdrawn as defined by the
  workflow) MUST be immutable.

**Workflow & Review**

- **FR-017**: Request and timesheet statuses MUST change only through defined transitions;
  no path may bypass the workflow.
- **FR-018**: Managers MUST see pending items from their direct reports and be able to
  approve, reject, or return them per the workflow, with comments where the workflow allows
  or requires. "Direct report" is resolved against the current reporting line at read time,
  so reassignment takes effect immediately.
- **FR-019**: HR MUST be able to view and act on items where the workflow assigns them a
  review step (pending or completed). HR does NOT gain blanket item-level visibility;
  organization-wide insight is provided through aggregate dashboards and reports only.
- **FR-020**: A returned item MUST become editable by its submitter and re-enter the
  workflow on resubmission.
- **FR-021**: The system MUST prevent duplicate processing of an item already actioned.
- **FR-022**: Workflow definitions MUST be manageable by HR (statuses, allowed transitions,
  acting role per step); changes MUST NOT retroactively alter completed items.
- **FR-023**: Submitters MUST be able to withdraw their own request or timesheet while it
  is pending (before any reviewer action); a withdrawn item enters a final "Withdrawn"
  state, is immutable, and the withdrawal is recorded in history.

**Timesheets**

- **FR-024**: Employees MUST be able to record time as per-day hour entries and submit one
  timesheet per week.
- **FR-025**: The system MUST prevent duplicate timesheet submissions for the same employee
  and week.
- **FR-026**: Timesheets MUST follow an approval workflow with the same approve/reject/
  return capabilities and controlled transitions as requests.
- **FR-027**: Approved timesheets MUST be read-only.

**Attachments**

- **FR-028**: Users MUST be able to attach files to their own requests while the request
  is in an editable state (pending before any reviewer action, or returned), subject to
  type/size limits.
- **FR-029**: Attachment downloads MUST require authorization against the parent item;
  unauthenticated or unrelated access MUST be denied.
- **FR-030**: Rejected uploads MUST produce a clear, user-readable reason.
- **FR-031**: Request owners MUST be able to remove an attachment while the parent request
  is editable; removal is a soft-delete — the record and file are retained (FR-045) but
  excluded from views and downloads.

**Notifications**

- **FR-032**: The system MUST generate in-app notifications for actionable events:
  items awaiting a user's review, decisions on a user's submissions, and returned items.
- **FR-033**: Users MUST be able to view their notification list with read/unread state,
  mark items read, and navigate from a notification to its related item.
- **FR-034**: Users MUST NOT be notified about actions they performed themselves.

**Audit & History**

- **FR-035**: Every status transition and significant action (submission, approval,
  rejection, return, resubmission, withdrawal, administrative changes to
  employees/types/workflows, credential resets) MUST produce an audit record with actor,
  action, and timestamp.
- **FR-036**: Each request and timesheet MUST expose a chronological, read-only history of
  its audit events to authorized viewers.
- **FR-037**: Audit/history records MUST NOT be editable or deletable through normal use.

**Search, Filtering & Dashboards**

- **FR-038**: Lists of requests, timesheets, employees, and notifications MUST support
  filtering by relevant attributes and MUST be paginated.
- **FR-039**: Search results MUST always respect the requester's access scope — search can
  never surface items the user may not see.
- **FR-040**: Each role MUST have a dashboard summarizing role-relevant state (own open
  items and notifications; pending review queues; organization volumes for HR) with links
  to the underlying filtered lists.

**Security & Data Protection**

- **FR-041**: Error responses MUST NOT expose internals (stack traces, queries, secrets) or
  confirm/deny existence of records the requester may not see.
- **FR-042**: Credentials, tokens, and secrets MUST never appear in logs, audit entries, or
  notification content.
- **FR-043**: Multi-step write operations MUST be atomic — partial persistence on failure
  is not permitted.
- **FR-044**: All list endpoints MUST be paginated by default; unbounded result sets are not
  permitted.
- **FR-045**: Employee records, requests, timesheets, attachments, and audit history MUST
  be retained indefinitely; deactivation disables access but never deletes records, and no
  automatic deletion or anonymization occurs.

### Key Entities

- **User / Account**: A person's sign-in identity — email, credential, active flag, and
  assigned role (Employee, Manager, HR).
- **Employee Profile**: HR record attached to a user — personal/contact fields split
  between employee-editable and HR-managed; links user to their manager (reporting line).
- **Request Type**: HR-configured template defining a request's fields, required fields,
  attachment rules, and associated workflow.
- **Request**: A submitted instance — type, submitter, field values, text, status, and
  related attachments, history, and review actions.
- **Timesheet**: A weekly time record submitted by an employee — week, per-day hour
  entries, status, history.
- **Attachment**: A file attached to a request or timesheet — stored privately, accessible
  only via authorization on the parent item.
- **Workflow / Status Transition**: Definition of statuses, allowed transitions, and the
  role responsible for acting at each step; governs both requests and timesheets.
- **Notification**: An in-app message to a specific user about an event — read/unread
  state, link to the related item.
- **Audit / History Entry**: An immutable record of an action — actor, action, item,
  timestamp — powering item history and organization-level reporting.
- **Manager–Report Relationship**: The reporting line that scopes a manager's review queue
  and team visibility.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of access attempts to functions or items outside a user's role and
  relationship scope are denied — verified across all three roles and unauthenticated
  access.
- **SC-002**: An employee can complete and submit a request (including one attachment) in
  under 2 minutes.
- **SC-003**: A manager can locate and action a pending item from their queue in under 1
  minute from sign-in.
- **SC-004**: Every status transition and review action is attributable — 100% of items
  show a complete, chronological history with actor and timestamp.
- **SC-005**: Notifications for actionable events reach the intended user's list within 30
  seconds of the triggering action.
- **SC-006**: Lists remain responsive and paginated at 10,000 items per category; no list
  returns an unbounded result set.
- **SC-007**: 90% of users complete their primary task (submit a request, action a review,
  submit a timesheet) on the first attempt without assistance.
- **SC-008**: Zero file downloads succeed without authorization on the parent item,
  including via direct links.
- **SC-009**: No user-facing error exposes internal details; a sampling of failure paths
  shows only safe, actionable messages.
- **SC-010**: Users can find a specific item via search/filter in under 30 seconds within
  their permitted scope.

## Assumptions

- **Managers are also employees**: a manager can submit their own requests and timesheets,
  which route to their own manager (or HR where the workflow defines) — the manager role
  adds review capability rather than replacing employee capability.
- **"Return" semantics**: a returned item goes back to the submitter in an editable state
  and re-enters the workflow on resubmission; this is distinct from rejection, which is
  final.
- **Workflow default**: until HR configures otherwise, a single-step manager approval is
  the assumed default workflow; multi-step and HR-involved chains are supported through
  configuration.
- **First-time access**: initial accounts are provisioned by HR (there is no public
  self-registration); HR sets a temporary password at creation, users must change it on
  first sign-in, and password resets are HR-mediated — no self-service email reset in this
  iteration.
- **Leave balances, payroll, and org charts** are out of scope — the platform handles
  requests, timesheets, and their workflows only.
- **Bulk employee import is out of scope** — HR creates employee records one at a time;
  a bulk import capability may be added later without changing the model.
- **Single organization per deployment** for this spec; multi-tenancy is not assumed.
- **Notification delivery** is in-app; email/push channels are not assumed for this
  iteration.
- **Language**: the interface is delivered in a single language for this iteration;
  translatable content is a design consideration, not a functional requirement here.
- **Data retention is indefinite** — records and audit history are never automatically
  deleted or anonymized; a formal retention/erasure policy may be added later.
- **Standard web expectations** apply for uptime and browser support unless later
  specified otherwise.

## Post-implementation deltas (2026-10-16 audit)

Documented for continuity — these extend the original scope and are owned by
the newer specs referenced. Do not retro-apply them to the user stories above.

- **Attendance check-in/out (IMPLEMENTED)** — `apps/attendance` provides
  real check-in/check-out sessions with an in-header "Check In" control and a
  dedicated Attendance page (`/attendance`). Attendance sessions feed the
  002-reports Attendance report. Not present in the original spec; treated as
  part of the core HR surface.
- **Self-service password reset (IMPLEMENTED)** — supersedes the Assumptions
  note "no self-service email reset": `POST /api/auth/password-reset/` +
  `/api/auth/password-reset-confirm/` send an email link and confirm it
  (tests in `tests/integration/test_password_reset.py`). HR-mediated reset
  (FR-007) is retained and unchanged.
- **Localization (IMPLEMENTED)** — the Assumptions note "single language for
  this iteration" is superseded: the app is fully EN/AR with RTL and light/dark
  themes (see "Module: Presentation Layer" below). All features must conform
  to those global presentation rules.
- **Reports & Exports (merged from 002-reports)** — see the dedicated module
  section below; original spec archived in `specs/archive/002-reports/`.
- **Notifications UX (spec-owned by 002)** — FR-032..034 remain the backend
  contract; the delivered UX (bell, unread badge, unread-only dropdown,
  notifications page, mark-all-read) is specified in `002-notifications`.
- **Chat & calls (spec-owned by 003/004)** — direct messaging and
  voice/video calls with persisted call-history events were added after this
  spec; scoped in `003-chat-messaging` and `004-voice-video-calling`.

Unchanged and still authoritative: three roles only (EMPLOYEE/MANAGER/HR —
"Developer"/"Implementor" are job designations, not roles), HR least-privilege
(no blanket item-level access; org insight via aggregate dashboards/reports),
Sun–Sat business week, WITHDRAWN displayed as "Cancelled", request attachments
only (timesheets carry none), inverted date ranges are validation errors,
indefinite retention, manager/reporting-line semantics.

---

## Module: Presentation Layer (merged from `003-ui-ux-shell`)

**Status**: COMPLETED — verified live (light/dark + EN/AR + RTL screenshots).

Global presentation rules that apply to EVERY page and feature. Feature
requirements above and below inherit these; they are not re-stated per module.

- **PR-001**: A single application shell wraps all authenticated routes —
  sidebar nav (role-filtered items: Dashboard, Attendance, Timesheets,
  Requests, Reports, Settings), top header (section title, global search,
  theme toggle, language switcher, chat bell, notification bell, user menu,
  Check In control), responsive collapse on small screens.
- **PR-002**: Light/dark themes, persisted (`cds-theme`), applied globally via
  the MUI theme provider; every component remains legible in both.
- **PR-003**: Full EN/AR localization via i18next, persisted
  (`cds-language`); Arabic implies complete RTL mirroring (layout, icons,
  alignment); dates/times localize.
- **PR-004**: API payloads keep internal values (status enums, etc.) — only
  display labels localize; never localize data.
- **PR-005**: Responsive across desktop/tablet/mobile; every data-driven page
  has loading/empty/error states.
- **PR-006**: Global header search operates within the caller's existing
  authorization scope only.

## Module: Reports & Exports (merged from `002-reports`)

**Status**: PARTIAL — implemented and live (all four reports, scope
enforcement, XLSX/PDF export, EN/AR RTL UI), but the planned report test
suites, export filter-names fix, client-side date guard, and print stylesheet
were never delivered (open tasks RT002–RT004, RT010–RT012, RT015–RT016,
RT018–RT020, RT022–RT025 in `tasks.md` Phase 13).

Reports are computed views over real platform data — no persisted report
entities. Requirements below are the complete migrated set from
`specs/archive/002-reports/spec.md` (now archived); IDs prefixed `R-` to avoid
colliding with the platform FRs above.

### Reports user stories (summary)

- **R-US1 (P1) — Scoped on-screen reports**: Attendance, Timesheets, Requests,
  Employee Summary from one Reports page; filters + summary over the whole
  filtered set; employee sees own data, manager sees self+direct reports, HR
  sees org-wide attendance/employees but only HR-step requests/timesheets.
- **R-US2 (P1) — Filter validation & reset**: invalid combinations
  (inverted range, out-of-scope employee, unsupported status) → field-specific
  validation errors, never silent correction; Reset restores defaults.
- **R-US3 (P2) — Export/print what you see**: XLSX/PDF/print of the current
  filtered, scoped result — CDS branding, title, applied filters, timestamp,
  summary; Arabic exports shaped + RTL; over-cap exports refused with
  "narrow the filters" rather than truncated.
- **R-US4 (P2) — Localized/responsive/themed**: identical EN/AR experience,
  RTL, mobile-usable, light/dark; internal status values never localize.
- **R-US5 (P1) — Attendance & timesheet business rules**: attendance grouped
  per employee-day (first in, last out, worked hours, session count,
  PRESENT/IN_PROGRESS); Sun–Sat business week display; no schedule source of
  truth → required/overtime/late metrics render explicitly "unavailable".

### Reports functional requirements

**Data**

- **R-FR-001**: Four reports — Attendance, Timesheets, Requests, Employee
  Summary — from a single Reports section.
- **R-FR-002**: All rows derive exclusively from real platform data; nothing
  synthesized.
- **R-FR-003**: Attendance groups sessions per employee per day: first
  check-in, last check-out, worked hours, session count, status
  (PRESENT|IN_PROGRESS).
- **R-FR-004**: Timesheet rows preserve the Sun→Sat business week
  (`business_week_start = week_start − 1d`, `week_end = week_start + 5d`).
- **R-FR-005**: Metrics without a source of truth render as explicit
  "unavailable" (`null` + `*_available:false` in API), never invented.
- **R-FR-006**: Employee Summary shows per-employee consolidated metrics —
  attendance days, worked hours, sessions, timesheet counts, logged hours,
  request counts by outcome.
- **R-FR-007**: Summary aggregates cover the entire filtered set, independent
  of pagination.

**Filtering**

- **R-FR-008**: Server-side filters: `date_from`, `date_to`, `employee`,
  and per-report `department`/`status`/`request_type` (attendance supports
  PRESENT/IN_PROGRESS; employee summary supports employee/department/date
  only).
- **R-FR-009**: `date_to < date_from`, malformed dates, non-integer ids,
  unsupported statuses → field-specific `validation_error` (400).
- **R-FR-010**: An employee filter outside the caller's scope → validation
  error, never silently applied.
- **R-FR-011**: UI provides Reset (clear all) and Generate (explicit re-run).

**Authorization** (reuses platform RBAC — FR-006/FR-019)

- **R-FR-012**: Report visibility is server-side, reusing existing scopes:
  EMPLOYEE → own; MANAGER → own + direct reports (live reporting line);
  HR → org-wide attendance, own items, items whose workflow assigns an HR
  step. No blanket item-level visibility for any role.
- **R-FR-013**: Exports apply the identical scope + filters as on-screen
  results — an export can never contain an off-screen-invisible row.
- **R-FR-014**: `GET /api/reports/scope/` returns the caller's permitted
  filter vocabulary (`employees[]`, `departments[]`, `request_types[]`,
  `can_pick_employee`), itself scope-filtered.
- **R-FR-015**: Unauthenticated requests rejected; forced-password-change gate
  applies.

**Exports & print**

- **R-FR-016**: XLSX + PDF exports contain title, applied filters, generation
  timestamp, full filtered rows, summary section.
- **R-FR-017**: Exports carry CDS branding; Arabic PDFs are glyph-shaped +
  RTL-ordered; Arabic XLSX sheets are right-to-left.
- **R-FR-018**: Server-side row caps (xlsx 50 000 / pdf 2 000); exceeding →
  clear "narrow the filters" error.
- **R-FR-019**: Print renders the current report cleanly without app chrome.
  *(print stylesheet not yet implemented — RT015)*
- **R-FR-020**: Export controls show busy/disabled state while generating.

**Presentation** (inherits PR-001…PR-006; report-specific:)

- **R-FR-021**: Reports nav item in the sidebar for all roles.
- **R-FR-022**: Page presents report selection, filter bar, summary cards,
  paginated results table in the CDS design language.
- **R-FR-023**: Distinct loading/empty/validation-error/API-error states.
- **R-FR-024**: Fully EN/AR + RTL + responsive.
- **R-FR-025**: Statuses keep internal values in payloads; display labels
  localize (WITHDRAWN → Cancelled / تم الإلغاء, etc.).

**Quality**

- **R-FR-026**: Backend tests required for builders/endpoints/filters/scope/
  exports. *(pending — RT002/RT003/RT016/RT020)*
- **R-FR-027**: Frontend tests required for rendering/filter/export/i18n
  behavior. *(pending — RT010/RT012/RT018)*

### Reports key entities (logical, not persisted)

- Report (logical view), Report Filters (validated param set echoed in
  `meta.filters`), Report Scope (caller permission envelope), Report Row
  (per report shape — see `data-model.md` § Reports), Report Summary
  (aggregates over the full filtered scope).

### Reports edge cases

- Empty result → explicit empty state; exports still succeed with headers.
- Data changes mid-session → Generate re-queries; never serve stale.
- Manager reassignment → scope follows live reporting line at query time.
- Employee without profile/department → row renders with empty department.
- Unsupported `fmt` → validation error.
- Status groupings in summaries never overwrite per-row internal status.

### Reports success criteria

- **R-SC-001**: Scoped results < 30 s common path.
- **R-SC-002**: 0 out-of-scope rows to any role.
- **R-SC-003**: Every invalid filter input → field-specific error, 0 silent
  corrections or 500s.
- **R-SC-004**: Export row sets equal on-screen filtered sets (id-parity).
- **R-SC-005**: Arabic PDFs shape/RTL correctly.
- **R-SC-006**: Report/export endpoints < 2 s on typical filtered sets.

*Full original narrative (all acceptance scenarios per story) preserved in
`specs/archive/002-reports/spec.md`.*
