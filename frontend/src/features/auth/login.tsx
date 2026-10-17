import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import MailOutlineOutlinedIcon from "@mui/icons-material/MailOutlineOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";

import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { isRtlLanguage } from "../../i18n";
import AuthShell from "../../components/AuthShell";
import PasswordField from "../../components/PasswordField";
import { ErrorAlert } from "../../components/ui";

const schema = z.object({
  email: z.string().email("auth.emailInvalid"),
  password: z.string().min(1, "auth.passwordRequired"),
  remember: z.boolean(),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isRtl = isRtlLanguage(i18n.language);
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { remember: true },
  });

  if (loading) return null;
  if (user) {
    const to = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={to} replace />;
  }

  const onSubmit = async (data: Form) => {
    setServerError(null);
    try {
      await login(data.email, data.password, data.remember);
      navigate("/", { replace: true });
    } catch (e) {
      setServerError(e);
    }
  };

  const isInvalidCredentials =
    serverError instanceof ApiError && serverError.status === 401;

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: 1.75,
      minHeight: 54,
      transition: "box-shadow 0.15s",
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: alpha(theme.palette.text.primary, 0.14),
      },
      "&.Mui-focused": {
        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}`,
      },
    },
    "& .MuiOutlinedInput-input": { fontSize: "1rem" },
    "& .MuiInputAdornment-root .MuiSvgIcon-root": {
      color: "text.secondary",
      fontSize: "1.25rem",
    },
  };

  const FieldLabel = ({ text, htmlFor }: { text: string; htmlFor: string }) => (
    <Typography
      component="label"
      htmlFor={htmlFor}
      variant="body2"
      sx={{ display: "block", mb: 0.75, color: "text.secondary", fontWeight: 500 }}
    >
      {text}
      <Box component="span" sx={{ color: "primary.main" }}>
        {" "}
        *
      </Box>
    </Typography>
  );

  return (
    <AuthShell>
      <Typography
        component="h1"
        fontWeight={800}
        sx={{
          letterSpacing: isRtl ? 0 : "-0.015em",
          fontSize: { xs: "2rem", md: "2.4rem" },
          lineHeight: 1.1,
          color: "text.primary",
        }}
      >
        {t("auth.welcomeBack")}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ mt: 1.25, mb: 4, fontSize: "1.05rem" }}
      >
        {t("auth.signInSubtitle")}
      </Typography>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.25}>
          <Box>
            <FieldLabel text={t("auth.email")} htmlFor="email" />
            <TextField
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("auth.emailPlaceholder")}
              required
              fullWidth
              autoFocus
              error={Boolean(errors.email)}
              helperText={
                errors.email?.message ? t(errors.email.message) : undefined
              }
              sx={fieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <MailOutlineOutlinedIcon />
                    </InputAdornment>
                  ),
                },
              }}
              {...register("email")}
            />
          </Box>
          <Box>
            <FieldLabel text={t("auth.password")} htmlFor="password" />
            <PasswordField
              id="password"
              autoComplete="current-password"
              placeholder={t("auth.passwordPlaceholder")}
              required
              fullWidth
              error={Boolean(errors.password)}
              helperText={
                errors.password?.message
                  ? t(errors.password.message)
                  : undefined
              }
              sx={fieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon />
                    </InputAdornment>
                  ),
                },
              }}
              {...register("password")}
            />
          </Box>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <FormControlLabel
              sx={{ marginInlineStart: -1 }}
              control={
                <Checkbox
                  size="small"
                  checked={watch("remember")}
                  onChange={(e) => setValue("remember", e.target.checked)}
                />
              }
              label={
                <Typography sx={{ fontSize: "0.98rem" }}>
                  {t("auth.rememberMe")}
                </Typography>
              }
            />
            <Link
              component={RouterLink}
              to="/forgot-password"
              fontWeight={600}
              underline="hover"
              sx={{ fontSize: "0.98rem" }}
            >
              {t("auth.forgotPassword")}
            </Link>
          </Stack>
          {isInvalidCredentials ? (
            <Alert severity="error" sx={{ borderRadius: 1.5 }}>
              {t("errors.invalid_credentials")}
            </Alert>
          ) : serverError ? (
            <ErrorAlert error={serverError} />
          ) : null}
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={isSubmitting}
            endIcon={
              !isSubmitting ? (
                <ArrowForwardOutlinedIcon
                  sx={{
                    transform: isRtl ? "scaleX(-1)" : "none",
                    fontSize: "1.2rem !important",
                  }}
                />
              ) : undefined
            }
            sx={{
              minHeight: 56,
              borderRadius: 1.75,
              fontSize: "1.05rem",
              fontWeight: 700,
              boxShadow: `0 10px 24px ${alpha(theme.palette.primary.main, 0.22)}`,
            }}
          >
            {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
        </Stack>
      </form>
    </AuthShell>
  );
}
