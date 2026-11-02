import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthError } from "@/components/auth/auth-error";
import { AuthPage } from "@/components/auth/auth-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export function ResetPasswordPage() {
  const { user, isLoading, initializationError, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Your passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePassword(password);
      navigate("/", { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update your password. Request a new reset link and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPage
      title="Choose a new password"
      description="Use a strong password you haven't used for this account before."
      footer={
        <Link
          to="/login"
          className="font-semibold text-primary hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      {initializationError && <AuthError message={initializationError} />}
      {!user ? (
        <div className="space-y-4">
          <AuthError message="This password reset link is invalid or has expired. Request a new link to continue." />
          <Link
            to="/forgot-password"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Request a new reset link
          </Link>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium">
              New password
            </label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium">
              Confirm new password
            </label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter your new password again"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          {errorMessage && <AuthError message={errorMessage} />}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || Boolean(initializationError)}
          >
            {isSubmitting ? "Updating password..." : "Update password"}
          </Button>
        </form>
      )}
    </AuthPage>
  );
}
