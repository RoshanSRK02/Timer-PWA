import { QueryProvider } from "@/app/providers/query-provider";
import { ThemeProvider } from "@/app/providers/theme-provider";
import { AuthProvider } from "@/app/providers/auth-provider";
import { TimerProvider } from "@/app/providers/timer-provider";
import { OfflineSyncProvider } from "@/app/providers/offline-sync-provider";
import { AppRouter } from "@/routes/app-router";

export function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <OfflineSyncProvider>
            <TimerProvider>
              <AppRouter />
            </TimerProvider>
          </OfflineSyncProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
