# Demo Data — End-User Guide

## What this is

The CDS Business demo environment comes pre-loaded with a realistic company:
16 people, their requests, timesheets, attendance history, and notifications.
You can log in as anyone and try the app right away.

## Logging in

1. Open the app (usually `http://localhost:5173`).
2. Enter any demo email and the shared password: **`CDS!Demo2026`**

Pick an account based on what you want to see:

| If you want to see… | Log in as |
|---|---|
| An employee's view (requests, timesheets, check-in) | `ahmed.nagy@cdsbussiness.com` |
| A manager's view (team review queues, team list) | `ramadan.khalil@cdsbussiness.com` |
| The other team's manager | `waleed.elbahar@cdsbussiness.com` |
| The HR view (employee admin, org-wide attendance, HR-step reviews) | `shrouk.youssry@cdsbussiness.com` |

## What you'll see

```
Login → Dashboard (your stats, hours chart, notifications)
           ├─ Attendance: this week's check-ins (Sun–Sat)
           ├─ Timesheets: weekly sheets, Approve/Pending/etc.
           ├─ Requests: leave, remote work, equipment, general
           ├─ Notifications: review nudges + outcomes
           ├─ Reports: attendance / timesheets / requests / employees
           └─ (Manager) Employees: your direct reports + pending counts
           └─ (HR) Admin: employees, request types, workflows
```

- **Pending requests** are waiting on a real reviewer — as a manager you'll
  find them under "Awaiting my review" on the Requests page.
- **Cancelled** requests are withdrawn ones (internal status `WITHDRAWN`).
- The **Check In** button is free to use — today's attendance is deliberately
  left empty so you can try it.

## Rebuilding the demo data

If the data gets messy during testing, reset it (this deletes the demo
dataset and rebuilds it — dev environments only):

```bash
docker compose exec backend python manage.py seed_demo --reset
```

## Common mistakes

- **Wrong password**: it's `CDS!Demo2026` (case matters) for every account.
- **"Request types" are missing**: run `seed_demo` (not `--reset`) — it adds
  anything that's missing without deleting data.
- **No data at all**: make sure the backend container is up and migrations
  ran (`docker compose ps`, `docker compose logs backend`).

## FAQ

**Can I approve my own request?**
No — requests go to your manager (or HR for General Requests). Log in as that
reviewer to act on them.

**Why can't HR see my Annual Leave request?**
By design: HR only sees requests whose workflow includes an HR step
(Equipment Purchase, General Request) plus org-wide aggregates in Reports.

**Does resetting delete my admin/superuser account?**
No — `--reset` only removes non-superuser demo accounts and transactional
data. Schema, migrations, and request-type/workflow configuration survive.

**Why do some check-in times look shifted?**
Attendance is stored in UTC and shown in your browser's timezone. The demo
times were generated for Cairo working hours.
