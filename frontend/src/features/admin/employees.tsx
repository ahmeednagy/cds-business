import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import AddIcon from "@mui/icons-material/Add";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";

import {
  ConfirmDialog,
  EmptyState,
  ErrorAlert,
  FilterBar,
  PaginationControls,
  SectionCard,
  TableSkeleton,
} from "../../components/ui";
import { get, patch, post } from "../../lib/api";
import type { Employee, Page } from "../../types";

const JOB_TITLE_OPTIONS = [
  "Developer",
  "Implementor",
  "Accountant",
  "Marketing",
  "Project Manager",
] as const;

const DEPARTMENT_OPTIONS = ["Development", "Implementation"] as const;

interface CreateForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  manager: string;
  job_title: string;
  department: string;
}

export default function EmployeesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  // Header search deep-links here via ?search=.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [activeFilter, setActiveFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [formError, setFormError] = useState<Error | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>();

  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("search", search);
  if (activeFilter) params.set("is_active", activeFilter);
  if (deptFilter) params.set("department", deptFilter);

  const { data, isLoading, error } = useQuery({
    queryKey: ["employees", page, search, activeFilter, deptFilter],
    queryFn: () => get<Page<Employee>>(`/api/employees/?${params}`),
  });

  const { data: managers } = useQuery({
    queryKey: ["employee-options"],
    queryFn: () => get<Page<Employee>>("/api/employees/?page_size=100&is_active=true"),
  });

  /** Manager display name resolved from the employee list — name only, no email. */
  const managerName = (e: Employee) => {
    const m = managers?.results.find((x) => x.id === e.manager);
    return m ? `${m.profile.first_name} ${m.profile.last_name}` : null;
  };

  /** Localize known catalog values; fall back to the stored text otherwise. */
  const displayOption = (kind: "jobTitleOptions" | "departmentOptions", v: string) =>
    v ? t(`admin.emp.${kind}.${v}`, v) : t("common.empty");

  const create = useMutation({
    mutationFn: (form: CreateForm) =>
      post<Employee & { temporary_password: string }>("/api/employees/", {
        email: form.email,
        role: form.role,
        manager: form.manager ? Number(form.manager) : null,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        job_title: form.job_title,
        department: form.department,
      }),
    onSuccess: (result) => {
      setTempPassword(result.temporary_password);
      setShowCreate(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: setFormError,
  });

  const [confirmDeactivate, setConfirmDeactivate] = useState<Employee | null>(
    null,
  );

  const toggleActive = useMutation({
    mutationFn: (e: Employee) =>
      patch(`/api/employees/${e.id}/`, { is_active: !e.is_active }),
    onSuccess: () => {
      setConfirmDeactivate(null);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  const resetPassword = useMutation({
    mutationFn: (id: number) =>
      post<{ temporary_password: string }>(`/api/employees/${id}/reset-password/`),
    onSuccess: (result) => setTempPassword(result.temporary_password),
  });

  return (
    <>
      <FilterBar
        actions={
          <Button
            variant={showCreate ? "outlined" : "contained"}
            startIcon={showCreate ? undefined : <AddIcon />}
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? t("admin.emp.cancel") : t("admin.emp.new")}
          </Button>
        }
      >
        <TextField
          size="small"
          placeholder={t("admin.emp.searchPlaceholder")}
          label={t("common.search")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: { sm: 240 } }}
        />
        <TextField
          size="small"
          select
          label={t("admin.emp.departmentFilter")}
          value={deptFilter}
          onChange={(e) => {
            setDeptFilter(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: { sm: 180 } }}
        >
          <MenuItem value="">{t("admin.emp.allDepartments")}</MenuItem>
          {DEPARTMENT_OPTIONS.map((dep) => (
            <MenuItem key={dep} value={dep}>
              {t(`admin.emp.departmentOptions.${dep}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          select
          label={t("admin.emp.activeFilter")}
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: { sm: 160 } }}
        >
          <MenuItem value="">{t("admin.emp.all")}</MenuItem>
          <MenuItem value="true">{t("admin.emp.active")}</MenuItem>
          <MenuItem value="false">{t("admin.emp.deactivated")}</MenuItem>
        </TextField>
      </FilterBar>

      {tempPassword && (
        <Alert severity="warning" role="status" sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setTempPassword(null)}>
              {t("common.dismiss")}
            </Button>
          }
        >
          {t("admin.emp.tempPassword")}{" "}
          <Box component="code" sx={{ fontWeight: 700 }}>{tempPassword}</Box>
        </Alert>
      )}

      {showCreate && (
        <SectionCard title={t("admin.emp.new")} sx={{ mb: 3 }}>
          <form onSubmit={handleSubmit((d) => create.mutate(d))}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    id="first_name"
                    fullWidth
                    label={t("admin.emp.firstName")}
                    {...register("first_name")}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    id="last_name"
                    fullWidth
                    label={t("admin.emp.lastName")}
                    {...register("last_name")}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    id="email"
                    type="email"
                    required
                    fullWidth
                    label={t("admin.emp.email")}
                    error={Boolean(errors.email)}
                    helperText={errors.email ? t("admin.emp.required") : undefined}
                    {...register("email", { required: true })}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    id="phone"
                    fullWidth
                    label={t("admin.emp.phone")}
                    {...register("phone")}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    id="role"
                    select
                    required
                    fullWidth
                    label={t("admin.emp.role")}
                    defaultValue="EMPLOYEE"
                    {...register("role")}
                  >
                    <MenuItem value="EMPLOYEE">{t("role.EMPLOYEE")}</MenuItem>
                    <MenuItem value="MANAGER">{t("role.MANAGER")}</MenuItem>
                    <MenuItem value="HR">{t("role.HR")}</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    id="manager"
                    select
                    fullWidth
                    label={t("admin.emp.manager")}
                    defaultValue=""
                    {...register("manager")}
                  >
                    <MenuItem value="">{t("common.none")}</MenuItem>
                    {managers?.results
                      .filter((m) => m.role === "MANAGER")
                      .map((m) => (
                        <MenuItem key={m.id} value={m.id}>
                          {m.profile.first_name} {m.profile.last_name}
                        </MenuItem>
                      ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    id="job_title"
                    select
                    fullWidth
                    label={t("admin.emp.jobTitle")}
                    defaultValue=""
                    {...register("job_title")}
                  >
                    <MenuItem value="">{t("common.none")}</MenuItem>
                    {JOB_TITLE_OPTIONS.map((jt) => (
                      <MenuItem key={jt} value={jt}>
                        {t(`admin.emp.jobTitleOptions.${jt}`)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    id="department"
                    select
                    fullWidth
                    label={t("admin.emp.department")}
                    defaultValue=""
                    {...register("department")}
                  >
                    <MenuItem value="">{t("common.none")}</MenuItem>
                    {DEPARTMENT_OPTIONS.map((dep) => (
                      <MenuItem key={dep} value={dep}>
                        {t(`admin.emp.departmentOptions.${dep}`)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              {formError && <ErrorAlert error={formError} sx={{ my: 2 }} />}
              <Box sx={{ mt: 2 }}>
                <Button type="submit" variant="contained" disabled={create.isPending}>
                  {create.isPending ? t("admin.emp.creating") : t("admin.emp.create")}
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
                  <TableCell>{t("common.name")}</TableCell>
                  <TableCell>{t("common.email")}</TableCell>
                  <TableCell>{t("admin.emp.jobTitle")}</TableCell>
                  <TableCell>{t("admin.emp.department")}</TableCell>
                  <TableCell>{t("common.manager")}</TableCell>
                  <TableCell>{t("common.status")}</TableCell>
                  <TableCell align="right">{t("common.actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.results.map((e) => (
                  <TableRow key={e.id} hover>
                    <TableCell>{e.profile.first_name} {e.profile.last_name}</TableCell>
                    <TableCell>{e.email}</TableCell>
                    <TableCell>{displayOption("jobTitleOptions", e.profile.job_title)}</TableCell>
                    <TableCell>{displayOption("departmentOptions", e.profile.department)}</TableCell>
                    <TableCell>{managerName(e) ?? e.manager_email ?? t("common.empty")}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={e.is_active ? "success" : "default"}
                        variant={e.is_active ? "filled" : "outlined"}
                        label={t(e.is_active ? "common.active" : "common.deactivated")}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip
                        title={t(e.is_active ? "admin.emp.deactivate" : "admin.emp.reactivate")}
                      >
                        <IconButton
                          size="small"
                          onClick={() =>
                            e.is_active
                              ? setConfirmDeactivate(e)
                              : toggleActive.mutate(e)
                          }
                          aria-label={t(e.is_active ? "admin.emp.deactivate" : "admin.emp.reactivate")}
                        >
                          {e.is_active ? <PersonOffOutlinedIcon /> : <PersonOutlineIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("admin.emp.resetPassword")}>
                        <IconButton
                          size="small"
                          onClick={() => resetPassword.mutate(e.id)}
                          aria-label={t("admin.emp.resetPassword")}
                        >
                          <RestartAltIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {data.results.length === 0 && (
            <EmptyState
              message={t("admin.emp.empty")}
              icon={
                <PersonOutlineIcon
                  sx={{ fontSize: 40, color: "text.disabled" }}
                />
              }
            />
          )}
          <PaginationControls count={data.count} page={page} pageSize={25} onPage={setPage} />
        </Card>
      )}

      <ConfirmDialog
        open={confirmDeactivate !== null}
        danger
        title={t("admin.emp.deactivateTitle")}
        body={t("admin.emp.deactivateBody", {
          email: confirmDeactivate?.email ?? "",
        })}
        confirmLabel={t("admin.emp.deactivate")}
        loading={toggleActive.isPending}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={() =>
          confirmDeactivate && toggleActive.mutate(confirmDeactivate)
        }
      />
    </>
  );
}
