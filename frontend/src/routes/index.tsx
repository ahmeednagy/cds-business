import type { ReactNode } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useLocation,
} from "react-router-dom";

import Layout from "../components/Layout";
import { LoadingState } from "../components/ui";
import AdminLayout from "../features/admin";
import AttendancePage from "../features/attendance";
import EmployeesPage from "../features/admin/employees";
import RequestTypesPage from "../features/admin/request-types";
import WorkflowsPage from "../features/admin/workflows";
import ChatsPage from "../features/chat/ChatsPage";
import ChangePasswordPage from "../features/auth/change-password";
import ForgotPasswordPage from "../features/auth/forgot-password";
import LoginPage from "../features/auth/login";
import ResetPasswordPage from "../features/auth/reset-password";
import DashboardPage from "../features/dashboard";
import NotificationsPage from "../features/notifications";
import ProfilePage from "../features/profile";
import ReportsPage from "../features/reports";
import RequestDetailPage from "../features/requests/detail";
import RequestListPage from "../features/requests/list";
import NewRequestPage from "../features/requests/new";
import TeamPage from "../features/team";
import TimesheetDetailPage from "../features/timesheets/detail";
import TimesheetListPage from "../features/timesheets/list";
import NewTimesheetPage from "../features/timesheets/new";
import { useAuth } from "../lib/auth";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  // Forced password change gate — all app routes redirect until it clears (FR-007).
  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}

function RequireRole({ role, children }: { role: string; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password/:uid/:token", element: <ResetPasswordPage /> },
  {
    path: "/change-password",
    element: (
      <RequireAuth>
        <ChangePasswordPage />
      </RequireAuth>
    ),
  },
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/attendance", element: <AttendancePage /> },
      { path: "/reports", element: <ReportsPage /> },
      { path: "/requests", element: <RequestListPage /> },
      { path: "/requests/new", element: <NewRequestPage /> },
      { path: "/requests/:id", element: <RequestDetailPage /> },
      { path: "/timesheets", element: <TimesheetListPage /> },
      { path: "/timesheets/new", element: <NewTimesheetPage /> },
      { path: "/timesheets/:id", element: <TimesheetDetailPage /> },
      { path: "/notifications", element: <NotificationsPage /> },
      { path: "/chat", element: <ChatsPage /> },
      { path: "/profile", element: <ProfilePage /> },
      {
        path: "/team",
        element: (
          <RequireRole role="MANAGER">
            <TeamPage />
          </RequireRole>
        ),
      },
      {
        path: "/admin",
        element: (
          <RequireRole role="HR">
            <AdminLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: <Navigate to="/admin/employees" replace /> },
          { path: "employees", element: <EmployeesPage /> },
          { path: "request-types", element: <RequestTypesPage /> },
          { path: "workflows", element: <WorkflowsPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
