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
  CircularProgress,
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
import QuickLogin from "./quick-login";
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
  const { user, loading, login, quickLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<unknown>(null);
  const [quickPending, setQuickPending] = useState<string | null>(null);
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

  const onQuickLogin = async (key: string) => {
    setServerError(null);
    setQuickPending(key);
    try {
      await quickLogin(key);
      navigate("/", { replace: true });
    } catch (e) {
      setServerError(e);
    } finally {
      setQuickPending(null);
    }
  };

  const authBusy = isSubmitting || quickPending !== null;

  const isInvalidCredentials =
    serverError instanceof ApiError && serverError.status === 401;

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: 1.5,
      minHeight: 56,
      transition: "box-shadow 0.15s",
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: theme.palette.divider,
      },
      "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor: alpha(theme.palette.text.primary, 0.32),
      },
      "&.Mui-focused": {
        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}`,
      },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderColor: theme.palette.primary.main,
        borderWidth: 1,
      },
    },
    "& .MuiOutlinedInput-input": { fontSize: "1rem" },
    // Chrome autofill paints a yellow inset shadow — repaint it with the
    // theme surface/text colors so filled credentials keep the design.
    "& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus":
      {
        WebkitBoxShadow: `0 0 0 1000px ${theme.palette.background.paper} inset`,
        WebkitTextFillColor: theme.palette.text.primary,
        caretColor: theme.palette.text.primary,
        borderRadius: "inherit",
        transition: "background-color 9999s ease-out",
      },
    "& .MuiInputAdornment-root .MuiSvgIcon-root": {
      color: "text.secondary",
      fontSize: "1.25rem",
    },
    "& .MuiFormHelperText-root": { mx: 0.5, mt: 0.75 },
  };

  const FieldLabel = ({ text, htmlFor }: { text: string; htmlFor: string }) => (
    <Typography
      component="label"
      htmlFor={htmlFor}
      variant="body2"
      sx={{ display: "block", mb: 1, color: "text.primary", fontWeight: 500 }}
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
          letterSpacing: isRtl ? 0 : "-0.02em",
          fontSize: { xs: "1.9rem", md: "2.125rem" },
          lineHeight: 1.1,
          color: "text.primary",
        }}
      >
        {t("auth.welcomeBack")}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ mt: 1.25, mb: 4.5, fontSize: "1rem" }}
      >
        {t("auth.signInSubtitle")}
      </Typography>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
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
            disabled={authBusy}
            startIcon={
              isSubmitting ? (
                <CircularProgress size={20} color="inherit" />
              ) : undefined
            }
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
              borderRadius: 1.5,
              fontSize: "1.05rem",
              fontWeight: 700,
              boxShadow: `0 8px 22px ${alpha(theme.palette.primary.main, 0.28)}`,
              transition:
                "box-shadow 0.15s, transform 0.15s, background-color 0.15s",
              "&:hover": {
                boxShadow: `0 10px 26px ${alpha(theme.palette.primary.main, 0.34)}`,
              },
              "&:active": {
                transform: "translateY(1px)",
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.28)}`,
              },
              "&.Mui-disabled": {
                bgcolor: alpha(theme.palette.primary.main, 0.55),
                color: "#FFFFFF",
              },
            }}
          >
            {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
        </Stack>
      </form>
      <QuickLogin
        onSelect={onQuickLogin}
        pendingKey={quickPending}
        disabled={authBusy}
      />
    </AuthShell>
  );
}
