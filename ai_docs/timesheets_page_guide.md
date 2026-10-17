# Timesheets — User Guide

## What this page does
See all your weekly timesheets, filter them by status, period and (for
managers/HR) employee, and jump into any week's details.

## Prerequisites
- You are signed in.
- A timesheet exists only after it is submitted from "New timesheet".

## Using the page

1. Open **Timesheets** in the sidebar (highlighted in red when active).
2. At the top right, **+ New timesheet** opens the weekly entry form.
3. The filter bar:
   - **Status** — pick a workflow status (Pending, In review, Returned,
     Approved, Rejected, Cancelled) or "All statuses".
   - **Date range** — pick a period (This week, Last week, Last 4 weeks,
     This month, Last month, or All time). The selected control shows the
     actual Sunday→Saturday span covered.
   - **Employee** — only managers and HR see this; it lists people in your
     scope.
   - Click **Apply** to run the filters, **Clear** to reset everything.
4. The four cards summarize the filtered period: total timesheets plus how
   many are approved, pending or rejected (with each one's share of the
   total). They ignore the Status filter itself so you always see the full
   breakdown of the period.
5. The table lists weeks:

```
WEEK STARTING (SUNDAY) | EMPLOYEE | HOURS | STATUS | SUBMITTED ON | ACTIONS
Jun 2, 2024            | avatar + name/email | 40h | Pending | date + time | ⋯
Jun 2 – Jun 8, 2024
```

   - Click a column header (Week starting / Status / Submitted on) to sort.
   - Click a row — or the **⋯** button → *View details* — to open the
     timesheet. Managers may see *Review*; you may see *Resubmit* on a
     returned timesheet.
6. Bottom of the table: "Page X of Y (N items)" on the left and round
   page controls on the right (current page is red).

## Flow

```
[Filters] → Apply → [Summary cards update] → [Table refreshes]
   Clear → back to defaults
[Row or ⋯ menu] → [Timesheet detail: entries, review actions, history]
```

## Common mistakes
- **You changed a filter but nothing happened** — press **Apply**; the
  selects only take effect then.
- **"No timesheets match the selected filters"** — press **Clear filters**
  inside the empty card.
- **Week column shows Sunday while the form asks for Monday** — the system
  keys each business week by its Monday but displays it as Sunday→Saturday.
  This is intentional and consistent everywhere.

## FAQ
- **Why can't I see the Employee filter?** Only managers and HR can filter by
  employee; employees see their own timesheets.
- **What does "Pending" on the summary card include?** Timesheets that are
  Pending plus those In review.
- **Where do I approve/return a timesheet?** Open the row; the review
  buttons live on the detail page.

## Update 2026-10-12
- Page navigation ("Page X of Y (N items)" plus previous/next arrows) now sits below the timesheets table, outside its bordered card. Behavior is unchanged.
