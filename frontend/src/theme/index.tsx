import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import rtlPlugin from "stylis-plugin-rtl";
import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";

import { isRtlLanguage } from "../i18n";

export const THEME_STORAGE_KEY = "cds-theme";
export type ThemeMode = "light" | "dark";

const ltrCache = createCache({ key: "cds-ltr" });
const rtlCache = createCache({ key: "cds-rtl", stylisPlugins: [rtlPlugin] });

/** CDS Business design tokens — the single source of truth for the visual system. */
export const colors = {
  red: "#E31E24",
  deepRed: "#B7161B",
  darkGray: "#4A4D52",
  midGray: "#8A8D91",
  border: "#E7E9EC",
  mutedBg: "#F7F8F9",
  hoverBg: "#F2F4F5",
  redTint: "#FCE8E9",
  green: "#2F7D4F",
  amber: "#B7791F",
} as const;

const dark = {
  bg: "#141619",
  paper: "#1C1F23",
  border: "#2E3237",
  hover: "#24282D",
  mutedBg: "#1A1D21",
  text: "#E4E6E9",
  textSecondary: "#9AA0A7",
  red: "#F04B51",
  deepRed: "#D63A3F",
  redTint: "#3A2023",
} as const;

interface ThemeModeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeState>(null as never);

export function useThemeMode() {
  return useContext(ThemeModeContext);
}

function storedMode(): ThemeMode | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function systemMode(): ThemeMode {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Design tokens — shared across modes; palette diverges per mode. */
function buildTheme(mode: ThemeMode, direction: "ltr" | "rtl") {
  const isDark = mode === "dark";
  return createTheme({
    direction,
    palette: {
      mode,
      primary: {
        main: isDark ? dark.red : colors.red,
        dark: isDark ? dark.deepRed : colors.deepRed,
        contrastText: "#FFFFFF",
      },
      secondary: {
        main: isDark ? dark.text : colors.darkGray,
        contrastText: "#FFFFFF",
      },
      error: { main: isDark ? dark.deepRed : colors.deepRed },
      success: { main: colors.green },
      warning: { main: colors.amber },
      info: { main: colors.darkGray },
      background: {
        default: isDark ? dark.bg : "#FFFFFF",
        paper: isDark ? dark.paper : "#FFFFFF",
      },
      text: {
        primary: isDark ? dark.text : colors.darkGray,
        secondary: isDark ? dark.textSecondary : colors.midGray,
      },
      divider: isDark ? dark.border : colors.border,
      action: {
        hover: isDark ? dark.hover : colors.hoverBg,
        selected: isDark ? dark.redTint : colors.redTint,
      },
    },
    typography: {
      fontFamily:
        'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans Arabic", "Noto Sans", sans-serif',
      h4: { fontWeight: 700, fontSize: "1.5rem", letterSpacing: "-0.01em" },
      h5: { fontWeight: 700, fontSize: "1.2rem", letterSpacing: "-0.01em" },
      h6: { fontWeight: 650, fontSize: "1.05rem" },
      subtitle1: { fontWeight: 650, fontSize: "0.95rem" },
      subtitle2: { fontWeight: 600, fontSize: "0.85rem" },
      body2: { fontSize: "0.875rem" },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 8 },
    shadows: [
      "none",
      "0 1px 2px rgba(16,18,20,0.06)",
      "0 1px 3px rgba(16,18,20,0.08)",
      ...Array(22).fill("0 8px 24px rgba(16,18,20,0.10)"),
    ] as never,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { WebkitFontSmoothing: "antialiased" },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            minHeight: 36,
            paddingInline: 16,
          },
          outlined: ({ theme }) => ({
            borderColor: theme.palette.divider,
            color: theme.palette.text.primary,
            "&:hover": {
              borderColor: theme.palette.text.secondary,
              backgroundColor: theme.palette.action.hover,
            },
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 14,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow:
              theme.palette.mode === "dark"
                ? "0 1px 3px rgba(0,0,0,0.35)"
                : "0 1px 3px rgba(16,18,20,0.05), 0 1px 2px rgba(16,18,20,0.03)",
          }),
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: "none" } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 8,
            backgroundColor: theme.palette.background.paper,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.divider,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.text.secondary,
            },
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderColor: theme.palette.divider,
          }),
          head: ({ theme }) => ({
            fontWeight: 600,
            color: theme.palette.text.secondary,
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            backgroundColor:
              theme.palette.mode === "dark" ? dark.mutedBg : colors.mutedBg,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: ({ theme }) => ({
            "&:hover": { backgroundColor: theme.palette.action.hover },
          }),
        },
      },
      MuiLink: {
        defaultProps: { underline: "hover" },
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.primary.main,
            fontWeight: 500,
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 6 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: 12,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 8 },
          standardError: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark" ? dark.redTint : colors.redTint,
            color: theme.palette.error.main,
            "& .MuiAlert-icon": { color: theme.palette.error.main },
          }),
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 600 },
        },
      },
    },
  });
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [mode, setModeState] = useState<ThemeMode>(
    () => storedMode() ?? systemMode(),
  );

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, m);
    } catch {
      /* private mode — ignore */
    }
  };

  // Follow the OS theme only while the user hasn't chosen explicitly.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (!storedMode()) setModeState(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const direction = isRtlLanguage(i18n.language) ? "rtl" : "ltr";

  // Keep <html dir|lang> and MUI color-scheme in sync with state.
  useEffect(() => {
    const root = document.documentElement;
    root.dir = direction;
    root.lang = i18n.language;
    root.style.colorScheme = mode;
  }, [direction, i18n.language, mode]);

  const theme = useMemo(() => buildTheme(mode, direction), [mode, direction]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode(mode === "light" ? "dark" : "light"),
    }),
    [mode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <CacheProvider value={direction === "rtl" ? rtlCache : ltrCache}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </CacheProvider>
    </ThemeModeContext.Provider>
  );
}
