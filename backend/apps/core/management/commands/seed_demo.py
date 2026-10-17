"""Seed the CDS Business demo dataset — LOCAL DEVELOPMENT ONLY.

Two modes:

* Default (idempotent): creates whatever is missing — org users, profiles,
  reporting lines, request types, workflows, and the rich demo dataset —
  without deleting anything.
* ``--reset``: DESTRUCTIVE. Deletes all demo/transactional data (requests,
  attachments, timesheets, attendance, notifications, audit history, auth
  sessions/tokens, and every non-superuser account) before reseeding.
  Request types and workflows are configuration and are preserved/reused.

Usage:
    python manage.py seed_demo                      # idempotent top-up
    python manage.py seed_demo --reset              # wipe demo data + reseed
    python manage.py seed_demo --reset --password 'CDS!Demo2026'
    python manage.py seed_demo --scale 50           # extra bulk employees

Guardrail: the command refuses to run unless the environment is clearly local
development (DEBUG on, sqlite, or a loopback/docker-compose DB host).
"""
import random
import shutil
from datetime import date, datetime, time, timedelta, timezone as dt_tz
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import EmployeeProfile, User
from apps.attendance.models import AttendanceSession
from apps.audit.models import AuditEntry
from apps.audit.services import record as audit_record
from apps.chat.models import Conversation, ConversationParticipant, Message
from apps.notifications.models import Notification
from apps.notifications.services import emit
from apps.requests.models import Attachment, Request, RequestType
from apps.requests.services import submit_request
from apps.timesheets.models import Timesheet, TimesheetEntry
from apps.workflows import services as wfs
from apps.workflows.models import Workflow, WorkflowStep

DOMAIN = "cdsbussiness.com"
DEFAULT_PASSWORD = "CDS!Demo2026"
SEED = 20261013

# RBAC roles are fixed by the platform: EMPLOYEE / MANAGER / HR.
# "Developer" and "Implementor" are job titles, not authorization roles.
PEOPLE = [
    # (email_local, role, job_title, department, manager_email_local, first, last)
    # --- Managers ---
    ("ramadan.khalil", "MANAGER", "Engineering Manager", "Development", None,
     "Ramadan", "Khalil"),
    ("waleed.elbahar", "MANAGER", "Implementation Manager", "Implementation", None,
     "Waleed", "Elbahar"),
    # --- HR ---
    ("shrouk.youssry", "HR", "HR Administrator", "Project Management", None,
     "Shrouk", "Youssry"),
    # --- Developers → report to Ramadan Khalil ---
    ("omar.alaa", "EMPLOYEE", "Developer", "Development", "ramadan.khalil",
     "Omar", "Alaa"),
    ("abdelrahman.gouda", "EMPLOYEE", "Developer", "Development", "ramadan.khalil",
     "Abdelrahman", "Gouda"),
    ("abdelrahman.menisy", "EMPLOYEE", "Developer", "Development", "ramadan.khalil",
     "Abdelrahman", "Menisy"),
    ("ahmed.nagy", "EMPLOYEE", "Developer", "Development", "ramadan.khalil",
     "Ahmed", "Nagy"),
    ("ahmed.mahdy", "EMPLOYEE", "Developer", "Development", "ramadan.khalil",
     "Ahmed", "Mahdy"),
    ("mohamed.ali", "EMPLOYEE", "Developer", "Development", "ramadan.khalil",
     "Mohamed", "Ali"),
    # --- Implementors → report to Waleed Elbahar ---
    ("islam.gamal", "EMPLOYEE", "Implementor", "Implementation", "waleed.elbahar",
     "Islam", "Gamal"),
    ("ahmed.gamal", "EMPLOYEE", "Implementor", "Implementation", "waleed.elbahar",
     "Ahmed", "Gamal"),
    ("ahmed.elqasas", "EMPLOYEE", "Implementor", "Implementation", "waleed.elbahar",
     "Ahmed", "Elqasas"),
    ("abdelhalim.hamed", "EMPLOYEE", "Implementor", "Implementation", "waleed.elbahar",
     "Abdelhalim", "Hamed"),
    ("mohamed.sobhy", "EMPLOYEE", "Implementor", "Implementation", "waleed.elbahar",
     "Mohamed", "Sobhy"),
    ("osama.elderaby", "EMPLOYEE", "Implementor", "Implementation", "waleed.elbahar",
     "Osama", "Elderaby"),
    ("mostafa.hussien", "EMPLOYEE", "Implementor", "Implementation", "waleed.elbahar",
     "Mostafa", "Hussien"),
]

