/** Regression: New Timesheet must default to the Monday of the CURRENT week,
 * computed from the user's local date — never hardcoded, never UTC-shifted.
 * Convention: Sunday belongs to the upcoming week (Sun → next Monday). */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import NewTimesheetPage from "../src/features/timesheets/new";
import { AppThemeProvider } from "../src/theme";
import { localISO, mondayOf } from "../src/lib/dates";

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock("../src/lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../src/lib/api")>();
  return {
    ...mod,
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  };
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AppThemeProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <NewTimesheetPage />
        </MemoryRouter>
      </QueryClientProvider>
    </AppThemeProvider>,
  );
}

describe("mondayOf — week anchoring rules", () => {
  it.each([
    // [input, expected Monday]
    ["2026-10-04", "2026-10-05"], // Sunday → next day's Monday
    ["2026-10-05", "2026-10-05"], // Monday → itself
    ["2026-10-07", "2026-10-05"], // Wednesday → that week's Monday
    ["2026-10-10", "2026-10-05"], // Saturday → same week's Monday
    ["2026-11-01", "2026-11-02"], // Sunday Nov 1 → Nov 2 (month boundary)
    ["2026-10-31", "2026-10-26"], // Saturday Oct 31 → Oct 26
    ["2027-01-03", "2027-01-04"], // Sunday Jan 3 → Jan 4 (year boundary)
  ])("%s → %s", (input, expected) => {
    expect(mondayOf(new Date(`${input}T00:00:00`))).toBe(expected);
  });
});

describe("new timesheet — default week", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation((path: string) => {
      if (path.startsWith("/api/attendance/week/")) {
        return Promise.resolve({
          week_start: "2000-01-03",
          week_end: "2000-01-09",
          results: [],
        });
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    });
  });

  it("opens on the Monday of the week containing today (local date)", async () => {
    // Freeze "today" as Sunday Oct 4, 2026 → expected default Oct 5.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 9, 4, 12, 0, 0)); // local noon, any TZ
    try {
      renderPage();
      const input = await screen.findByLabelText(/week starting/i);
      expect(input).toHaveValue("2026-10-05");

      // The grid must cover Oct 5 – Oct 11 (local dates, no UTC shift).
      for (const d of [
        "2026-10-05",
        "2026-10-06",
        "2026-10-07",
        "2026-10-08",
        "2026-10-09",
        "2026-10-10",
        "2026-10-11",
      ]) {
        const label = new Date(`${d}T00:00:00`).toLocaleDateString("en", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        expect(screen.getByText(label)).toBeInTheDocument();
      }
      // And the attendance fetch uses the same Monday.
      expect(getMock).toHaveBeenCalledWith(
        "/api/attendance/week/?start=2026-10-05",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("still normalizes a manually picked date to its Monday", async () => {
    renderPage();
    const input = await screen.findByLabelText(/week starting/i);
    // Pick Sunday Oct 4 → snaps forward to Monday Oct 5.
    await act(() =>
      fireEvent.change(input, { target: { value: "2026-10-04" } }),
    );
    await waitFor(() => expect(input).toHaveValue("2026-10-05"));
    // Pick a Wednesday → snaps back to that week's Monday.
    await act(() =>
      fireEvent.change(input, { target: { value: "2026-09-30" } }),
    );
    await waitFor(() => expect(input).toHaveValue("2026-09-28"));
  });

  it("does not shift dates across timezones (no toISOString)", () => {
    // localISO must never convert to UTC — verify directly at a TZ edge.
    const d = new Date(2026, 9, 5, 0, 30, 0); // Oct 5 00:30 local
    expect(localISO(d)).toBe("2026-10-05");
  });
});
