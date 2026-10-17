import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Box,
  Button,
  LinearProgress,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

import { ApiError, get, post } from "../../lib/api";
import AuthShell from "../../components/AuthShell";
import PasswordField from "../../components/PasswordField";
import { ErrorAlert, LoadingState } from "../../components/ui";

const schema = z
  .object({
    password: z.string().min(10, "auth.passwordMin"),
    confirm: z.string().min(1, "auth.passwordRequired"),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "auth.passwordsNoMatch",
  });
type Form = z.infer<typeof schema>;

type PageState = "validating" | "form" | "invalid" | "success";

/** 0–4 score: length, lower+upper, digit, symbol. */
function passwordScore(pw: string): number {
  let score = 0;
  if (pw.length >= 10) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return score;
}

const STRENGTH_KEYS = ["weak", "weak", "fair", "good", "strong"] as const;
const STRENGTH_COLORS = [
  "error",
  "error",
  "warning",
  "info",
  "success",
] as const;

function isInvalidToken(e: unknown): boolean {
  return (
    e instanceof ApiError && e.status === 400 && e.code === "invalid_token"
  );
}

function validationMessage(e: unknown): string | null {
  if (!(e instanceof ApiError) || !e.details) return null;
  const details = e.details as Record<string, string[]>;
  const msgs = details.new_password;
  return Array.isArray(msgs) && msgs.length ? msgs[0] : null;
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const [state, setState] = useState<PageState>("validating");
  const [serverError, setServerError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const password = watch("password") ?? "";
  const score = passwordScore(password);

  useEffect(() => {
    let cancelled = false;
    get<{ valid: boolean }>(
      `/api/auth/password-reset/confirm/?uid=${encodeURIComponent(uid ?? "")}&token=${encodeURIComponent(token ?? "")}`,
    )
      .then(() => {
        if (!cancelled) setState("form");
      })
      .catch((e) => {
        if (cancelled) return;
        setState("invalid");
        if (!isInvalidToken(e)) setServerError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, token]);

  const onSubmit = async (data: Form) => {
    setServerError(null);
    try {
      await post("/api/auth/password-reset/confirm/", {
        uid,
        token,
        new_password: data.password,
      });
      setState("success");
    } catch (e) {
      if (isInvalidToken(e)) {
        setState("invalid");
      } else {
        setServerError(e);
      }
    }
  };

  const invalidLink = (
    <Stack spacing={3} alignItems="flex-start" role="alert">
      <ErrorOutlineIcon
        color="error"
        sx={{ fontSize: 44 }}
        aria-hidden="true"
      />
      <div>
        <Typography variant="h5" component="h1" fontWeight={700}>
          {t("auth.invalidLinkTitle")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t("auth.invalidLinkBody")}
        </Typography>
      </div>
      <Button component={RouterLink} to="/forgot-password" variant="contained">
        {t("auth.requestNewLink")}
      </Button>
      <Link
        component={RouterLink}
        to="/login"
        variant="body2"
        underline="hover"
      >
        {t("auth.backToSignIn")}
      </Link>
    </Stack>
  );

  const successView = (
    <Stack spacing={3} alignItems="flex-start" role="status">
      <CheckCircleOutlineIcon
        color="success"
        sx={{ fontSize: 44 }}
        aria-hidden="true"
      />
      <div>
        <Typography variant="h5" component="h1" fontWeight={700}>
          {t("auth.resetSuccessTitle")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t("auth.resetSuccessBody")}
        </Typography>
      </div>
      <Button component={RouterLink} to="/login" variant="contained">
        {t("auth.backToSignIn")}
      </Button>
    </Stack>
  );

  const requirements = [
    { key: "auth.reqLength", met: password.length >= 10 },
    { key: "auth.reqMixed", met: /[A-Za-z]/.test(password) && /\d/.test(password) },
  ];

  const formView = (
    <>
      <Typography
        variant="h5"
        component="h1"
        fontWeight={700}
        sx={{ letterSpacing: "-0.01em" }}
      >
        {t("auth.resetTitle")}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: 0.5, mb: 4 }}
      >
        {t("auth.resetSubtitle")}
      </Typography>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          <PasswordField
            id="password"
            label={t("auth.newPassword")}
            autoComplete="new-password"
            required
            fullWidth
            autoFocus
            error={Boolean(errors.password)}
            helperText={
              errors.password?.message
                ? t(errors.password.message)
                : undefined
            }
            {...register("password")}
          />
          {password ? (
            <Box>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 0.5 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {t("auth.strengthLabel")}
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight={600}
                  color={`${STRENGTH_COLORS[score]}.main`}
                >
                  {t(`auth.strength.${STRENGTH_KEYS[score]}`)}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={((score + 1) / 5) * 100}
                color={STRENGTH_COLORS[score]}
                aria-hidden="true"
                sx={{ borderRadius: 1, height: 6 }}
              />
            </Box>
          ) : null}
          <Stack spacing={0.5}>
            {requirements.map((req) => (
              <Stack
                key={req.key}
                direction="row"
                spacing={1}
                alignItems="center"
              >
                {req.met ? (
                  <CheckCircleOutlineIcon
                    fontSize="small"
                    color="success"
                    aria-hidden="true"
                  />
                ) : (
                  <RadioButtonUncheckedIcon
                    fontSize="small"
                    color="disabled"
                    aria-hidden="true"
                  />
                )}
                <Typography
                  variant="caption"
                  color={req.met ? "success.main" : "text.secondary"}
                >
                  {t(req.key)}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <PasswordField
            id="confirm"
            label={t("auth.confirmPassword")}
            autoComplete="new-password"
            required
            fullWidth
            error={Boolean(errors.confirm)}
            helperText={
              errors.confirm?.message ? t(errors.confirm.message) : undefined
            }
            {...register("confirm")}
          />
          {serverError ? (
            <ErrorAlert
              error={serverError}
              message={validationMessage(serverError) ?? undefined}
            />
          ) : null}
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={isSubmitting}
          >
            {isSubmitting ? t("auth.resetting") : t("auth.resetButton")}
          </Button>
          <Link
            component={RouterLink}
            to="/login"
            variant="body2"
            underline="hover"
            alignSelf="center"
          >
            {t("auth.backToSignIn")}
          </Link>
        </Stack>
      </form>
    </>
  );

  return (
    <AuthShell>
      {state === "validating" ? <LoadingState /> : null}
      {state === "form" ? formView : null}
      {state === "invalid" ? (
        <>
          {invalidLink}
          {serverError ? (
            <Box sx={{ mt: 2 }}>
              <ErrorAlert error={serverError} />
            </Box>
          ) : null}
        </>
      ) : null}
      {state === "success" ? successView : null}
    </AuthShell>
  );
}