INDIVIDUALS = [p[0] for p in PEOPLE if p[1] == "EMPLOYEE"]  # devs + implementors
OTHERS = [p[0] for p in PEOPLE if p[1] != "EMPLOYEE"]       # managers + HR

LEAVE_REASONS = [
    "Family commitment", "Personal errand", "Medical appointment",
    "Travel plans", "Family event", "House move", "Visa appointment",
]
REMOTE_REASONS = [
    "Waiting for a delivery", "Focused deep-work day", "Commute disruption",
    "Home internet maintenance", "Doctor visit nearby",
]
EQUIPMENT_ITEMS = [
    ("27-inch monitor", 220), ("USB-C docking station", 160),
    ("Ergonomic keyboard", 75), ("Noise-cancelling headset", 130),
    ("Laptop stand", 45), ("IDE license renewal", 180),
    ("Backup SSD 1TB", 90), ("Webcam 1080p", 60),
]
GENERAL_SUBJECTS = [
    "Update bank account details", "Employment verification letter",
    "Salary certificate request", "Expense reimbursement query",
    "Update emergency contact", "HR policy clarification",
    "Training course approval", "Parking access request",
]
COMMENTS = {
    "approve": ["Looks good, approved.", "OK.", "Approved — go ahead.", ""],
    "reject": ["Outside policy limits.", "Insufficient budget remaining.",
               "Dates conflict with a client deadline."],
    "return": ["Please clarify the dates.", "Can you add more detail?",
               "Split this into two requests."],
    "withdraw": ["No longer needed.", "Submitted by mistake.", ""],
    "submit": ["Updated as requested.", "Fixed, resubmitting.", ""],
}

# Cairo work week: Sunday–Thursday; Friday/Saturday is the weekend.
WORK_WEEKDAYS = {6, 0, 1, 2, 3}  # Python weekday(): Mon=0 … Sun=6
CAIRO = ZoneInfo("Africa/Cairo")  # org timezone — attendance is stored in UTC

AWAITING = "awaiting your review."


def _dt(d, t):
    """Timezone-aware datetime on a local date."""
    return timezone.make_aware(datetime.combine(d, t))


def _monday_of(d):
    return d - timedelta(days=d.weekday())


