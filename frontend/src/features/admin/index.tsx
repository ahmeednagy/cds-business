import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tab, Tabs } from "@mui/material";

import { PageHeader } from "../../components/ui";

export default function AdminLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <>
      <PageHeader title={t("admin.title")} />
      <Tabs
        value={location.pathname}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
        aria-label={t("admin.title")}
      >
        <Tab
          label={t("admin.employees")}
          value="/admin/employees"
          component={NavLink}
          to="/admin/employees"
        />
        <Tab
          label={t("admin.requestTypes")}
          value="/admin/request-types"
          component={NavLink}
          to="/admin/request-types"
        />
        <Tab
          label={t("admin.workflows")}
          value="/admin/workflows"
          component={NavLink}
          to="/admin/workflows"
        />
      </Tabs>
      <Outlet />
    </>
  );
}
