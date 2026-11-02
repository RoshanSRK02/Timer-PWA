import { useEffect, type PropsWithChildren } from "react";
import { useAuthStore } from "@/stores/use-auth-store";
import { getSupabaseClient, isSupabaseConfigured } from "@/services/supabase";

export function AuthProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const {
      setInitializationError,
      setIsLoading,
      setUser,
    } = useAuthStore.getState();

    if (!isSupabaseConfigured()) {
      setUser(null);
      setInitializationError(
        "Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
      );
      setIsLoading(false);
      return;
    }

    let authEventReceived = false;
    let active = true;
    let unsubscribe = () => {};

    try {
      const supabase = getSupabaseClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        authEventReceived = true;
        setUser(session?.user ?? null);
        setInitializationError(null);
        setIsLoading(false);
      });
      unsubscribe = () => subscription.unsubscribe();

      void supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (!active || authEventReceived) return;
          if (error) throw error;

          setUser(data.session?.user ?? null);
          setInitializationError(null);
          setIsLoading(false);
        })
        .catch((error: unknown) => {
          if (!active || authEventReceived) return;

          setUser(null);
          setInitializationError(
            error instanceof Error
              ? error.message
              : "Unable to initialize your authentication session.",
          );
          setIsLoading(false);
        });
    } catch (error) {
      setUser(null);
      setInitializationError(
        error instanceof Error
          ? error.message
          : "Unable to initialize Supabase Auth.",
      );
      setIsLoading(false);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return children;
}
