import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  ButtonBase,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  type SxProps,
  type Theme,
} from "@mui/material";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import TranslateIcon from "@mui/icons-material/Translate";

import { useThemeMode } from "../theme";
import { SUPPORTED_LANGUAGES, type AppLanguage } from "../i18n";

export function ThemeToggle({ sx }: { sx?: SxProps<Theme> }) {
  const { mode, toggleMode } = useThemeMode();
  const { t } = useTranslation();
  return (
    <Tooltip
      title={t(mode === "light" ? "theme.switchToDark" : "theme.switchToLight")}
    >
      <IconButton
        color="inherit"
        onClick={toggleMode}
        aria-label={t(
          mode === "light" ? "theme.switchToDark" : "theme.switchToLight",
        )}
        sx={sx}
      >
        {mode === "light" ? (
          <DarkModeOutlinedIcon />
        ) : (
          <LightModeOutlinedIcon />
        )}
      </IconButton>
    </Tooltip>
  );
}

/** Compact EN | عربي segmented switcher used by the auth screens. */
export function LanguageSegmented() {
  const { i18n, t } = useTranslation();
  return (
    <Box
      role="group"
      aria-label={t("language.label")}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.25,
        height: 38,
        px: 0.4,
        borderRadius: 999,
        border: 1,
        borderColor: "divider",
        bgcolor: "action.hover",
      }}
    >
      {SUPPORTED_LANGUAGES.map((lng: AppLanguage) => {
        const active = i18n.language === lng;
        return (
          <ButtonBase
            key={lng}
            onClick={() => void i18n.changeLanguage(lng)}
            aria-pressed={active}
            sx={{
              px: 1.75,
              py: 0.5,
              borderRadius: 999,
              fontSize: "0.85rem",
              fontWeight: 700,
              lineHeight: 1.6,
              color: active ? "primary.main" : "text.secondary",
              bgcolor: active ? "background.paper" : "transparent",
              boxShadow: active ? 1 : "none",
              transition: "background-color 0.15s, color 0.15s",
              "&:hover": {
                color: active ? "primary.main" : "text.primary",
                bgcolor: active ? "background.paper" : "action.selected",
              },
            }}
          >
            {t(`language.short.${lng}`)}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export function LanguageMenu() {
  const { i18n, t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip title={t("language.label")}>
        <IconButton
          color="inherit"
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={t("language.label")}
          aria-haspopup="menu"
        >
          <TranslateIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {SUPPORTED_LANGUAGES.map((lng: AppLanguage) => (
          <MenuItem
            key={lng}
            selected={i18n.language === lng}
            onClick={() => {
              void i18n.changeLanguage(lng);
              setAnchor(null);
            }}
          >
            {t(`language.${lng}`)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
