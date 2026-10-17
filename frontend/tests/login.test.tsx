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

vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({ user: null, loading: false, login: loginMock }),
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

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
