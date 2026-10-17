/** Reset-password page: token validation, form rules, success/invalid states. */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import ResetPasswordPage from "../src/features/auth/reset-password";
import { ApiError } from "../src/lib/api";
import { AppThemeProvider } from "../src/theme";

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock("../src/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/api")>();
  return {
    ...original,
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  };
});

function renderPage(uid = "MTI", token = "abc123-def") {
  return render(
    <AppThemeProvider>
      <MemoryRouter initialEntries={[`/reset-password/${uid}/${token}`]}>
        <Routes>
          <Route
            path="/reset-password/:uid/:token"
            element={<ResetPasswordPage />}
          />
          <Route path="/login" element={<div data-testid="login" />} />
          <Route path="/forgot-password" element={<div data-testid="forgot" />} />
        </Routes>
      </MemoryRouter>
    </AppThemeProvider>,
  );
}

const NEW_PW = "N3w!SecurePass99";

async function fillForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^new password\b/i), NEW_PW);
  await user.type(screen.getByLabelText(/confirm new password/i), NEW_PW);
  return user;
}

describe("reset password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ valid: true });
  });

  it("validates the link before showing the form", async () => {
    renderPage("UID42", "tok-xyz");
    expect(
      await screen.findByRole("button", { name: /reset password/i }),
    ).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith(
      expect.stringContaining("uid=UID42&token=tok-xyz"),
    );
  });

  it("shows the invalid-link screen for a bad token", async () => {
    getMock.mockRejectedValue(
      new ApiError(400, "invalid_token", "This reset link is invalid or has expired."),
    );
    renderPage();
    expect(
      await screen.findByText(/this link is invalid or expired/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /request a new link/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("shows the invalid-link screen for an expired token", async () => {
    // Backend returns the same invalid_token code for expired links.
    getMock.mockRejectedValue(
      new ApiError(400, "invalid_token", "expired"),
    );
    renderPage();
    expect(
      await screen.findByText(/this link is invalid or expired/i),
    ).toBeInTheDocument();
  });

  it("rejects mismatched confirmation", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /reset password/i });
    await user.type(screen.getByLabelText(/^new password\b/i), NEW_PW);
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "Different123!",
    );
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(
      await screen.findByText(/passwords do not match/i),
    ).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 10 characters", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /reset password/i });
    await user.type(screen.getByLabelText(/^new password\b/i), "short");
    await user.type(screen.getByLabelText(/confirm new password/i), "short");
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(
      await screen.findByText(/must be at least 10 characters/i),
    ).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("shows password strength feedback while typing", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("button", { name: /reset password/i });
    await user.type(screen.getByLabelText(/^new password\b/i), "abc");
    expect(await screen.findByText(/^weak$/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^new password\b/i), NEW_PW.slice(3));
    expect(await screen.findByText(/password strength/i)).toBeInTheDocument();
  });

  it("resets successfully and links back to login", async () => {
    postMock.mockResolvedValue(undefined);
    renderPage("UID9", "tok-9");
    await screen.findByRole("button", { name: /reset password/i });
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(
        "/api/auth/password-reset/confirm/",
        { uid: "UID9", token: "tok-9", new_password: NEW_PW },
      ),
    );
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to sign in/i }),
    ).toHaveAttribute("href", "/login");
  });

  it("switches to the invalid-link screen when the token was already used", async () => {
    postMock.mockRejectedValue(
      new ApiError(400, "invalid_token", "This reset link is invalid or has expired."),
    );
    renderPage();
    await screen.findByRole("button", { name: /reset password/i });
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(
      await screen.findByText(/this link is invalid or expired/i),
    ).toBeInTheDocument();
  });

  it("shows the server validation message for a rejected password", async () => {
    postMock.mockRejectedValue(
      new ApiError(400, "validation_error", "bad", {
        new_password: ["This password is too common."],
      }),
    );
    renderPage();
    await screen.findByRole("button", { name: /reset password/i });
    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(
      await screen.findByText(/this password is too common/i),
    ).toBeInTheDocument();
  });
});
