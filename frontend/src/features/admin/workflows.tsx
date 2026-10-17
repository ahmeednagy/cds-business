import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";

import {
  EmptyState,
  ErrorAlert,
  SectionCard,
  TableSkeleton,
} from "../../components/ui";
import { get, post } from "../../lib/api";
import type { Page, Workflow } from "../../types";

interface WorkflowForm {
  name: string;
  steps: { actor_role: string }[];
}

export default function WorkflowsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [formError, setFormError] = useState<Error | null>(null);
  const rtl = i18n.dir() === "rtl";

  const { data, isLoading, error } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => get<Page<Workflow>>("/api/workflows/?page_size=100"),
  });

  const { register, control, handleSubmit, reset } = useForm<WorkflowForm>({
    defaultValues: { steps: [{ actor_role: "MANAGER" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "steps" });

  const create = useMutation({
    mutationFn: (form: WorkflowForm) =>
      post("/api/workflows/", {
        name: form.name,
        steps: form.steps.map((s, i) => ({ order: i + 1, actor_role: s.actor_role })),
      }),
    onSuccess: () => {
      setShowCreate(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: setFormError,
  });

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2.5 }}>
        <Button
          variant={showCreate ? "outlined" : "contained"}
          startIcon={showCreate ? undefined : <AddIcon />}
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? t("common.cancel") : t("admin.wf.new")}
        </Button>
      </Stack>

      {showCreate && (
        <SectionCard title={t("admin.wf.new")} sx={{ mb: 3, maxWidth: 640 }}>
          <form onSubmit={handleSubmit((d) => create.mutate(d))}>
              <TextField
                id="wf-name"
                required
                fullWidth
                label={t("admin.wf.name")}
                {...register("name", { required: true })}
                sx={{ mb: 2 }}
              />
              <Typography variant="subtitle2" gutterBottom>
                {t("admin.wf.steps")}
              </Typography>
              <Stack spacing={1.5}>
                {fields.map((f, i) => (
                  <Stack direction="row" spacing={1.5} alignItems="center" key={f.id}>
                    <Typography variant="body2" color="text.secondary" sx={{ width: 56 }}>
                      {t("admin.wf.step", { n: i + 1 })}
                    </Typography>
                    <TextField
                      size="small"
                      select
                      fullWidth
                      {...register(`steps.${i}.actor_role`)}
                    >
                      <MenuItem value="MANAGER">{t("role.MANAGER")}</MenuItem>
                      <MenuItem value="HR">{t("role.HR")}</MenuItem>
                    </TextField>
                    {fields.length > 1 && (
                      <Tooltip title={t("common.remove")}>
                        <IconButton size="small" onClick={() => remove(i)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                ))}
              </Stack>
              <Button
                variant="outlined"
                size="small"
                sx={{ my: 2 }}
                onClick={() => append({ actor_role: "HR" })}
              >
                {t("admin.wf.addStep")}
              </Button>
              {formError && <ErrorAlert error={formError} sx={{ my: 2 }} />}
              <Box>
                <Button type="submit" variant="contained" disabled={create.isPending}>
                  {t("admin.wf.create")}
                </Button>
              </Box>
          </form>
        </SectionCard>
      )}

      {isLoading && <TableSkeleton />}
      {error && <ErrorAlert error={error} />}
      {data && (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("admin.wf.name")}</TableCell>
                  <TableCell>{t("admin.wf.stepsCol")}</TableCell>
                  <TableCell>{t("common.status")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.results.map((w) => (
                  <TableRow key={w.id} hover>
                    <TableCell>{w.name}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                        {w.steps.map((s, i) => (
                          <Stack direction="row" spacing={0.5} alignItems="center" key={i}>
                            {i > 0 && (
                              <ArrowForwardIcon
                                fontSize="inherit"
                                sx={{
                                  color: "text.disabled",
                                  transform: rtl ? "scaleX(-1)" : "none",
                                }}
                              />
                            )}
                            <Chip
                              size="small"
                              variant="outlined"
                              label={t(`role.${s.actor_role}`)}
                            />
                          </Stack>
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={w.is_active ? "success" : "default"}
                        variant={w.is_active ? "filled" : "outlined"}
                        label={t(w.is_active ? "common.active" : "common.inactive")}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {data.results.length === 0 && (
            <EmptyState
              message={t("admin.wf.empty")}
              icon={
                <AccountTreeOutlinedIcon
                  sx={{ fontSize: 40, color: "text.disabled" }}
                />
              }
            />
          )}
        </Card>
      )}
    </>
  );
}
