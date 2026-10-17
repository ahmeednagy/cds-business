import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { Button, Link, Stack, TextField, Typography } from "@mui/material";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";

import { post } from "../../lib/api";
import AuthShell from "../../components/AuthShell";
import { ErrorAlert } from "../../components/ui";

const schema = z.object({ email: z.string().email("auth.emailInvalid") });
type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setServerError(null);
    try {
      // Response is identical whether or not the email is registered (FR-004).
      await post("/api/auth/password-reset/", { email: data.email });
      setSent(true);
    } catch (e) {
      setServerError(e);
    }
  };

  return (
    <AuthShell>
      {sent ? (
        <Stack spacing={3} alignItems="flex-start" role="status">
          <MarkEmailReadOutlinedIcon
            color="success"
            sx={{ fontSize: 44 }}
            aria-hidden="true"
          />
          <div>
            <Typography variant="h5" component="h1" fontWeight={700}>
              {t("auth.checkEmailTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t("auth.checkEmailBody")}
            </Typography>
          </div>
          <Link
            component={RouterLink}
            to="/login"
            variant="body2"
            underline="hover"
          >
            {t("auth.backToSignIn")}
          </Link>
        </Stack>
      ) : (
        <>
          <Typography
            variant="h5"
            component="h1"
            fontWeight={700}
            sx={{ letterSpacing: "-0.01em" }}
          >
            {t("auth.forgotTitle")}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, mb: 4 }}
          >
            {t("auth.forgotSubtitle")}
          </Typography>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              <TextField
                id="email"
                type="email"
                label={t("auth.email")}
                autoComplete="email"
                required
                fullWidth
                autoFocus
                error={Boolean(errors.email)}
                helperText={
                  errors.email?.message ? t(errors.email.message) : undefined
                }
                {...register("email")}
              />
              {serverError ? <ErrorAlert error={serverError} /> : null}
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={isSubmitting}
              >
                {isSubmitting ? t("auth.sendingLink") : t("auth.sendResetLink")}
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
      )}
    </AuthShell>
  );
}
