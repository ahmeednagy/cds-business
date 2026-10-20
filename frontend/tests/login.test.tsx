/** Login page: submit → session → route; failure shows generic error (FR-004). */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

import LoginPage from "../src/features/auth/login";
import { ApiError } from "../src/lib/api";
import { AppThemeProvider } from "../src/theme";

const loginMock = vi.fn();
const quickLoginMock = vi.fn();

vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: loginMock,
    quickLogin: quickLoginMock,
  }),
}));

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AppThemeProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<div data-testid="forgot" />} />
            <Route path="/" element={<div data-testid="home">home</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AppThemeProvider>,
  );
}

async function fillAndSubmit(remember = true) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), "a@cdsbusiness.dev");
  await user.type(screen.getByLabelText(/^password\b/i), "Test!Passw0rd");
  if (!remember) {
    await user.click(screen.getByRole("checkbox", { name: /remember me/i }));
  }
  await user.click(screen.getByRole("button", { name: /sign in/i }));
  return user;
}

function stubQuickLogin(accounts: string[] | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      accounts === null
        ? new Response("{}", { status: 404 })
        : new Response(JSON.stringify({ accounts }), { status: 200 }),
    ),
  );
}

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    stubQuickLogin(null);
    localStorage.clear();
  });

  it("validates email format before submitting", async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.type(screen.getByLabelText(/^password\b/i), "x");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("logs in and navigates to the app", async () => {
    loginMock.mockResolvedValue(undefined);
    renderLogin();
    await fillAndSubmit();
    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith(
        "a@cdsbusiness.dev",
        "Test!Passw0rd",
        true,
      ),
    );
    expect(await screen.findByTestId("home")).toBeInTheDocument();
  });

  it("passes remember=false when the box is unchecked", async () => {
    loginMock.mockResolvedValue(undefined);
    renderLogin();
    await fillAndSubmit(false);
    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith(
        "a@cdsbusiness.dev",
        "Test!Passw0rd",
        false,
      ),
    );
  });

  it("disables the submit button while authenticating", async () => {
    let resolve: (v: unknown) => void;
    loginMock.mockImplementation(
      () => new Promise((r) => (resolve = r)),
    );
    renderLogin();
    await fillAndSubmit();
    const button = screen.getByRole("button", { name: /signing in/i });
    expect(button).toBeDisabled();
    resolve!(undefined);
    await screen.findByTestId("home");
  });

  it("toggles password visibility via the show/hide control", async () => {
    renderLogin();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/^password\b/i);
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(input).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("links to the forgot-password screen", () => {
    renderLogin();
    const link = screen.getByRole("link", { name: /forgot password/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("shows the generic credentials error on a 401", async () => {
    loginMock.mockRejectedValue(
      new ApiError(401, "unauthenticated", "Invalid credentials."),
    );
    renderLogin();
    await fillAndSubmit();
    expect(
      await screen.findByText(/email or password is incorrect/i),
    ).toBeInTheDocument();
  });

  it("shows a friendly message when the server is unreachable", async () => {
    loginMock.mockRejectedValue(new TypeError("fetch failed"));
    renderLogin();
    await fillAndSubmit();
    expect(
      await screen.findByText(/cannot reach the server/i),
    ).toBeInTheDocument();
  });
});

describe("quick login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("renders the persona cards the backend advertises", async () => {
    stubQuickLogin(["ahmed", "manager", "hr"]);
    renderLogin();
    expect(
      await screen.findByText(/or quick login as/i),
    ).toBeInTheDocument();
    for (const name of ["Ahmed", "Manager", "HR"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`login as ${name}`, "i") }),
      ).toBeInTheDocument();
    }
  });

  it("logs in via a persona and navigates to the app", async () => {
    stubQuickLogin(["ahmed", "manager", "hr"]);
    quickLoginMock.mockResolvedValue(undefined);
    renderLogin();
    const card = await screen.findByRole("button", {
      name: /login as manager/i,
    });
    await userEvent.setup().click(card);
    await waitFor(() =>
      expect(quickLoginMock).toHaveBeenCalledWith("manager"),
    );
    expect(await screen.findByTestId("home")).toBeInTheDocument();
  });

  it("shows the shared error state when quick login fails", async () => {
    stubQuickLogin(["ahmed", "manager", "hr"]);
    quickLoginMock.mockRejectedValue(
      new ApiError(404, "not_found", "Not found."),
    );
    renderLogin();
    const card = await screen.findByRole("button", {
      name: /login as ahmed/i,
    });
    await userEvent.setup().click(card);
    expect(
      await screen.findByText(/not found or you don't have access/i),
    ).toBeInTheDocument();
  });

  it("renders nothing when the endpoint is unavailable", async () => {
    stubQuickLogin(null);
    renderLogin();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText(/or quick login as/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /login as/i }),
    ).not.toBeInTheDocument();
  });

  it("hides personas the backend does not list", async () => {
    stubQuickLogin(["manager"]);
    renderLogin();
    expect(
      await screen.findByRole("button", { name: /login as manager/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /login as ahmed/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /login as hr/i }),
    ).not.toBeInTheDocument();
  });
});
