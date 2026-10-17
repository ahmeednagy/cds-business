import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";

import { post } from "../lib/api";
import { ErrorAlert } from "./ui";

/** Approve / reject / return / withdraw / resubmit controls — driven by the
 * server-provided `actions` list; the backend is the security boundary. */
export function ReviewActions({
  basePath,
  itemId,
  actions,
}: {
  basePath: string;
  itemId: number;
  actions: string[];
}) {
  const { t } = useTranslation();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const queryClient = useQueryClient();

  const act = useMutation({
    mutationFn: (action: string) =>
      post(`${basePath}/${itemId}/${action}/`, { comment }),
    onSuccess: () => {
      setError(null);
      setComment("");
      queryClient.invalidateQueries();
    },
    onError: setError,
  });

  if (!actions.length) return null;

  const reviewActions = actions.filter((a) => ["approve", "reject", "return"].includes(a));
  const ownerActions = actions.filter((a) => !["approve", "reject", "return"].includes(a));

  return (
    <Box component="section" aria-label={t("review.title")}>
      <Typography variant="subtitle2" gutterBottom>
        {t("review.title")}
      </Typography>
      <TextField
        aria-label={t("review.commentLabel")}
        placeholder={t("review.commentPlaceholder")}
        multiline
        rows={2}
        fullWidth
        size="small"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        sx={{ mt: 1 }}
      />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
        {reviewActions.includes("approve") && (
          <Button
            variant="contained"
            color="success"
            onClick={() => act.mutate("approve")}
            disabled={act.isPending}
          >
            {t("review.approve")}
          </Button>
        )}
        {reviewActions.includes("reject") && (
          <Button
            variant="contained"
            color="error"
            onClick={() => act.mutate("reject")}
            disabled={act.isPending}
          >
            {t("review.reject")}
          </Button>
        )}
        {reviewActions.includes("return") && (
          <Button
            variant="outlined"
            onClick={() => act.mutate("return")}
            disabled={act.isPending}
          >
            {t("review.return")}
          </Button>
        )}
        {ownerActions.includes("withdraw") && (
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => act.mutate("withdraw")}
            disabled={act.isPending}
          >
            {t("review.withdraw")}
          </Button>
        )}
        {ownerActions.includes("submit") && (
          <Button
            variant="contained"
            onClick={() => act.mutate("submit")}
            disabled={act.isPending}
          >
            {t("review.resubmit")}
          </Button>
        )}
      </Stack>
      {error && <ErrorAlert error={error} sx={{ mt: 2 }} />}
    </Box>
  );
}
