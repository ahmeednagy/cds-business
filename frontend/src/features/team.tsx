import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Box,
  Card,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";

import {
  EmptyState,
  ErrorAlert,
  PageHeader,
  TableSkeleton,
} from "../components/ui";
import { get } from "../lib/api";
import type { TeamMember } from "../types";

export default function TeamPage() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ["team"],
    queryFn: () => get<TeamMember[]>("/api/team/"),
  });

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorAlert error={error} />;

  return (
    <>
      <PageHeader
        title={t("team.title")}
        subtitle={t("team.subtitle")}
      />
      <Card>
        {(data ?? []).length === 0 ? (
          <EmptyState
            message={t("team.empty")}
            icon={
              <GroupsOutlinedIcon
                sx={{ fontSize: 40, color: "text.disabled" }}
              />
            }
          />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("team.name")}</TableCell>
                  <TableCell>{t("common.email")}</TableCell>
                  <TableCell>{t("team.jobTitle")}</TableCell>
                  <TableCell align="center">
                    {t("team.pendingItems")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data ?? []).map((m) => (
                  <TableRow key={m.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: 13,
                            bgcolor: "primary.main",
                          }}
                        >
                          {`${m.profile.first_name?.[0] ?? ""}${m.profile.last_name?.[0] ?? ""}`.toUpperCase() ||
                            m.email[0].toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600}>
                          {m.profile.first_name} {m.profile.last_name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {m.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {m.profile.job_title || t("common.empty")}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {m.pending_items > 0 ? (
                        <Chip
                          size="small"
                          color="primary"
                          label={m.pending_items}
                        />
                      ) : (
                        <Box component="span" sx={{ color: "text.disabled" }}>
                          0
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </>
  );
}
