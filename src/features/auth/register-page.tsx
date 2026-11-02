import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthError } from "@/components/auth/auth-error";
import { AuthPage } from "@/components/auth/auth-page";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export function RegisterPage() {
  const { user, isLoading, initializationError, signUp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? "/";

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

  if (user) return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await signUp(email, password);
      if (result.requiresEmailConfirmation) {
        setConfirmationRequired(true);
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create your account. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPage
      title={confirmationRequired ? "Check your inbox" : "Create your account"}
      description={
        confirmationRequired
          ? `We sent a confirmation link to ${email}. Follow it to finish setting up your account.`
          : "Start building a more focused, intentional workday."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-primary hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {confirmationRequired ? (
        <div
          className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-4 text-sm leading-6 text-emerald-700 dark:text-emerald-400"
          role="status"
        >
          Your account is almost ready. Once your email is confirmed, come back
          here to sign in.
        </div>
      ) : (
        <div className="space-y-5">
          {initializationError && <AuthError message={initializationError} />}
          <SocialAuthButtons />
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-muted-foreground">
                or sign up with email
              </span>
            </div>
          </div>
          <form
            className="space-y-4"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="space-y-2">
              <label htmlFor="register-email" className="text-sm font-medium">
                Email address
              </label>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="register-password"
                className="text-sm font-medium"
              >
                Password
              </label>
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use at least 8 characters.
              </p>
            </div>
            {errorMessage && <AuthError message={errorMessage} />}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || Boolean(initializationError)}
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </div>
      )}
    </AuthPage>
  );
}
