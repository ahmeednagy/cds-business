import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";

import {
  ErrorAlert,
  LoadingState,
  PageHeader,
  SectionCard,
} from "../../components/ui";
import { get, post, postForm } from "../../lib/api";
import type { FieldSpec, Page, RequestItem, RequestType } from "../../types";

function DynamicField({
  spec,
  value,
  onChange,
  error,
}: {
  spec: FieldSpec;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const id = `field-${spec.key}`;
  const common = {
    id,
    label: spec.label,
    required: spec.required,
    fullWidth: true,
    error: Boolean(error),
    helperText: error,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(e.target.value),
  };

  if (spec.type === "choice") {
    return (
      <TextField select {...common}>
        <MenuItem value="">{t("common.selectPlaceholder")}</MenuItem>
        {spec.choices?.map((c) => (
          <MenuItem key={c} value={c}>
            {c}
          </MenuItem>
        ))}
      </TextField>
    );
  }
  return (
    <TextField
      {...common}
      type={
        spec.type === "number"
          ? "number"
          : spec.type === "date"
            ? "date"
            : "text"
      }
      inputProps={spec.type === "number" ? { step: "any" } : undefined}
      InputLabelProps={spec.type === "date" ? { shrink: true } : undefined}
    />
  );
}

export default function NewRequestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [typeId, setTypeId] = useState<number | "">("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<Error | null>(null);

  const { data: types, isLoading } = useQuery({
    queryKey: ["request-types"],
    queryFn: () => get<Page<RequestType>>("/api/request-types/?page_size=100"),
  });
  const selected = useMemo(
    () => types?.results.find((rt) => rt.id === Number(typeId)),
    [types, typeId],
  );

  const create = useMutation({
    mutationFn: async () => {
      const item = await post<RequestItem>("/api/requests/", {
        request_type: selected!.id,
        values: Object.fromEntries(
          Object.entries(values).map(([k, v]) => {
            const spec = selected!.fields_schema.find((f) => f.key === k);
            return [k, spec?.type === "number" && v !== "" ? Number(v) : v];
          }),
        ),
        comment,
      });
      // Attach staged files after the request exists (request-scoped).
      for (const file of files) {
        const form = new FormData();
        form.append("request", String(item.id));
        form.append("file", file);
        await postForm("/api/attachments/", form);
      }
      return item;
    },
    onSuccess: (item) => navigate(`/requests/${item.id}`),
    onError: setServerError,
  });

  const validate = () => {
    const errors: Record<string, string> = {};
    for (const spec of selected?.fields_schema ?? []) {
      if (spec.required && !values[spec.key])
        errors[spec.key] = t("requests.fieldRequired");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  if (isLoading) return <LoadingState />;

  const attachmentLabel = t("requests.attachments.label", {
    requirement: t(
      selected?.require_attachments
        ? "requests.attachments.required"
        : "requests.attachments.optional",
    ),
  });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...Array.from(list).filter((f) => !names.has(f.name))];
    });
  };

  return (
    <>
      <PageHeader
        title={t("requests.newTitle")}
        subtitle={t("requests.newSubtitle")}
      />
      <SectionCard sx={{ maxWidth: 720 }} title={t("requests.detail.infoTitle")}>
        <Stack spacing={2.5} component="form" noValidate>
          {types && types.results.length === 0 && (
            <Alert severity="info">{t("requests.noTypes")}</Alert>
          )}
          <TextField
            id="request_type"
            select
            required
            fullWidth
            label={t("requests.type")}
            helperText={t("requests.typeHint")}
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value ? Number(e.target.value) : "");
              setValues({});
            }}
          >
            <MenuItem value="">{t("requests.selectType")}</MenuItem>
            {types?.results.map((rt) => (
              <MenuItem key={rt.id} value={rt.id}>
                {rt.name}
              </MenuItem>
            ))}
          </TextField>

          {selected?.fields_schema.map((spec) => (
            <DynamicField
              key={spec.key}
              spec={spec}
              value={values[spec.key] ?? ""}
              error={fieldErrors[spec.key]}
              onChange={(v) =>
                setValues((prev) => ({ ...prev, [spec.key]: v }))
              }
            />
          ))}

          {selected && (
            <TextField
              id="comment"
              label={t("requests.comment")}
              multiline
              rows={3}
              fullWidth
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          )}

          {selected?.allow_attachments && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {attachmentLabel}
              </Typography>
              <Box
                component="label"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                sx={(theme) => ({
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  py: 3.5,
                  px: 2,
                  border: `1.5px dashed ${
                    dragOver
                      ? theme.palette.primary.main
                      : theme.palette.divider
                  }`,
                  borderRadius: 1.5,
                  cursor: "pointer",
                  textAlign: "center",
                  bgcolor: dragOver ? "action.hover" : "transparent",
                  transition: "border-color 120ms, background-color 120ms",
                  "&:hover": { borderColor: "primary.main" },
                })}
              >
                <CloudUploadOutlinedIcon
                  sx={{ fontSize: 32, color: "text.secondary" }}
                />
                <Typography variant="body2" fontWeight={600}>
                  {t("requests.attachments.dropTitle")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("requests.attachments.dropHint")}
                </Typography>
                <input
                  id="files"
                  type="file"
                  multiple
                  hidden
                  accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </Box>
              {files.length > 0 && (
                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ mt: 1.5 }}
                >
                  {files.map((f) => (
                    <Chip
                      key={f.name}
                      label={`${f.name} (${t("requests.attachments.sizeKb", {
                        size: Math.round(f.size / 1024),
                      })})`}
                      onDelete={() =>
                        setFiles((prev) => prev.filter((x) => x !== f))
                      }
                    />
                  ))}
                </Stack>
              )}
            </Box>
          )}

          {serverError && <ErrorAlert error={serverError} />}

          <Box>
            <Button
              variant="contained"
              size="large"
              disabled={!selected || create.isPending}
              onClick={() => validate() && create.mutate()}
            >
              {create.isPending
                ? t("common.submitting")
                : t("requests.submitRequest")}
            </Button>
          </Box>
        </Stack>
      </SectionCard>
    </>
  );
}
