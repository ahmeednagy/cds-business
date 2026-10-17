/** Forced password change (FR-007): validation + successful change navigates away. */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import ChangePasswordPage from "../src/features/auth/change-password";
import { ApiError } from "../src/lib/api";

const refreshUser = vi.fn();
const postMock = vi.fn();

vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: "u@cdsbusiness.dev",
      role: "EMPLOYEE",
      must_change_password: true,
      manager: null,
      profile: {
        first_name: "T", last_name: "U", phone: "", address: "",
        personal_email: "", job_title: "", department: "", hire_date: null,
        editable_fields: ["phone", "address", "personal_email"],
      },
    },
    refreshUser,
  }),
}));

vi.mock("../src/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/api")>();
  return {
    ...original,
    post: (...args: unknown[]) => postMock(...args),
  };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/change-password"]}>
      <Routes>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/" element={<div data-testid="home">home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("change password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the forced-change notice", () => {
    renderPage();
    expect(
      screen.getByText(/must set a new password before continuing/i),
    ).toBeInTheDocument();
  });

  it("rejects mismatched confirmation", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/current password/i), "Old!Passw0rd1");
    await user.type(screen.getByLabelText(/^new password/i), "New!Passw0rd12");
    await user.type(screen.getByLabelText(/confirm new password/i), "Different123!");
    await user.click(screen.getByRole("button", { name: /change password/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("posts the change and navigates to the app", async () => {
    postMock.mockResolvedValue(undefined);
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/current password/i), "Old!Passw0rd1");
    await user.type(screen.getByLabelText(/^new password/i), "New!Passw0rd12");
    await user.type(screen.getByLabelText(/confirm new password/i), "New!Passw0rd12");
    await user.click(screen.getByRole("button", { name: /change password/i }));
    await waitFor(() => expect(postMock).toHaveBeenCalledWith(
      "/api/auth/change-password/",
      { current_password: "Old!Passw0rd1", new_password: "New!Passw0rd12" },
    ));
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    expect(await screen.findByTestId("home")).toBeInTheDocument();
  });

  it("surfaces a friendly localized error on server failure", async () => {
    postMock.mockRejectedValue(
      new ApiError(400, "validation_error", "Current password is incorrect."),
    );
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/current password/i), "wrong");
    await user.type(screen.getByLabelText(/^new password/i), "New!Passw0rd12");
    await user.type(screen.getByLabelText(/confirm new password/i), "New!Passw0rd12");
    await user.click(screen.getByRole("button", { name: /change password/i }));
    expect(
      await screen.findByText(/check the highlighted fields/i),
    ).toBeInTheDocument();
  });
});
