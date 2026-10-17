import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineOutlinedIcon from "@mui/icons-material/MailOutlineOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import {
  ErrorAlert,
  IconBadge,
  LoadingState,
} from "../components/ui";
import { patch } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Me } from "../types";

const inputSx = {
  "& .MuiOutlinedInput-root": {
    height: 54,
    borderRadius: "10px",
  },
} as const;

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState } = useForm<{
    phone: string;
    address: string;
    personal_email: string;
  }>();

  useEffect(() => {
    if (user?.profile) {
      reset({
        phone: user.profile.phone,
        address: user.profile.address,
        personal_email: user.profile.personal_email,
      });
    }
  }, [user, reset]);

  const save = useMutation({
    mutationFn: (data: {
      phone: string;
      address: string;
      personal_email: string;
    }) => patch<Me>("/api/me/profile/", data),
    onSuccess: refreshUser,
  });

  if (!user) return <LoadingState />;
  const p = user.profile;
  const empty = t("common.empty");
  const fullName = `${p.first_name} ${p.last_name}`.trim();
  const initials =
    `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase() ||
    user.email[0].toUpperCase();

  const detailRows: [string, string][] = [
    [t("profile.name"), fullName || empty],
    [t("common.email"), user.email],
    [t("profile.jobTitle"), p.job_title || empty],
    [t("profile.department"), p.department || empty],
    [t("profile.hireDate"), p.hire_date || empty],
  ];

  const cardHeader = (icon: React.ReactNode, title: string, sub: string) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.75, mb: 2.5 }}>
      <IconBadge icon={icon} tint="#2F6FED" size={46} />
      <Box>
        <Typography sx={{ fontSize: "1.1rem", fontWeight: 800 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: "0.85rem" }} color="text.secondary">
          {sub}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Page heading */}
      <Box sx={{ mb: 3 }}>
        <Typography
          component="h1"
          sx={{
            fontSize: "1.75rem",
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: "text.primary",
          }}
        >
          {t("profile.title")}
        </Typography>
        <Typography sx={{ fontSize: "0.95rem", mt: 0.25 }} color="text.secondary">
          {t("profile.subtitle")}
        </Typography>
      </Box>

      {/* Hero card — warm red-tinted identity header. */}
      <Card
        sx={(theme) => ({
          borderRadius: "16px",
          mb: 3,
          px: 4,
          py: 3.5,
          bgcolor:
            theme.palette.mode === "dark"
              ? alpha("#E31E24", 0.1)
              : "#FBEFF0",
          borderColor: alpha("#E31E24", theme.palette.mode === "dark" ? 0.3 : 0.15),
        })}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
          <Avatar
            sx={{
              width: 78,
              height: 78,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              fontSize: "1.7rem",
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: "1.3rem", fontWeight: 800 }} noWrap>
              {fullName || user.email}
            </Typography>
            <Typography
              sx={{ fontSize: "0.95rem", mb: 1 }}
              color="text.secondary"
              noWrap
            >
              {user.email}
              {p.job_title ? ` • ${p.job_title}` : ""}
            </Typography>
            <Chip
              size="small"
              variant="filled"
              icon={<PersonOutlineOutlinedIcon sx={{ fontSize: 14 }} />}
              label={t(`role.${user.role}`)}
              sx={(theme) => ({
                height: 26,
                fontSize: "0.78rem",
                fontWeight: 600,
                bgcolor:
                  theme.palette.mode === "dark"
                    ? "rgba(47,125,79,0.22)"
                    : "#D8EDD9",
                color: theme.palette.success.main,
                "& .MuiChip-icon": { color: "inherit" },
              })}
            />
          </Box>
        </Box>
      </Card>

      {/* Two-column details / editable layout. */}
      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0,46fr) minmax(0,54fr)" },
          alignItems: "start",
        }}
      >
        {/* LEFT — HR-managed personal details */}
        <Card sx={{ borderRadius: "16px", px: 3, py: 3 }}>
          {cardHeader(
            <PersonOutlineOutlinedIcon />,
            t("profile.details"),
            t("profile.detailsSubtitle"),
          )}
          <Divider sx={{ mb: 1 }} />
          {detailRows.map(([label, value], i) => (
            <Box
              key={label}
              sx={{
                display: "flex",
                alignItems: "baseline",
                gap: 2,
                py: 1.9,
                borderBottom: i < detailRows.length - 1 ? 1 : 0,
                borderColor: "divider",
              }}
            >
              <Typography
                sx={{ fontSize: "0.95rem", flex: "0 0 34%" }}
                color="text.secondary"
              >
                {label}
              </Typography>
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 600 }}>
                {value}
              </Typography>
            </Box>
          ))}
          <Box
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              mt: 3,
              px: 2,
              py: 1.5,
              borderRadius: "10px",
              bgcolor:
                theme.palette.mode === "dark"
                  ? alpha("#2F6FED", 0.12)
                  : "#EEF3FB",
              color: "text.secondary",
            })}
          >
            <InfoOutlinedIcon sx={{ fontSize: 20, color: "#2F6FED" }} />
            <Typography sx={{ fontSize: "0.85rem" }} color="text.secondary">
              {t("profile.hrManagedNote")}
            </Typography>
          </Box>
        </Card>

        {/* RIGHT — editable fields + password */}
        <Card sx={{ borderRadius: "16px", px: 3, py: 3 }}>
          {cardHeader(
            <SettingsOutlinedIcon />,
            t("profile.editableFields"),
            t("profile.editableSubtitle"),
          )}
          <Divider sx={{ mb: 2.5 }} />
          <Box
            component="form"
            onSubmit={handleSubmit((d) => save.mutate(d))}
          >
            <Box sx={{ mb: 2.5 }}>
              <Typography
                component="label"
                htmlFor="phone"
                sx={{ fontSize: "0.85rem", fontWeight: 600, mb: 0.75, display: "block" }}
              >
                {t("profile.phone")}
              </Typography>
              <TextField
                id="phone"
                fullWidth
                size="small"
                placeholder={t("profile.phonePlaceholder")}
                {...register("phone")}
                sx={inputSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneOutlinedIcon
                        fontSize="small"
                        sx={{ color: "text.secondary" }}
                      />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ mb: 2.5 }}>
              <Typography
                component="label"
                htmlFor="address"
                sx={{ fontSize: "0.85rem", fontWeight: 600, mb: 0.75, display: "block" }}
              >
                {t("profile.address")}
              </Typography>
              <TextField
                id="address"
                fullWidth
                size="small"
                placeholder={t("profile.addressPlaceholder")}
                {...register("address")}
                sx={inputSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationOnOutlinedIcon
                        fontSize="small"
                        sx={{ color: "text.secondary" }}
                      />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ mb: 3 }}>
              <Typography
                component="label"
                htmlFor="personal_email"
                sx={{ fontSize: "0.85rem", fontWeight: 600, mb: 0.75, display: "block" }}
              >
                {t("profile.personalEmail")}
              </Typography>
              <TextField
                id="personal_email"
                type="email"
                fullWidth
                size="small"
                placeholder={t("profile.personalEmailPlaceholder")}
                {...register("personal_email")}
                sx={inputSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MailOutlineOutlinedIcon
                        fontSize="small"
                        sx={{ color: "text.secondary" }}
                      />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={save.isPending || !formState.isDirty}
                sx={{ height: 48, borderRadius: "10px", px: 4, fontWeight: 600 }}
              >
                {save.isPending ? t("common.saving") : t("profile.saveChanges")}
              </Button>
              <Button
                variant="outlined"
                onClick={() => reset()}
                sx={{ height: 48, borderRadius: "10px", px: 4, fontWeight: 600 }}
              >
                {t("common.cancel")}
              </Button>
            </Box>
            {save.isSuccess && (
              <Alert severity="success" role="status" sx={{ mt: 2 }}>
                {t("profile.saved")}
              </Alert>
            )}
            {save.error && <ErrorAlert error={save.error} />}
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Password — existing change-password flow. */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
              <IconBadge icon={<LockOutlinedIcon />} tint="#2F6FED" size={46} />
              <Box>
                <Typography sx={{ fontSize: "1.05rem", fontWeight: 800 }}>
                  {t("profile.passwordTitle")}
                </Typography>
                <Typography sx={{ fontSize: "0.85rem" }} color="text.secondary">
                  {t("profile.passwordSubtitle")}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              onClick={() => navigate("/change-password")}
              sx={(theme) => ({
                height: 46,
                borderRadius: "10px",
                px: 3,
                fontWeight: 600,
                borderColor: "primary.main",
                color: "primary.main",
                "&:hover": {
                  borderColor: "primary.dark",
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                },
              })}
            >
              {t("profile.changePassword")}
            </Button>
          </Box>
        </Card>
      </Box>
    </>
  );
}
