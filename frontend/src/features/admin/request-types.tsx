import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  FormControlLabel,
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
import Grid from "@mui/material/Grid2";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PostAddOutlinedIcon from "@mui/icons-material/PostAddOutlined";

import {
  EmptyState,
  ErrorAlert,
  SectionCard,
  TableSkeleton,
} from "../../components/ui";
import { get, patch, post } from "../../lib/api";
import type { Page, RequestType, Workflow } from "../../types";

interface TypeForm {
  name: string;
  workflow: string;
  allow_attachments: boolean;
  require_attachments: boolean;
  fields: { key: string; label: string; type: string; required: boolean; choices: string }[];
}

export default function RequestTypesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [formError, setFormError] = useState<Error | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-request-types"],
    queryFn: () => get<Page<RequestType>>("/api/request-types/?page_size=100"),
  });
  const { data: workflows } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => get<Page<Workflow>>("/api/workflows/?page_size=100"),
  });

  const { register, control, handleSubmit, reset } = useForm<TypeForm>({
    defaultValues: { fields: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "fields" });

  const create = useMutation({
    mutationFn: (form: TypeForm) =>
      post("/api/request-types/", {
        name: form.name,
        workflow: Number(form.workflow),
        allow_attachments: form.allow_attachments,
        require_attachments: form.require_attachments,
        fields_schema: form.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          ...(f.type === "choice"
            ? { choices: f.choices.split(",").map((c) => c.trim()).filter(Boolean) }
            : {}),
        })),
      }),
    onSuccess: () => {
      setShowCreate(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ["admin-request-types"] });
    },
    onError: setFormError,
  });

  const toggleActive = useMutation({
    mutationFn: (rt: RequestType) =>
      patch(`/api/request-types/${rt.id}/`, { is_active: !rt.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-request-types"] }),
  });

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2.5 }}>
        <Button
          variant={showCreate ? "outlined" : "contained"}
          startIcon={showCreate ? undefined : <AddIcon />}
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? t("common.cancel") : t("admin.rt.new")}
        </Button>
      </Stack>

      {showCreate && (
        <SectionCard title={t("admin.rt.new")} sx={{ mb: 3 }}>
          <form onSubmit={handleSubmit((d) => create.mutate(d))}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    id="rt-name"
                    required
                    fullWidth
                    label={t("admin.rt.name")}
                    {...register("name", { required: true })}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    id="rt-workflow"
                    select
                    required
                    fullWidth
                    label={t("admin.rt.workflow")}
                    defaultValue=""
                    {...register("workflow", { required: true })}
                  >
                    <MenuItem value="">{t("admin.rt.selectPlaceholder")}</MenuItem>
                    {workflows?.results.map((w) => (
                      <MenuItem key={w.id} value={w.id}>
                        {w.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              <Stack direction="row" spacing={3} sx={{ my: 2 }}>
                <FormControlLabel
                  control={<Checkbox {...register("allow_attachments")} defaultChecked />}
                  label={t("admin.rt.allowAttachments")}
                />
                <FormControlLabel
                  control={<Checkbox {...register("require_attachments")} />}
                  label={t("admin.rt.requireAttachments")}
                />
              </Stack>

              <Typography variant="subtitle2" gutterBottom>
                {t("admin.rt.fields")}
              </Typography>
              <Stack spacing={1.5}>
                {fields.map((f, i) => (
                  <Grid container spacing={1.5} alignItems="center" key={f.id}>
                    <Grid size={{ xs: 6, sm: 2 }}>
                      <TextField
                        size="small"
                        fullWidth
                        label={t("admin.rt.fieldKey")}
                        {...register(`fields.${i}.key`, { required: true })}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 2 }}>
                      <TextField
                        size="small"
                        fullWidth
                        label={t("admin.rt.fieldLabel")}
                        {...register(`fields.${i}.label`, { required: true })}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 2 }}>
                      <TextField
                        size="small"
                        select
                        fullWidth
                        label={t("admin.rt.fieldType")}
                        defaultValue="text"
                        {...register(`fields.${i}.type`)}
                      >
                        <MenuItem value="text">{t("admin.rt.typeText")}</MenuItem>
                        <MenuItem value="number">{t("admin.rt.typeNumber")}</MenuItem>
                        <MenuItem value="date">{t("admin.rt.typeDate")}</MenuItem>
                        <MenuItem value="choice">{t("admin.rt.typeChoice")}</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <TextField
                        size="small"
                        fullWidth
                        label={t("admin.rt.fieldChoices")}
                        {...register(`fields.${i}.choices`)}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 2 }}>
                      <FormControlLabel
                        control={<Checkbox {...register(`fields.${i}.required`)} />}
                        label={t("admin.rt.fieldRequired")}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 1 }}>
                      <Tooltip title={t("common.remove")}>
                        <IconButton size="small" onClick={() => remove(i)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Grid>
                  </Grid>
                ))}
              </Stack>
              <Button
                variant="outlined"
                size="small"
                sx={{ my: 2 }}
                onClick={() =>
                  append({ key: "", label: "", type: "text", required: false, choices: "" })
                }
              >
                {t("admin.rt.addField")}
              </Button>
              {formError && <ErrorAlert error={formError} sx={{ my: 2 }} />}
              <Box>
                <Button type="submit" variant="contained" disabled={create.isPending}>
                  {t("admin.rt.create")}
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
                  <TableCell>{t("admin.rt.name")}</TableCell>
                  <TableCell>{t("admin.rt.fieldsCount")}</TableCell>
                  <TableCell>{t("admin.rt.attachmentsCol")}</TableCell>
                  <TableCell>{t("common.status")}</TableCell>
                  <TableCell align="right">{t("common.actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.results.map((rt) => (
                  <TableRow key={rt.id} hover>
                    <TableCell>{rt.name}</TableCell>
                    <TableCell>{rt.fields_schema.length}</TableCell>
                    <TableCell>
                      {t(rt.allow_attachments ? "admin.rt.allowed" : "admin.rt.notAllowed")}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={rt.is_active ? "success" : "default"}
                        variant={rt.is_active ? "filled" : "outlined"}
                        label={t(rt.is_active ? "common.active" : "common.inactive")}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => toggleActive.mutate(rt)}>
                        {t(rt.is_active ? "admin.rt.deactivate" : "admin.rt.activate")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {data.results.length === 0 && (
            <EmptyState
              message={t("admin.rt.empty")}
              icon={
                <PostAddOutlinedIcon
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
