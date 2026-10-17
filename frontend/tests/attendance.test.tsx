/** AttendanceControl: check-in/check-out lifecycle driven by backend state. */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

import { AttendanceControl } from "../src/components/AttendanceControl";
import { ApiError } from "../src/lib/api";
import { AppThemeProvider } from "../src/theme";
import type { AttendanceSession, AttendanceToday } from "../src/types";

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

const session: AttendanceSession = {
  id: 1,
  submitter: 1,
  submitter_email: "e@cds.dev",
  work_date: "2026-10-05",
  check_in_at: "2026-10-05T09:02:00Z",
  check_out_at: null,
  worked_seconds: null,
};

/** Mutable "backend" — queries and mutations both go through it so the UI
 * stays driven by server state, matching refresh behavior. */
let today: AttendanceToday;

function renderControl() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <AppThemeProvider>
      <QueryClientProvider client={qc}>
        <AttendanceControl />
      </QueryClientProvider>
    </AppThemeProvider>,
  );
}

describe("AttendanceControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    today = { active: null, sessions: [] };
    getMock.mockImplementation(() => Promise.resolve(today));
    postMock.mockImplementation((path: string) => {
      if (path.includes("check-in")) {
        today = { active: session, sessions: [session] };
        return Promise.resolve(session);
      }
      const closed = { ...session, check_out_at: "2026-10-05T17:31:00Z", worked_seconds: 30540 };
      today = { active: null, sessions: [closed] };
      return Promise.resolve(closed);
    });
  });

  it("shows Check In when no active session (backend state)", async () => {
    renderControl();
    expect(
      await screen.findByRole("button", { name: /check in/i }),
    ).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/api/attendance/today/");
  });

  it("checks in: loading state → Check Out + success toast", async () => {
    renderControl();
    const user = userEvent.setup();
    const btn = await screen.findByRole("button", { name: /check in/i });

    let resolvePost!: (v: AttendanceSession) => void;
    postMock.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolvePost = res;
        }),
    );
    await user.click(btn);
    // Loading state while the request is in flight.
    expect(btn).toBeDisabled();
    resolvePost(session);
    today = { active: session, sessions: [session] };

    expect(postMock).toHaveBeenCalledWith("/api/attendance/check-in/");
    expect(
      await screen.findByRole("button", { name: /check out/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/checked in successfully/i)).toBeInTheDocument();
    expect(await screen.findByText(/checked in ·/i)).toBeInTheDocument();
  });

  it("shows an error toast when check-in conflicts (duplicate)", async () => {
    renderControl();
    const user = userEvent.setup();
    postMock.mockRejectedValueOnce(
      new ApiError(409, "conflict", "You are already checked in."),
    );
    await user.click(await screen.findByRole("button", { name: /check in/i }));
    expect(
      await screen.findByText(/could not check in/i),
    ).toBeInTheDocument();
    // State unchanged — still offering Check In.
    expect(
      screen.getByRole("button", { name: /check in/i }),
    ).toBeInTheDocument();
  });

  it("hydrates Check Out from backend after a fresh mount (refresh)", async () => {
    today = { active: session, sessions: [session] };
    renderControl();
    expect(
      await screen.findByRole("button", { name: /check out/i }),
    ).toBeInTheDocument();
  });

  it("checks out: returns to Check In + success toast", async () => {
    today = { active: session, sessions: [session] };
    renderControl();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /check out/i }));
    expect(postMock).toHaveBeenCalledWith("/api/attendance/check-out/");
    expect(
      await screen.findByRole("button", { name: /check in/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/checked out successfully/i),
    ).toBeInTheDocument();
  });

  it("shows an error toast when check-out has no active session", async () => {
    today = { active: session, sessions: [session] };
    renderControl();
    const user = userEvent.setup();
    postMock.mockRejectedValueOnce(
      new ApiError(409, "conflict", "No active check-in session."),
    );
    await user.click(await screen.findByRole("button", { name: /check out/i }));
    expect(
      await screen.findByText(/could not check out/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /check out/i }),
    ).toBeInTheDocument();
  });

  it("shows an error toast on network/server failure", async () => {
    renderControl();
    const user = userEvent.setup();
    postMock.mockRejectedValueOnce(new ApiError(500, "error", "Server error"));
    await user.click(await screen.findByRole("button", { name: /check in/i }));
    await waitFor(() =>
      expect(screen.getByText(/could not check in/i)).toBeInTheDocument(),
    );
  });
});
