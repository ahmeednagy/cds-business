import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  CircularProgress,
  Divider,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";

import { get } from "../../lib/api";
import { isRtlLanguage } from "../../i18n";

const PERSONAS = [
  { key: "ahmed", accent: "#3B82F6", Icon: PersonOutlineOutlinedIcon },
  { key: "manager", accent: "#22C55E", Icon: WorkspacePremiumOutlinedIcon },
  { key: "hr", accent: "#A855F7", Icon: GroupsOutlinedIcon },
] as const;

type PersonaKey = (typeof PERSONAS)[number]["key"];

/**
 * Demo-only quick-login cards. The backend advertises which persona keys are
 * available via GET /api/auth/quick-login/ (404 when the feature is off —
 * e.g. production), so this section renders nothing unless the environment
 * opted in and the seeded accounts exist.
 */
export default function QuickLogin({
  onSelect,
  pendingKey,
  disabled,
}: {
  onSelect: (key: PersonaKey) => void;
  pendingKey: string | null;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isRtl = isRtlLanguage(i18n.language);
  const dark = theme.palette.mode === "dark";
  const [accounts, setAccounts] = useState<PersonaKey[]>([]);

  useEffect(() => {
    let alive = true;
    get<{ accounts: string[] }>("/api/auth/quick-login/")
      .then((data) => {
        if (!alive) return;
        const available = new Set(data.accounts);
        setAccounts(PERSONAS.filter((p) => available.has(p.key)).map((p) => p.key));
      })
      .catch(() => {
        if (alive) setAccounts([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (accounts.length === 0) return null;

  return (
    <Box sx={{ mt: 3.5 }}>
      <Divider sx={{ "&::before, &::after": { borderColor: "divider" } }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 1, fontSize: "0.8rem" }}
        >
          {t("auth.quickLogin.divider")}
        </Typography>
      </Divider>
      <Box
        sx={{
          mt: 2.25,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
          gap: 1.25,
        }}
      >
        {PERSONAS.filter((p) => accounts.includes(p.key)).map(
          ({ key, accent, Icon }) => {
            const pending = pendingKey === key;
            return (
              <Box
                key={key}
                component="button"
                type="button"
                disabled={disabled}
                onClick={() => onSelect(key)}
                aria-label={`${t("auth.quickLogin.loginAs")} ${t(
                  `auth.quickLogin.${key}`,
                )}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  p: 1.25,
                  border: "1px solid",
                  borderColor: alpha(accent, dark ? 0.38 : 0.32),
                  borderRadius: 2.5,
                  bgcolor: dark
                    ? alpha("#FFFFFF", 0.04)
                    : alpha(accent, 0.05),
                  boxShadow: `0 4px 16px ${alpha(accent, dark ? 0.16 : 0.1)}`,
                  color: "text.primary",
                  cursor: "pointer",
                  textAlign: "start",
                  transition:
                    "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background-color 0.18s ease",
                  "&:hover:not(:disabled)": {
                    transform: "translateY(-2px)",
                    borderColor: alpha(accent, dark ? 0.65 : 0.5),
                    bgcolor: dark
                      ? alpha("#FFFFFF", 0.07)
                      : alpha(accent, 0.08),
                    boxShadow: `0 10px 26px ${alpha(
                      accent,
                      dark ? 0.3 : 0.2,
                    )}`,
                  },
                  "&:active:not(:disabled)": {
                    transform: "translateY(0)",
                  },
                  "&:focus-visible": {
                    outline: `2px solid ${alpha(accent, 0.7)}`,
                    outlineOffset: 2,
                  },
                  "&:disabled": {
                    opacity: pending ? 1 : 0.55,
                    cursor: "default",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: accent,
                    bgcolor: alpha(accent, dark ? 0.16 : 0.12),
                    "& .MuiSvgIcon-root": { fontSize: "1.05rem" },
                  }}
                >
                  <Icon />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    component="div"
                    sx={{
                      fontSize: "0.56rem",
                      fontWeight: 700,
                      letterSpacing: isRtl ? 0 : "0.09em",
                      textTransform: "uppercase",
                      color: alpha(accent, dark ? 0.95 : 0.85),
                      lineHeight: 1.2,
                    }}
                  >
                    {t("auth.quickLogin.loginAs")}
                  </Typography>
                  <Typography
                    component="div"
                    sx={{
                      fontSize: "0.86rem",
                      fontWeight: 700,
                      color: "text.primary",
                      lineHeight: 1.3,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t(`auth.quickLogin.${key}`)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: pending ? accent : "text.secondary",
                    bgcolor: alpha(accent, dark ? 0.12 : 0.1),
                  }}
                >
                  {pending ? (
                    <CircularProgress size={13} sx={{ color: accent }} />
                  ) : (
                    <ArrowForwardOutlinedIcon
                      sx={{
                        fontSize: "0.8rem",
                        transform: isRtl ? "scaleX(-1)" : "none",
                      }}
                    />
                  )}
                </Box>
              </Box>
            );
          },
        )}
      </Box>
    </Box>
  );
}
