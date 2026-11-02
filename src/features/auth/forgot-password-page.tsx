import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthError } from "@/components/auth/auth-error";
import { AuthPage } from "@/components/auth/auth-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export function ForgotPasswordPage() {
  const { user, isLoading, initializationError, resetPasswordForEmail } =
    useAuth();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
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

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await resetPasswordForEmail(email);
      setIsSubmitted(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to send a reset link. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPage
      title={isSubmitted ? "Check your inbox" : "Reset your password"}
      description={
        isSubmitted
          ? "If an account exists for that email, a password reset link is on its way."
          : "Enter the email address linked to your account and we'll send you a reset link."
      }
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      }
    >
      {isSubmitted ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-4"
          role="status"
        >
          <MailCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm leading-6 text-emerald-700 dark:text-emerald-400">
            Check your email for next steps. If you don't see a message, look
            in your spam folder.
          </p>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          {initializationError && <AuthError message={initializationError} />}
          <div className="space-y-2">
            <label htmlFor="reset-email" className="text-sm font-medium">
              Email address
            </label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {errorMessage && <AuthError message={errorMessage} />}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || Boolean(initializationError)}
          >
            {isSubmitting ? "Sending link..." : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthPage>
  );
}
