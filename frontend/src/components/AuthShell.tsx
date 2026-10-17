import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";

import { isRtlLanguage } from "../i18n";
import { LanguageSegmented, ThemeToggle } from "./switchers";
import { LogoLockup } from "./ui";

const FEATURES = [
  { key: "auth.brand.point1", icon: <AssignmentOutlinedIcon /> },
  { key: "auth.brand.point2", icon: <EventAvailableOutlinedIcon /> },
  { key: "auth.brand.point3", icon: <PeopleAltOutlinedIcon /> },
];

/**
 * Original login composition: a CDS-red promotional panel (~52%) on the
 * left — white-chipped logo, "Empowering People." / "Simplifying Work.",
 * description, feature rows with icon circles and the workspace photo in
 * the lower-right, clipped by the curved seam — and a light login panel
 * on the right with the language/theme controls above the form.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isRtl = isRtlLanguage(i18n.language);

  return (
    <Box
      sx={{
        display: { xs: "flex", md: "grid" },
        flexDirection: "column",
        gridTemplateColumns: { md: "minmax(0, 52%) minmax(0, 48%)" },
        width: "100vw",
        minHeight: "100dvh",
        overflowX: "hidden",
      }}
    >
      {/* ---------- Left: red promotional panel ---------- */}
      <Box
        component="aside"
        aria-hidden="true"
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          position: "relative",
          height: "100vh",
          overflow: "hidden",
          p: { md: 5, lg: 7 },
          color: "#FFFFFF",
          background:
            "linear-gradient(155deg, #ED2329 0%, #E31E24 42%, #C0151B 78%, #9E1116 100%)",
        }}
      >
        {/* Decorative circles + dot texture */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.14) 1.2px, transparent 1.2px)",
            backgroundSize: "22px 22px",
            maskImage:
              "linear-gradient(125deg, transparent 42%, black 55%, black 92%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(125deg, transparent 42%, black 55%, black 92%, transparent 100%)",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: "-110px",
            insetInlineEnd: "-90px",
            width: 380,
            height: 380,
            borderRadius: "50%",
            bgcolor: alpha("#FFFFFF", 0.07),
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: "8%",
            insetInlineStart: "-140px",
            width: 340,
            height: 340,
            borderRadius: "50%",
            bgcolor: alpha("#000000", 0.06),
          }}
        />

        {/* Logo inside the white rounded container */}
        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            alignSelf: "flex-start",
            bgcolor: "#FFFFFF",
            borderRadius: "16px",
            px: 2,
            py: 1.5,
            boxShadow: "0 10px 26px rgba(80,10,12,0.18)",
          }}
        >
          <LogoLockup height={40} />
        </Box>

        {/* Text column — controlled width so copy wraps like the ref */}
        <Box
          sx={{
            position: "relative",
            zIndex: 2,
            mt: { md: 4, lg: 5.5 },
            maxWidth: 410,
          }}
        >
          <Typography
            component="h2"
            sx={{
              fontWeight: 800,
              fontSize: { md: "2.875rem", lg: "3.1rem" },
              letterSpacing: isRtl ? 0 : "-0.02em",
              lineHeight: 1.05,
            }}
          >
            {t("auth.brand.headline_line1")}
            <Box
              component="span"
              display="block"
              sx={{
                mt: 2,
                fontWeight: 500,
                fontSize: { md: "2.125rem", lg: "2.35rem" },
                lineHeight: 1.15,
                whiteSpace: isRtl ? "normal" : "nowrap",
              }}
            >
              {t("auth.brand.headline_line2")}
            </Box>
          </Typography>

          <Typography
            sx={{
              mt: 2.75,
              fontSize: { md: "1rem", lg: "1.05rem" },
              opacity: 0.9,
              maxWidth: 400,
              lineHeight: 1.5,
            }}
          >
            {t("auth.brand.tagline")}
          </Typography>

          {/* Feature rows — icon circle + two-line label */}
          <Stack spacing={{ md: 2.5, lg: 3 }} sx={{ mt: { md: 4, lg: 5 } }}>
            {FEATURES.map(({ key, icon }) => (
              <Box
                key={key}
                sx={{ display: "flex", alignItems: "center", gap: 2 }}
              >
                <Box
                  sx={{
                    width: { md: 48, lg: 54 },
                    height: { md: 48, lg: 54 },
                    flexShrink: 0,
                    borderRadius: "50%",
                    bgcolor: alpha("#6E0C10", 0.55),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    "& .MuiSvgIcon-root": {
                      fontSize: { md: "1.35rem", lg: "1.55rem" },
                    },
                  }}
                >
                  {icon}
                </Box>
                <Typography
                  sx={{
                    fontSize: { md: "0.98rem", lg: "1.05rem" },
                    fontWeight: 600,
                    lineHeight: 1.35,
                    whiteSpace: "pre-line",
                    // Feature text must end before the laptop artwork
                    // begins — otherwise label tails peek through its
                    // feathered left edge.
                    maxWidth: 245,
                  }}
                >
                  {t(key)}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Workspace photo — lower-right, edges feathered into the red */}
        <Box
          sx={{
            position: "absolute",
            bottom: -8,
            insetInlineEnd: "-6%",
            width: "52%",
            pointerEvents: "none",
            zIndex: 1,
            maskImage: isRtl
              ? "linear-gradient(to bottom, transparent 0%, black 18%), linear-gradient(to right, black 74%, transparent 100%)"
              : "linear-gradient(to bottom, transparent 0%, black 18%), linear-gradient(to left, black 74%, transparent 100%)",
            maskComposite: "intersect",
            WebkitMaskImage: isRtl
              ? "linear-gradient(to bottom, transparent 0%, black 18%), linear-gradient(to right, black 74%, transparent 100%)"
              : "linear-gradient(to bottom, transparent 0%, black 18%), linear-gradient(to left, black 74%, transparent 100%)",
            WebkitMaskComposite: "source-in",
          }}
        >
          <Box
            component="img"
            src="/login-workspace.png"
            alt=""
            sx={{
              display: "block",
              width: "100%",
              height: "auto",
              transform: isRtl ? "scaleX(-1)" : "none",
            }}
          />
        </Box>
      </Box>

      {/* ---------- Right: login panel ---------- */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          bgcolor: "background.default",
          // The curved seam — the light panel's corner meeting the red
          // panel (start side in both LTR and RTL).
          borderStartStartRadius: { xs: 0, md: 84 },
        }}
      >
        {/* Faint geometric decoration */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            color:
              theme.palette.mode === "dark"
                ? alpha("#FFFFFF", 0.04)
                : alpha("#E31E24", 0.045),
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: "-70px",
              insetInlineEnd: "-50px",
              width: 300,
              height: 300,
              border: "26px solid",
              borderColor: "currentColor",
              borderRadius: "60px",
              transform: "rotate(24deg)",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              bottom: "8%",
              insetInlineStart: "-80px",
              width: 240,
              height: 240,
              border: "22px solid",
              borderColor: "currentColor",
              borderRadius: "50%",
            }}
          />
        </Box>

        {/* Top bar — mobile logo left, controls right */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: { xs: 2, sm: 4.5 },
            py: { xs: 1.75, md: 2.75 },
            position: "relative",
            zIndex: 1,
          }}
        >
          <Box
            component="img"
            src="/logo.png"
            alt={t("app.name")}
            sx={{
              height: 30,
              width: "auto",
              display: { xs: "block", md: "none" },
            }}
          />
          <Box sx={{ display: { xs: "none", md: "block" } }} />
          <Stack direction="row" spacing={1.25} alignItems="center">
            <LanguageSegmented />
            <ThemeToggle />
          </Stack>
        </Box>

        {/* Compact brand strip on small screens */}
        <Box
          sx={{
            display: { xs: "block", md: "none" },
            mx: 2.5,
            mt: 1,
            mb: 2,
            px: 2.75,
            py: 2.5,
            borderRadius: 4,
            color: "#FFFFFF",
            background:
              "linear-gradient(135deg, #ED2329 0%, #E31E24 45%, #B7151B 100%)",
          }}
        >
          <Typography
            component="h2"
            sx={{ fontWeight: 800, fontSize: "1.35rem", lineHeight: 1.25 }}
          >
            {t("auth.brand.headline_line1")}{" "}
            <Box component="span" sx={{ opacity: 0.85, fontWeight: 500 }}>
              {t("auth.brand.headline_line2")}
            </Box>
          </Typography>
        </Box>

        {/* Centered form area */}
        <Box
          component="main"
          sx={{
            flex: 1,
            display: "flex",
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "center",
            px: { xs: 2.5, sm: 4 },
            py: { xs: 2, md: 3 },
            position: "relative",
            zIndex: 1,
          }}
        >
          <Box sx={{ width: "100%", maxWidth: { xs: "100%", sm: 420 } }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
