import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { AnalyticsPage } from "@/features/analytics/analytics-page";
import { SessionHistoryPage } from "@/features/analytics/session-history-page";
import { TaskManager } from "@/features/tasks/task-manager";
import { ForgotPasswordPage } from "@/features/auth/forgot-password-page";
import { LoginPage } from "@/features/auth/login-page";
import { RegisterPage } from "@/features/auth/register-page";
import { ResetPasswordPage } from "@/features/auth/reset-password-page";
import { KeyboardShortcutsPage } from "@/features/settings/keyboard-shortcuts";

export function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="tasks" element={<TaskManager />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="history" element={<SessionHistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="shortcuts" element={<KeyboardShortcutsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