class Command(BaseCommand):
    help = ("Seed the CDS Business demo dataset (local dev only, idempotent; "
            "--reset wipes demo data).")

    def add_arguments(self, parser):
        parser.add_argument("--password", default=DEFAULT_PASSWORD)
        parser.add_argument(
            "--reset", action="store_true",
            help="DESTRUCTIVE: delete all demo/transactional data before seeding.",
        )
        parser.add_argument(
            "--scale", type=int, default=0,
            help="Also create N extra employees each with a pending request",
        )

    # ------------------------------------------------------------------
    # Safety
    # ------------------------------------------------------------------

    def _assert_local_dev(self):
        """Refuse to run against anything that isn't clearly a local dev DB."""
        db = settings.DATABASES["default"]
        engine = db["ENGINE"]
        if "sqlite" in engine:
            return
        host = (db.get("HOST") or "").lower()
        name = (db.get("NAME") or "").lower()
        local_hosts = {"", "localhost", "127.0.0.1", "::1", "db", "postgres"}
        looks_local = (host in local_hosts or host.startswith("172.")
                       or host.startswith("192.168.") or host.startswith("10."))
        looks_prod = any(k in name for k in ("prod", "staging", "stage"))
        if not (settings.DEBUG and looks_local and not looks_prod):
            raise CommandError(
                "seed_demo refused: this does not look like a local development "
                f"database (engine={engine}, host={host!r}, name={name!r}, "
                f"DEBUG={settings.DEBUG}). Aborting without changes."
            )

    # ------------------------------------------------------------------
    # Reset — destructive, transactional, ORM-only.
    # ------------------------------------------------------------------

    @transaction.atomic
    def _reset_data(self):
        """Delete demo/transactional data. Preserves schema, migrations,
        superusers, and request-type/workflow configuration."""
        for attachment in Attachment.objects.all():
            attachment.file.delete(save=False)
        Attachment.objects.all().delete()
        Request.objects.all().delete()
        Timesheet.objects.all().delete()  # entries cascade
        AttendanceSession.objects.all().delete()
        Notification.objects.all().delete()
        AuditEntry.objects.all().delete()
        Conversation.objects.all().delete()  # participants + messages cascade
        deleted = User.objects.filter(is_superuser=False).delete()[0]

        # Orphaned upload tree (all attachment rows are gone now).
        attachments_dir = settings.MEDIA_ROOT / "attachments"
        if attachments_dir.exists():
            shutil.rmtree(attachments_dir, ignore_errors=True)

        # Dead auth/session state for removed accounts.
        from django.contrib.sessions.models import Session
        Session.objects.all().delete()
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken, OutstandingToken,
        )
        BlacklistedToken.objects.all().delete()
        OutstandingToken.objects.all().delete()
        return deleted

    # ------------------------------------------------------------------
    # People / config
    # ------------------------------------------------------------------

    def _ensure_users(self, password):
        users = {}
        for local, role, title, dept, _mgr, first, last in PEOPLE:
            email = f"{local}@{DOMAIN}"
            user = User.objects.filter(email=email).first() or User(email=email)
            user.role = role
            user.is_active = True
            user.must_change_password = False
            if not user.pk or not user.check_password(password):
                user.set_password(password)
            user.save()
            profile, _ = EmployeeProfile.objects.get_or_create(user=user)
            profile.first_name = first
            profile.last_name = last
            profile.job_title = title
            profile.department = dept
            prng = random.Random(f"{SEED}:{email}")
            if not profile.hire_date:
                profile.hire_date = date(2021, 6, 1) + timedelta(
                    days=prng.randint(0, 1400))
            if not profile.phone:
                profile.phone = (
                    f"+20 10 {prng.randint(1000, 9999)} {prng.randint(1000, 9999)}")
            profile.save()
            users[local] = user
        # Reporting lines (second pass so every manager exists).
        for local, _role, _t, _d, mgr, _f, _l in PEOPLE:
            if mgr and users[local].manager_id != users[mgr].pk:
                users[local].manager = users[mgr]
                users[local].save()
        return users

    def _ensure_workflows(self):
        wf_manager, _ = Workflow.objects.get_or_create(name="Manager approval")
        if not wf_manager.steps.exists():
            WorkflowStep.objects.create(
                workflow=wf_manager, order=1, actor_role="MANAGER")

        wf_two, _ = Workflow.objects.get_or_create(name="Manager + HR approval")
        if not wf_two.steps.exists():
            WorkflowStep.objects.create(
                workflow=wf_two, order=1, actor_role="MANAGER")
            WorkflowStep.objects.create(
                workflow=wf_two, order=2, actor_role="HR")

        wf_hr, _ = Workflow.objects.get_or_create(name="HR approval")
        if not wf_hr.steps.exists():
            WorkflowStep.objects.create(
                workflow=wf_hr, order=1, actor_role="HR")
        return wf_manager, wf_two, wf_hr

    def _ensure_request_types(self, wf_manager, wf_two, wf_hr):
        leave_schema = [
            {"key": "start_date", "label": "Start date", "type": "date",
             "required": True},
            {"key": "end_date", "label": "End date", "type": "date",
             "required": True},
            {"key": "reason", "label": "Reason", "type": "text",
             "required": False},
        ]
        specs = [
            ("Annual Leave", wf_manager, leave_schema),
            ("Sick Leave", wf_manager, leave_schema),
            ("Remote Work", wf_manager, leave_schema),
            ("Equipment Purchase", wf_two, [
                {"key": "item", "label": "Item", "type": "text", "required": True},
                {"key": "amount", "label": "Estimated cost", "type": "number",
                 "required": True},
                {"key": "urgency", "label": "Urgency", "type": "choice",
                 "required": True, "choices": ["low", "normal", "high"]},
            ]),
            ("General Request", wf_hr, [
                {"key": "subject", "label": "Subject", "type": "text",
                 "required": True},
                {"key": "details", "label": "Details", "type": "text",
                 "required": True},
                {"key": "priority", "label": "Priority", "type": "choice",
                 "required": True, "choices": ["low", "normal", "high"]},
            ]),
        ]
        types = {}
        for name, wf, schema in specs:
            rtype, _ = RequestType.objects.get_or_create(
                name=name,
                defaults={"workflow": wf, "fields_schema": schema,
                          "allow_attachments": True},
            )
            types[name] = rtype
        return types

    # ------------------------------------------------------------------
    # Backdating helpers — auto_now/auto_now_add fields can only be moved
    # with queryset.update(). Every audit entry and notification created by
    # wf.act()/emit() is re-timestamped so item history stays consistent.
    # ------------------------------------------------------------------

    def _touch_item(self, item, submitted_dt, last_dt):
        type(item).objects.filter(pk=item.pk).update(
            submitted_at=submitted_dt, created_at=submitted_dt, updated_at=last_dt)

    def _act_and_stamp(self, rng, item, action, actor, now, last_dt):
        """Run one real workflow transition, then backdate the artifacts it
        created (audit entry + notifications). Returns the action datetime."""
        kind = item.AUDIT_ITEM_TYPE
        dt = min(now, last_dt + timedelta(
            hours=rng.randint(3, 30), minutes=rng.randint(0, 59)))
        if action in wfs.REVIEW_ACTIONS:
            # Reviewer typically reads the 'awaiting review' nudge first.
            for n in Notification.objects.filter(
                    item_type=kind, item_id=item.pk, read_at__isnull=True):
                if n.message.endswith(AWAITING) and rng.random() < 0.8:
                    Notification.objects.filter(pk=n.pk).update(
                        read_at=dt - timedelta(minutes=rng.randint(1, 30)))

        before_a = set(AuditEntry.objects.filter(
            item_type=kind, item_id=item.pk).values_list("pk", flat=True))
        before_n = set(Notification.objects.filter(
            item_type=kind, item_id=item.pk).values_list("pk", flat=True))
        wfs.act(item, actor, action, comment=rng.choice(COMMENTS[action]))
        AuditEntry.objects.filter(item_type=kind, item_id=item.pk).exclude(
            pk__in=before_a).update(created_at=dt)
        for n in Notification.objects.filter(
                item_type=kind, item_id=item.pk).exclude(pk__in=before_n):
            read = None
            if not n.message.endswith(AWAITING) and rng.random() < 0.7:
                read = min(now, dt + timedelta(hours=rng.randint(1, 48)))
            Notification.objects.filter(pk=n.pk).update(
                created_at=dt, read_at=read)
        item.refresh_from_db(
            fields=["status", "current_step", "current_actor_role"])
        return dt

    def _reviewer(self, item):
        """The user the workflow engine considers the current actor."""
        step = wfs.current_step(item)
        if step is None:
            return None
        if step["actor_role"] == "MANAGER":
            return item.submitter.manager
        return User.objects.filter(role="HR", is_active=True).first()

    # ------------------------------------------------------------------
    # Requests
    # ------------------------------------------------------------------

    def _values_for(self, rng, rtype, submitted_dt):
        name = rtype.name
        if name in ("Annual Leave", "Sick Leave", "Remote Work"):
            start = submitted_dt.date() + timedelta(days=rng.randint(2, 21))
            if name == "Sick Leave":
                start = submitted_dt.date() - timedelta(days=rng.randint(0, 1))
            end = start + timedelta(days=rng.randint(0, 4 if name != "Sick Leave" else 2))
            reasons = REMOTE_REASONS if name == "Remote Work" else LEAVE_REASONS
            return {"start_date": start.isoformat(), "end_date": end.isoformat(),
                    "reason": rng.choice(reasons)}
        if name == "Equipment Purchase":
            item, amount = rng.choice(EQUIPMENT_ITEMS)
            return {"item": item, "amount": amount + rng.randint(0, 40),
                    "urgency": rng.choice(["low", "normal", "normal", "high"])}
        return {"subject": rng.choice(GENERAL_SUBJECTS),
                "details": "Please advise on the next steps for this request.",
                "priority": rng.choice(["low", "normal", "normal", "high"])}

    def _seed_request(self, rng, submitter, rtype, now):
        """Create one request via the real submission service, then drive it
        through the real workflow engine — audit entries and notifications are
        genuine, only their timestamps are moved into the past."""
        submitted_dt = now - timedelta(
            days=rng.randint(2, 70), hours=rng.randint(0, 9),
            minutes=rng.randint(0, 59))
        item = submit_request(
            submitter, rtype, self._values_for(rng, rtype, submitted_dt))

        AuditEntry.objects.filter(
            item_type="request", item_id=item.pk).update(created_at=submitted_dt)
        Notification.objects.filter(
            item_type="request", item_id=item.pk).update(
            created_at=submitted_dt, read_at=None)

        last_dt = submitted_dt
        roll = rng.random()
        if roll < 0.45:
            target = "approve"
        elif roll < 0.70:
            target = "park"      # stays PENDING, or IN_REVIEW for 2-step types
        elif roll < 0.78:
            target = "reject"
        elif roll < 0.87:
            target = "return"
        else:
            target = "withdraw"

        def do(action, actor):
            nonlocal last_dt
            last_dt = self._act_and_stamp(rng, item, action, actor, now, last_dt)

        try:
            if target == "approve":
                while item.status != "APPROVED":
                    r = self._reviewer(item)
                    if r is None or "approve" not in wfs.available_actions(item, r):
                        break
                    do("approve", r)
            elif target == "park":
                # Multi-step items parked after step 1 land IN_REVIEW in the
                # HR queue; single-step items stay PENDING with the manager.
                if len(item.workflow_snapshot) > 1 and rng.random() < 0.45:
                    r = self._reviewer(item)
                    if r and "approve" in wfs.available_actions(item, r):
                        do("approve", r)
            elif target == "reject":
                r = self._reviewer(item)
                if r and "reject" in wfs.available_actions(item, r):
                    do("reject", r)
            elif target == "return":
                r = self._reviewer(item)
                if r and "return" in wfs.available_actions(item, r):
                    do("return", r)
                    if rng.random() < 0.45:  # some get fixed and approved
                        do("submit", item.submitter)
                        while item.status != "APPROVED":
                            r = self._reviewer(item)
                            if r is None or "approve" not in wfs.available_actions(item, r):
                                break
                            do("approve", r)
            elif target == "withdraw":
                do("withdraw", item.submitter)
        except Exception as exc:  # keep whatever consistent state was reached
            self.stderr.write(
                f"warning: request {item.pk} chain stopped early: {exc}")

        self._touch_item(item, submitted_dt, last_dt)
        return item

    def _seed_requests_for(self, rng, user, types, now):
        names = list(types)
        weights = {"Annual Leave": 30, "Sick Leave": 20, "Remote Work": 20,
                   "Equipment Purchase": 15, "General Request": 15}
        for _ in range(rng.randint(8, 13)):
            rtype = types[rng.choices(
                names, weights=[weights[x] for x in names])[0]]
            self._seed_request(rng, user, rtype, now)

    # ------------------------------------------------------------------
    # Attachments — a few real files on editable requests (FR-029/030).
    # ------------------------------------------------------------------

    def _seed_attachments(self, rng):
        editable = [
            r for r in Request.objects.select_related(
                "submitter", "request_type")
            if r.request_type.allow_attachments
            and (r.status == "RETURNED"
                 or (r.status == "PENDING" and not wfs.has_reviewer_action(r)))
        ]
        rng.shuffle(editable)
        for req in editable[:8]:
            if rng.random() < 0.5:
                content = ContentFile(
                    b"Request supporting note.\nGenerated demo attachment.\n",
                    name="supporting-note.txt")
                ctype = "text/plain"
            else:
                content = ContentFile(
                    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
                    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
                    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>"
                    b"endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
                    name="supporting-doc.pdf")
                ctype = "application/pdf"
            Attachment.objects.create(
                request=req, file=content, original_name=content.name,
                content_type=ctype, size=content.size,
                uploaded_by=req.submitter)

    # ------------------------------------------------------------------
    # Attendance — Sun–Thu work week, realistic sessions, never today.
    # ------------------------------------------------------------------

    def _seed_attendance_for(self, rng, user, now):
        today = timezone.localdate()
        sessions = []
        for days_ago in range(1, 57):  # ~8 weeks back, never today/future
            d = today - timedelta(days=days_ago)
            if d.weekday() not in WORK_WEEKDAYS:
                if rng.random() > 0.03:  # rare weekend shift
                    continue
            elif rng.random() < 0.07:  # occasional absence
                continue

            check_in = datetime.combine(
                d, time(rng.randint(8, 10),
                        rng.choice([15, 30, 30, 45, 45, 50])),
                tzinfo=CAIRO).astimezone(dt_tz.utc)
            worked_minutes = rng.randint(390, 570)  # 6.5–9.5 h
            if rng.random() < 0.16:  # split around a break → two sessions
                first = rng.randint(240, 300)
                s1_out = check_in + timedelta(minutes=first)
                s2_in = s1_out + timedelta(minutes=rng.randint(40, 80))
                s2_out = min(
                    s2_in + timedelta(minutes=max(60, worked_minutes - first)),
                    datetime.combine(d, time(19, 30), tzinfo=CAIRO)
                    .astimezone(dt_tz.utc))
                sessions.append(AttendanceSession(
                    submitter=user, work_date=d, check_in_at=check_in,
                    check_out_at=s1_out,
                    worked_duration=s1_out - check_in))
                sessions.append(AttendanceSession(
                    submitter=user, work_date=d, check_in_at=s2_in,
                    check_out_at=s2_out,
                    worked_duration=s2_out - s2_in))
            else:
                check_out = check_in + timedelta(minutes=worked_minutes)
                latest_out = datetime.combine(
                    d, time(19, 30), tzinfo=CAIRO).astimezone(dt_tz.utc)
                if check_out > latest_out:
                    check_out = latest_out
                sessions.append(AttendanceSession(
                    submitter=user, work_date=d, check_in_at=check_in,
                    check_out_at=check_out,
                    worked_duration=check_out - check_in))
        created = AttendanceSession.objects.bulk_create(sessions)
        for s in created:  # realistic created_at/updated_at
            AttendanceSession.objects.filter(pk=s.pk).update(
                created_at=s.check_in_at,
                updated_at=s.check_out_at or s.check_in_at)
        return len(created)

    # ------------------------------------------------------------------
    # Timesheets — Monday-keyed weeks (Sun–Sat business week), entries
    # derived from the same user's real attendance that week.
    # ------------------------------------------------------------------

    def _seed_timesheet_for_week(self, rng, user, week_start, workflow, now):
        if Timesheet.objects.filter(
                submitter=user, week_start=week_start).exists():
            return None
        today = timezone.localdate()
        entries = []
        for i in range(7):
            d = week_start + timedelta(days=i)
            if d >= today:
                continue  # no completed future entries
            worked = AttendanceSession.objects.filter(
                submitter=user, work_date=d).aggregate(t=Sum("worked_duration"))["t"]
            if worked:
                hours = round(worked.total_seconds() / 900) / 4  # nearest 0.25h
                entries.append(TimesheetEntry(
                    date=d, hours=min(max(hours, 0.5), 12)))
            elif d.weekday() in WORK_WEEKDAYS and rng.random() < 0.04:
                entries.append(TimesheetEntry(date=d, hours=rng.choice([4, 6, 8])))
        if not entries:
            return None

        steps = workflow.snapshot_steps()
        weeks_ago = (today - week_start).days // 7
        is_current = weeks_ago == 0

        # Submission: end of the business week (Sat = week_start+5) through
        # the following Tuesday; the current week submits "now-ish".
        submitted_dt = min(
            now - timedelta(hours=rng.randint(1, 30)),
            _dt(week_start + timedelta(days=5), time(rng.randint(15, 21)))
            + timedelta(days=rng.randint(0, 2)))

        item = Timesheet(
            submitter=user, week_start=week_start,
            workflow_snapshot=steps, current_step=0,
            current_actor_role=steps[0]["actor_role"],
            requires_hr_review=any(s["actor_role"] == "HR" for s in steps))
        item.save()
        TimesheetEntry.objects.bulk_create(
            TimesheetEntry(timesheet=item, date=e.date, hours=e.hours)
            for e in entries)
        audit_record(item, user, action="submit", to_status=item.status)
        step = wfs.current_step(item)
        if step:
            emit(wfs.step_actors(item, step), item,
                 "A timesheet is awaiting your review.", actor=user)
        AuditEntry.objects.filter(
            item_type="timesheet", item_id=item.pk).update(
            created_at=submitted_dt)
        Notification.objects.filter(
            item_type="timesheet", item_id=item.pk).update(
            created_at=submitted_dt, read_at=None)

        last_dt = submitted_dt
        roll = rng.random()
        if is_current:
            target = None  # stays in the manager's review queue
        elif weeks_ago == 1:
            target = ("approve" if roll < 0.45
                      else "return" if roll < 0.62 else None)
        else:
            target = ("approve" if roll < 0.85
                      else "return" if roll < 0.93 else "reject")

        def do(action, actor):
            nonlocal last_dt
            last_dt = self._act_and_stamp(rng, item, action, actor, now, last_dt)

        manager = user.manager
        try:
            if target == "approve" and manager:
                do("approve", manager)
            elif target == "return" and manager:
                do("return", manager)
                if rng.random() < 0.5:
                    do("submit", user)
                    if "approve" in wfs.available_actions(item, manager):
                        do("approve", manager)
            elif target == "reject" and manager:
                do("reject", manager)
        except Exception as exc:
            self.stderr.write(
                f"warning: timesheet {item.pk} chain stopped early: {exc}")

        self._touch_item(item, submitted_dt, last_dt)
        return item

    # ------------------------------------------------------------------
    # Chat
    # ------------------------------------------------------------------

    # (user_a, user_b, [ (minutes_ago, sender_is_a, body) ... ], a_read, b_read)
    # *_read = whether that side has read up to the latest message.
    CHAT_SCRIPTS = [
        ("ahmed.nagy", "ramadan.khalil", [
            (2950, True, "Hi Ramadan, the timesheet for last week is ready."),
            (2940, False, "Great, I'll review it today."),
            (140, True, "Any update on the annual leave request?"),
            (135, False, "Approved it this morning ✅"),
            (25, False, "Can you send me the updated deployment checklist?"),
        ], True, False),
        ("ahmed.nagy", "ahmed.mahdy", [
            (4300, False, "Did you push the fix for the login redirect?"),
            (4290, True, "Yes, it's on staging now."),
            (60, False, "Can you re-check? Still seeing the old behaviour."),
        ], True, False),
        ("shrouk.youssry", "ahmed.nagy", [
            (2870, True, "Ahmed, please update your emergency contact info."),
            (2860, False, "Done, submitted the form."),
            (2855, True, "Thanks!"),
        ], True, True),
        ("islam.gamal", "waleed.elbahar", [
            (1500, True, "Client asked to move the kickoff to Sunday."),
            (1480, False, "Ok, I'll update the calendar invite."),
        ], True, True),
        ("omar.alaa", "mohamed.ali", [
            (200, True, "Standup moved to 10:30 today."),
            (195, False, "Got it 👍"),
        ], True, True),
        ("abdelhalim.hamed", "ahmed.elqasas", [
            (90, True, "The sandbox environment is back online."),
        ], False, False),
    ]

    def _seed_chat(self, users, now):
        """Idempotent: skips pairs that already have a direct conversation."""
        created = 0
        for a_local, b_local, script, a_read, b_read in self.CHAT_SCRIPTS:
            a, b = users.get(a_local), users.get(b_local)
            if not a or not b:
                continue
            exists = Conversation.objects.filter(
                memberships__user=a).filter(memberships__user=b).exists()
            if exists:
                continue
            conv = Conversation.objects.create(kind=Conversation.Kind.DIRECT)
            ConversationParticipant.objects.create(conversation=conv, user=a)
            ConversationParticipant.objects.create(conversation=conv, user=b)
            last_dt = None
            for minutes_ago, from_a, body in script:
                sent = now - timedelta(minutes=minutes_ago)
                msg = Message.objects.create(
                    conversation=conv, sender=a if from_a else b, body=body)
                Message.objects.filter(pk=msg.pk).update(created_at=sent)
                last_dt = sent
            conv.last_message_at = last_dt
            conv.save(update_fields=["last_message_at"])
            # last_read_at semantics: >= last message ⇒ that side has read it.
            ConversationParticipant.objects.filter(
                conversation=conv, user=a).update(
                last_read_at=last_dt if a_read else last_dt - timedelta(seconds=1))
            ConversationParticipant.objects.filter(
                conversation=conv, user=b).update(
                last_read_at=last_dt if b_read else last_dt - timedelta(seconds=1))
            created += 1
        return created

    def handle(self, *args, **options):
        self._assert_local_dev()
        password = options["password"]
        now = timezone.now()

        if options["reset"]:
            deleted = self._reset_data()
            self.stdout.write(
                f"Reset complete — removed {deleted} object(s) including all "
                "demo accounts and transactional data.")

        users = self._ensure_users(password)
        wf_manager, wf_two, wf_hr = self._ensure_workflows()
        types = self._ensure_request_types(wf_manager, wf_two, wf_hr)

        for local in INDIVIDUALS:
            user = users[local]
            # Dedicated rng stream per concern so skip/create decisions are
            # stable regardless of which slices already exist (idempotency).
            if not Request.objects.filter(submitter=user).exists():
                self._seed_requests_for(
                    random.Random(f"{SEED}:{local}:req"), user, types, now)
            if not AttendanceSession.objects.filter(submitter=user).exists():
                self._seed_attendance_for(
                    random.Random(f"{SEED}:{local}:att"), user, now)
            monday = _monday_of(timezone.localdate())
            for weeks_ago in range(0, 7):
                rng = random.Random(f"{SEED}:{local}:ts:{weeks_ago}")
                # Leave ~35% of current-week timesheets uncreated so the
                # "new timesheet" flow stays testable in the UI.
                if weeks_ago == 0 and rng.random() < 0.35:
                    continue
                self._seed_timesheet_for_week(
                    rng, user, monday - timedelta(weeks=weeks_ago),
                    wf_manager, now)

        # Managers + HR get attendance history too (UI/report completeness).
        for local in OTHERS:
            user = users[local]
            if not AttendanceSession.objects.filter(submitter=user).exists():
                self._seed_attendance_for(
                    random.Random(f"{SEED}:{local}:att"), user, now)
        # A couple of org-level requests per manager → lands in the HR queue.
        for local in ("ramadan.khalil", "waleed.elbahar"):
            user = users[local]
            if not Request.objects.filter(submitter=user).exists():
                rng = random.Random(f"{SEED}:{local}:own")
                for _ in range(2):
                    self._seed_request(
                        rng, user, types["General Request"], now)

        if not Attachment.objects.exists():
            self._seed_attachments(random.Random(SEED))

        chat_created = self._seed_chat(users, now)
        if chat_created:
            self.stdout.write(f"Seeded {chat_created} chat conversations.")

        scale = options["scale"]
        if scale:
            rtype = RequestType.objects.get(name="Annual Leave")
            snapshot = rtype.workflow.snapshot_steps()
            manager = users["ramadan.khalil"]
            for i in range(scale):
                email = f"bulk{i}@{DOMAIN}"
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={"role": "EMPLOYEE", "manager": manager,
                              "must_change_password": False})
                if created:
                    user.set_password(password)
                    user.save()
                    EmployeeProfile.objects.create(
                        user=user, first_name=f"Bulk{i}", last_name="Demo",
                        job_title="Developer", department="Development")
                Request.objects.create(
                    request_type=rtype, submitter=user,
                    values={"start_date": "2026-11-01",
                            "end_date": "2026-11-02"},
                    workflow_snapshot=snapshot, current_actor_role="MANAGER")
            self.stdout.write(f"Seeded {scale} bulk employees + requests.")

        total = User.objects.count()
        self.stdout.write(self.style.SUCCESS(
            "\nDemo dataset ready.\n"
            f"  users:         {total}"
            + (f" (16 CDS + {total - 16} bulk/other)" if total > 16 else "") + "\n"
            f"  requests:      {Request.objects.count()}\n"
            f"  timesheets:    {Timesheet.objects.count()}\n"
            f"  attendance:    {AttendanceSession.objects.count()} sessions\n"
            f"  notifications: {Notification.objects.count()}\n"
            f"  conversations: {Conversation.objects.count()}\n"
            f"  chat messages: {Message.objects.count()}\n"
            f"  audit entries: {AuditEntry.objects.count()}\n"
            f"  attachments:   {Attachment.objects.count()}\n"
            f"  request types: {RequestType.objects.count()}\n\n"
            f"Demo login — any @cdsbussiness.com account, password {password!r}:\n"
            "  ahmed.nagy@cdsbussiness.com        (Developer)\n"
            "  islam.gamal@cdsbussiness.com     (Implementor)\n"
            "  ramadan.khalil@cdsbussiness.com  (Manager)\n"
            "  waleed.elbahar@cdsbussiness.com  (Manager)\n"
            "  shrouk.youssry@cdsbussiness.com  (HR)"
        ))
