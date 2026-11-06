import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

export function ProtectedRoute() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="size-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary"
          role="status"
          aria-label="Checking your session"
        />
      </div>
    );
  }

  return <Outlet />;
}
