# Reports Page — User Guide

The Reports page gives you scoped, exportable views of attendance,
timesheets, requests, and per-employee summaries.

## What you see
1. **Header** — "Reports" with **Export XLSX** and **Export PDF** buttons.
2. **Filter card** — pick the report, date range (From/To), and extra filters
   that depend on the report (Employee, Department, Status, Request type).
   Click **Apply** to run, **Clear** to reset the filters.
3. **Four summary cards** — key totals for the current report and filters.
4. **Table** — the report rows.
5. **Pagination** — under the table.

## Using it
1. Choose a report from the **Report** dropdown: Attendance, Timesheets,
   Requests, or Employees.
2. Set optional filters, then click **Apply**.
3. Click **Export XLSX** or **Export PDF** to download the current filtered
   report.
4. Use the ⋯ button on a row to open a request or timesheet's detail page
   (available where a detail page exists).

```
[Choose report] → [set filters] → [Apply] → [table + cards update]
                                          → [Export XLSX/PDF downloads]
```

## FAQ
- **Why is there no Employee dropdown?** Employees see only their own data,
  so the picker is hidden; managers/HR see the employees in their scope.
- **Why is a row's ⋯ button greyed out?** Attendance-day and employee-summary
  rows have no detail page — only requests and timesheets open further.
- **Why did I get an error after picking dates?** "To" must be on or after
  "From"; fix the dates and Apply again.
