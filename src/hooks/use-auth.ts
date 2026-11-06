import type { Provider } from "@supabase/supabase-js";
import { useAuthStore } from "@/stores/use-auth-store";
import { getSupabaseClient } from "@/services/supabase";

function getAppUrl(path = ""): string {
  const relativePath = path.replace(/^\//, "");
  return new URL(relativePath, new URL(import.meta.env.BASE_URL, window.location.origin))
    .toString();
}

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const initializationError = useAuthStore(
    (state) => state.initializationError,
  );
  const setUser = useAuthStore((state) => state.setUser);

  async function signInWithPassword(email: string, password: string) {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    setUser(data.user);
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAppUrl(),
      },
    });

    if (error) throw error;
    if (data.user && data.session) setUser(data.user);

    return { requiresEmailConfirmation: !data.session };
  }

  async function resetPasswordForEmail(email: string) {
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
      email,
      {
        redirectTo: getAppUrl("reset-password"),
      },
    );

    if (error) throw error;
  }

  async function updatePassword(password: string) {
    const { data, error } = await getSupabaseClient().auth.updateUser({
      password,
    });

    if (error) throw error;
    setUser(data.user);
  }

  async function signInWithOAuth(provider: Provider, returnPath = "/") {
    const safeReturnPath =
      returnPath.startsWith("/") && !returnPath.startsWith("//")
        ? returnPath
        : "/";

    const { error } = await getSupabaseClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAppUrl(safeReturnPath),
      },
    });

    if (error) throw error;
  }

  async function signOut() {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;
    setUser(null);
  }

  return {
    user,
    isLoading,
    initializationError,
    signInWithPassword,
    signUp,
    resetPasswordForEmail,
    updatePassword,
    signInWithOAuth,
    signOut,
  };
}
