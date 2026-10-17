import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Box, Stack, Typography } from "@mui/material";

import { get } from "../lib/api";
import type { AuditEntry } from "../types";
import { LoadingState } from "./ui";

/** Timeline of audit/review events for an item. */
export function History({
  basePath,
  itemId,
}: {
  basePath: string;
  itemId: number;
}) {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["history", basePath, itemId],
    queryFn: () =>
      get<{ results: AuditEntry[] }>(`${basePath}/${itemId}/history/`),
  });

  if (isLoading) return <LoadingState />;
  const entries = data?.results ?? [];

  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("history.empty")}
      </Typography>
    );
  }

  return (
    <Stack component="section" aria-label={t("history.title")}>
      {entries.map((e, i) => (
        <Box
          key={e.id}
          sx={{ display: "flex", alignItems: "stretch" }}
        >
          {/* Timeline rail — dedicated column: dot + spine live here only,
              so they can never overlap the event text. */}
          <Box
            sx={{
              position: "relative",
              width: 12,
              flexShrink: 0,
              alignSelf: "stretch",
            }}
          >
            <Box
              sx={(theme) => ({
                position: "absolute",
                top: 5,
                insetInlineStart: 0,
                width: 11,
                height: 11,
                borderRadius: "50%",
                border: `2px solid ${
                  e.to_status
                    ? theme.palette.primary.main
                    : theme.palette.divider
                }`,
                bgcolor: theme.palette.background.paper,
              })}
            />
            {i !== entries.length - 1 && (
              <Box
                sx={(theme) => ({
                  position: "absolute",
                  top: 20,
                  bottom: -8,
                  insetInlineStart: 5,
                  width: "1px",
                  bgcolor: theme.palette.divider,
                })}
              />
            )}
          </Box>
          {/* Event content — always after the rail, consistent spacing. */}
          <Box
            sx={{
              paddingInlineStart: 2,
              pb: i === entries.length - 1 ? 0 : 2.5,
              flex: 1,
              minWidth: 0,
            }}
          >
            <Typography variant="body2" fontWeight={600}>
              {t(`history.action.${e.action}`, { defaultValue: e.action })}
              {e.from_status && e.to_status
                ? ` · ${t(`status.${e.from_status}`)} → ${t(`status.${e.to_status}`)}`
                : ""}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {e.actor_email} ·{" "}
              <Box
                component="time"
                dateTime={e.created_at}
                sx={{ display: "inline" }}
              >
                {new Date(e.created_at).toLocaleString(i18n.language)}
              </Box>
            </Typography>
            {e.comment && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={(theme) => ({
                  mt: 0.75,
                  p: 1,
                  borderRadius: 1,
                  bgcolor:
                    theme.palette.mode === "dark" ? "action.hover" : "#F7F8F9",
                })}
              >
                “{e.comment}”
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
