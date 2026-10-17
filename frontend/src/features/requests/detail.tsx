import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";

import { History } from "../../components/History";
import { ReviewActions } from "../../components/ReviewActions";
import {
  ErrorAlert,
  LoadingState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "../../components/ui";
import { ApiError, del, get, getAccessToken, postForm } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { RequestItem } from "../../types";

const BASE = "/api/requests";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}>
        {value}
      </Typography>
    </Box>
  );
}

export default function RequestDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<Error | null>(null);

  const { data: item, isLoading, error } = useQuery({
    queryKey: ["request", id],
    queryFn: () => get<RequestItem>(`${BASE}/${id}/`),
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("request", String(item!.id));
      form.append("file", file);
      return postForm("/api/attachments/", form);
    },
    onSuccess: () => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ["request", id] });
    },
    onError: setUploadError,
  });

  const remove = useMutation({
    mutationFn: (attachmentId: number) =>
      del(`/api/attachments/${attachmentId}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["request", id] }),
  });

  const download = async (attachmentId: number, name: string) => {
    // Authorized download — the backend streams only when the parent is in scope.
    const token = getAccessToken();
    const res = await fetch(`/api/attachments/${attachmentId}/`, {
      credentials: "same-origin",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, "error", "Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorAlert error={error} />;
  if (!item) return null;

  const isOwner = item.submitter === user?.id;
  const editable =
    item.actions?.includes("withdraw") || item.actions?.includes("submit");
  const showAttachments = (item.attachments?.length ?? 0) > 0 || editable;

  return (
    <>
      <PageHeader
        title={item.request_type_name}
        subtitle={
          <Stack direction="row" spacing={1} alignItems="center">
            <StatusBadge status={item.status} />
            <Typography variant="body2" color="text.secondary">
              #{item.id}
            </Typography>
          </Stack>
        }
      />

      <Grid container spacing={2.5} alignItems="flex-start">
        {/* Main column */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            <SectionCard title={t("requests.detail.infoTitle")}>
              <Box
                sx={{
                  display: "grid",
                  gap: 2.5,
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                }}
              >
                <Field
                  label={t("requests.detail.submitter")}
                  value={item.submitter_email}
                />
                <Field
                  label={t("requests.detail.submitted")}
                  value={new Date(item.submitted_at).toLocaleString(
                    i18n.language,
                  )}
                />
                {item.values &&
                  Object.entries(item.values).map(([key, value]) => (
                    <Field key={key} label={key} value={String(value)} />
                  ))}
                {item.comment && (
                  <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
                    <Field
                      label={t("requests.detail.comment")}
                      value={item.comment}
                    />
                  </Box>
                )}
              </Box>
            </SectionCard>

            {showAttachments && (
              <SectionCard title={t("requests.attachments.title")}>
                {item.attachments?.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {t("requests.attachments.empty")}
                  </Typography>
                )}
                <List dense disablePadding>
                  {item.attachments?.map((a) => (
                    <ListItem
                      key={a.id}
                      disableGutters
                      secondaryAction={
                        editable && isOwner ? (
                          <Tooltip title={t("common.remove")}>
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => remove.mutate(a.id)}
                              aria-label={`${t("common.remove")} ${a.original_name}`}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : undefined
                      }
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <AttachFileIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => download(a.id, a.original_name)}
                            sx={{ p: 0, minWidth: 0, textTransform: "none" }}
                          >
                            {a.original_name}
                          </Button>
                        }
                        secondary={t("requests.attachments.sizeKb", {
                          size: Math.round(a.size / 1024),
                        })}
                      />
                    </ListItem>
                  ))}
                </List>
                {editable && isOwner && (
                  <Box sx={{ mt: 1.5 }}>
                    <input
                      ref={fileInput}
                      type="file"
                      hidden
                      accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) upload.mutate(file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CloudUploadOutlinedIcon />}
                      disabled={upload.isPending}
                      onClick={() => fileInput.current?.click()}
                    >
                      {upload.isPending
                        ? t("requests.attachments.uploading")
                        : t("requests.attachments.attachFile")}
                    </Button>
                  </Box>
                )}
                {uploadError && <ErrorAlert error={uploadError} sx={{ mt: 2 }} />}
              </SectionCard>
            )}

            {(item.actions?.length ?? 0) > 0 && (
              <SectionCard>
                <ReviewActions
                  basePath={BASE}
                  itemId={item.id}
                  actions={item.actions ?? []}
                />
              </SectionCard>
            )}
          </Stack>
        </Grid>

        {/* Sidebar — workflow path + history */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            {(item.workflow_snapshot?.length ?? 0) > 0 && (
              <SectionCard title={t("requests.detail.workflowTitle")}>
                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  useFlexGap
                  alignItems="center"
                >
                  {item.workflow_snapshot!.map((step, i) => (
                    <Box key={step.order} sx={{ display: "flex", gap: 1 }}>
                      {i > 0 && (
                        <Typography
                          component="span"
                          color="text.disabled"
                          sx={{
                            alignSelf: "center",
                            transform:
                              i18n.dir() === "rtl"
                                ? "scaleX(-1)"
                                : undefined,
                          }}
                        >
                          →
                        </Typography>
                      )}
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`role.${step.actor_role}`)}
                        color={
                          item.current_actor_role === step.actor_role
                            ? "primary"
                            : "default"
                        }
                      />
                    </Box>
                  ))}
                </Stack>
              </SectionCard>
            )}
            <SectionCard title={t("history.title")}>
              <History basePath={BASE} itemId={item.id} />
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </>
  );
}
