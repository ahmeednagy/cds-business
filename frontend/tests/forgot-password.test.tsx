/** Forgot-password page: validation, generic confirmation, error states. */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import ForgotPasswordPage from "../src/features/auth/forgot-password";
import { ApiError } from "../src/lib/api";
import { AppThemeProvider } from "../src/theme";

const postMock = vi.fn();

vi.mock("../src/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/api")>();
  return {
    ...original,
    post: (...args: unknown[]) => postMock(...args),
  };
});

function renderPage() {
  return render(
    <AppThemeProvider>
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<div data-testid="login" />} />
        </Routes>
      </MemoryRouter>
    </AppThemeProvider>,
  );
}

describe("forgot password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates email before submitting", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "nope");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("submits and always shows the generic confirmation", async () => {
    postMock.mockResolvedValue({ detail: "ok" });
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "exists@cdsbusiness.dev");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/api/auth/password-reset/", {
        email: "exists@cdsbusiness.dev",
      }),
    );
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Back-to-login link still offered on the confirmation screen.
    expect(
      screen.getByRole("link", { name: /back to sign in/i }),
    ).toHaveAttribute("href", "/login");
  });

  it("shows the same confirmation regardless of account existence", async () => {
    // The backend always returns the same payload — the page shows the same
    // confirmation for registered and unregistered addresses alike.
    postMock.mockResolvedValue({
      detail: "If an account exists for this address, a password reset link has been sent.",
    });
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "ghost@cdsbusiness.dev");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it("surfaces a throttled error", async () => {
    postMock.mockRejectedValue(
      new ApiError(429, "throttled", "Too many attempts."),
    );
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "a@cdsbusiness.dev");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });

  it("surfaces a network error", async () => {
    postMock.mockRejectedValue(new TypeError("fetch failed"));
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "a@cdsbusiness.dev");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(
      await screen.findByText(/cannot reach the server/i),
    ).toBeInTheDocument();
  });
});
