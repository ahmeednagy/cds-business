## MODULE: seed_demo (apps.core management command)
## VERSION: 2.0
## LAST_UPDATED: 2026-10-13

### MODELS
- seed creates: User(role:EMPLOYEE|MANAGER|HR, manager FK self, must_change_password=False, is_active=True) | EmployeeProfile(first_name,last_name,job_title,department,hire_date,phone) | Request(values:JSON,status,workflow_snapshot,current_actor_role,requires_hr_review) | Timesheet(week_start:Monday-keyed,status,workflow_snapshot) | TimesheetEntry(date,hours 0.25-rounded from attendance) | AttendanceSession(work_date,check_in_at,check_out_at,worked_duration) | Notification(via emit()) | AuditEntry(via audit_record) | Attachment(real ContentFile, editable requests only) | RequestType | Workflow+WorkflowStep

### METHODS
- handle(--password=CDS!Demo2026, --reset, --scale N) → stdout summary | entry | calls _assert_local_dev always
- _assert_local_dev() → None|CommandError | always | blocks non-sqlite non-local-host or non-DEBUG or *prod/staging* db names
- _reset_data() → int deleted | --reset only, atomic | wipes attachments+files, requests, timesheets(+entries), attendance, notifications, audit, non-superuser users, django sessions, jwt blacklist, media/attachments tree
- _ensure_users(password) → dict local→User | always | converges role/active/must_change_password/profile; sets password only if not already matching; second pass wires manager FKs
- _ensure_workflows() → (wf_manager, wf_two, wf_hr) | get_or_create | adds steps only if none exist
- _ensure_request_types(...) → dict name→RequestType | get_or_create | 5 types, see VIEWS
- _seed_request(rng,submitter,rtype,now) → Request | per missing-user | submit_request() then wfs.act() chain; backdates submitted_at/created_at/updated_at + AuditEntry.created_at + Notification.created_at/read_at
- _seed_requests_for(rng,user,types,now) | 8–13 requests, weighted types
- _seed_attachments(rng) | ≤8 files on editable requests only (PENDING-no-action or RETURNED)
- _seed_attendance_for(rng,user,now) → int | days 1–56 back, Sun–Thu workdays, ~7% absence, ~16% split sessions, ~3% weekend, Cairo-local in/out windows stored UTC, never today, never open
- _seed_timesheet_for_week(rng,user,week_start,workflow,now) → Timesheet|None | skips if (submitter,week_start) exists; entries only for days < today derived from Sum(worked_duration)
- _act_and_stamp(rng,item,action,actor,now,last_dt) → dt | wf.act() + backdate artifacts + 80% read 'awaiting review' notifs before review actions
- _reviewer(item) → User|None | live manager for MANAGER step, first active HR for HR step
- --scale N | bulk{i}@cdsbussiness.com EMPLOYEE + pending Annual Leave, manager=ramadan.khalil

### VIEWS
- workflows: "Manager approval"(1×MANAGER) | "Manager + HR approval"(MANAGER→HR) | "HR approval"(1×HR)
- request types: Annual Leave/Sick Leave/Remote Work→Manager approval (start_date,end_date,reason) | Equipment Purchase→Mgr+HR (item,amount,urgency choice) | General Request→HR (subject,details,priority choice)
- timesheets use wf "Manager approval" snapshot (matches default_workflow() first-active-by-id)

### SECURITY
- seed_demo RBAC roles: EMPLOYEE×13(Developer 6/Implementor 7 titles), MANAGER×2, HR×1 — no new auth roles
- --reset deletes ALL non-superuser users; superusers preserved
- HR visibility unchanged: only requires_hr_review items (General Request + Equipment step-2)
- passwords set via set_password(); must_change_password=False for demo login

### DEPENDENCIES
- apps.requests.services.submit_request → real submission path (audit+notify)
- apps.workflows.services.act/available_actions/current_step/step_actors → real transitions
- apps.notifications.services.emit → notifications are engine-generated, backdated via .update()

### EXTERNAL_LINKS
- User.manager ↔ User (self FK, SET_NULL) | Request/Timesheet.submitter ↔ User PROTECT | Attachment.request → CASCADE

### KNOWN_CONSTRAINTS
- auto_now/auto_now_add fields backdated via queryset.update() only (save() would overwrite)
- rng streams are per-user per-concern (`{SEED}:{local}:req|att|ts:{week}`) so reruns stay identical
- ~35% of current-week timesheets intentionally left uncreated (UI create-flow testable)
- no attendance/notifications seeded for "today"; no open sessions; no future completed rows
- HR (shrouk.youssry) intentionally has no own requests/timesheets; managers have 2 General Requests each → HR queue
- WITHDRAWN only via submitter withdraw on untouched PENDING items (engine constraint)
- email domain is literally cdsbussiness.com (sic) — centralized in DOMAIN constant

### CHANGE_LOG
- 2026-10-13 | rewrote seed_demo: CDS org (16 users), --reset wipe w/ local-dev guard, Cairo-tz attendance, real workflow-engine transitions, deterministic rng, --scale kept
