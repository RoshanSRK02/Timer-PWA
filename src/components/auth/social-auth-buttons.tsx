import { useState } from "react";
import { useLocation } from "react-router-dom";
import { AuthError } from "@/components/auth/auth-error";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function SocialAuthButtons() {
  const { signInWithOAuth } = useAuth();
  const location = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [providerLoading, setProviderLoading] = useState<string | null>(null);
  const returnPath =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? "/";

  async function handleOAuth(provider: "google" | "azure") {
    setErrorMessage(null);
    setProviderLoading(provider);

    try {
      await signInWithOAuth(provider, returnPath);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start social sign-in. Please try again.",
      );
      setProviderLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full bg-card"
        disabled={providerLoading !== null}
        onClick={() => void handleOAuth("google")}
      >
        <span className="font-bold text-base" aria-hidden="true">
          <span className="text-blue-600">G</span>
        </span>
        {providerLoading === "google" ? "Connecting..." : "Continue with Google"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full bg-card"
        disabled={providerLoading !== null}
        onClick={() => void handleOAuth("azure")}
      >
        <span
          className="grid size-4 grid-cols-2 gap-0.5"
          aria-hidden="true"
        >
          <span className="bg-[#f25022]" />
          <span className="bg-[#7fba00]" />
          <span className="bg-[#00a4ef]" />
          <span className="bg-[#ffb900]" />
        </span>
        {providerLoading === "azure"
          ? "Connecting..."
          : "Continue with Microsoft"}
      </Button>
      {errorMessage && <AuthError message={errorMessage} />}
    </div>
  );
}
