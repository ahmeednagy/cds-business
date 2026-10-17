import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from "@mui/material";

import PasswordField from "../../components/PasswordField";
import { post } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { ErrorAlert } from "../../components/ui";

const schema = z
  .object({
    current_password: z.string().min(1, "auth.currentPasswordRequired"),
    new_password: z.string().min(10, "auth.passwordMin"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ["confirm_password"],
    message: "auth.passwordsNoMatch",
  });
type Form = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<Error | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const forced = user?.must_change_password === true;

  const onSubmit = async (data: Form) => {
    setServerError(null);
    try {
      await post("/api/auth/change-password/", {
        current_password: data.current_password,
        new_password: data.new_password,
      });
      await refreshUser();
      navigate("/", { replace: true });
    } catch (error) {
      setServerError(error as Error);
    }
  };

  const helper = (key?: string) => (key ? t(key) : undefined);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Container maxWidth="xs" disableGutters>
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" component="h1" gutterBottom>
              {t("auth.changePassword")}
            </Typography>
            {forced && (
              <Alert severity="info" sx={{ mb: 3 }}>
                {t("auth.forcedNotice")}
              </Alert>
            )}
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <Stack spacing={2.5}>
                <PasswordField
                  id="current_password"
                                    label={t("auth.currentPassword")}
                  autoComplete="current-password"
                  required
                  fullWidth
                  error={Boolean(errors.current_password)}
                  helperText={helper(errors.current_password?.message)}
                  {...register("current_password")}
                />
                <PasswordField
                  id="new_password"
                                    label={t("auth.newPassword")}
                  autoComplete="new-password"
                  required
                  fullWidth
                  error={Boolean(errors.new_password)}
                  helperText={helper(errors.new_password?.message)}
                  {...register("new_password")}
                />
                <PasswordField
                  id="confirm_password"
                                    label={t("auth.confirmPassword")}
                  autoComplete="new-password"
                  required
                  fullWidth
                  error={Boolean(errors.confirm_password)}
                  helperText={helper(errors.confirm_password?.message)}
                  {...register("confirm_password")}
                />
                {serverError && <ErrorAlert error={serverError} />}
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t("common.saving") : t("auth.changePassword")}
                </Button>
              </Stack>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
