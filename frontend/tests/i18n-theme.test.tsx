/** Regression: language switch → RTL + persisted; theme toggle → dark + persisted. */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

import i18n from "../src/i18n";
import { AppThemeProvider, THEME_STORAGE_KEY } from "../src/theme";
import Layout from "../src/components/Layout";

vi.mock("../src/lib/auth", () => ({
  useAuth: () => ({
    user: {
      id: 3,
      email: "employee@cdsbusiness.dev",
      role: "EMPLOYEE",
      must_change_password: false,
      manager: null,
      profile: { first_name: "Demo", last_name: "Employee" },
    },
    logout: vi.fn(),
  }),
}));

vi.mock("../src/lib/api", () => ({
  get: vi.fn().mockResolvedValue({ count: 0 }),
  post: vi.fn().mockResolvedValue({}),
  getAccessToken: vi.fn(() => null),
}));

function renderShell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AppThemeProvider>
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      </AppThemeProvider>
    </QueryClientProvider>,
  );
}

describe("i18n + theme", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("switches to Arabic → document becomes RTL and persists", async () => {
    renderShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /language/i }));
    await user.click(await screen.findByRole("menuitem", { name: "العربية" }));
    await waitFor(() => {
      expect(document.documentElement.dir).toBe("rtl");
      expect(document.documentElement.lang).toBe("ar");
    });
    expect(localStorage.getItem("cds-language")).toBe("ar");
    // Nav translated
    expect(screen.getAllByText("الطلبات").length).toBeGreaterThan(0);
  });

  it("toggles dark mode and persists the choice", async () => {
    renderShell();
    const user = userEvent.setup();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    await user.click(
      screen.getByRole("button", { name: /switch to dark mode/i }),
    );
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    await user.click(
      screen.getByRole("button", { name: /switch to light mode/i }),
    );
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
