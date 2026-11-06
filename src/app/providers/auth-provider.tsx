import { useEffect, type PropsWithChildren } from "react";
import { useAuthStore } from "@/stores/use-auth-store";
import { getSupabaseClient, isSupabaseConfigured } from "@/services/supabase";
import { migrateGuestData } from "@/services/guest-migration";

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
    let activation = Promise.resolve();
    let activationRevision = 0;

    function activateUser(user: import("@supabase/supabase-js").User | null) {
      const revision = ++activationRevision;
      if (!user) {
        setUser(null);
        setInitializationError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      activation = activation.then(async () => {
        if (!active || revision !== activationRevision) return;
        try {
          await migrateGuestData(user.id);
          if (!active || revision !== activationRevision) return;
          setUser(user);
          setInitializationError(null);
        } catch (error) {
          if (!active || revision !== activationRevision) return;
          setUser(null);
          setInitializationError(
            error instanceof Error
              ? `Your sign-in succeeded, but guest data could not be migrated: ${error.message}`
              : "Your sign-in succeeded, but guest data could not be migrated.",
          );
        } finally {
          if (active && revision === activationRevision) setIsLoading(false);
        }
      });
    }

    try {
      const supabase = getSupabaseClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        authEventReceived = true;
        activateUser(session?.user ?? null);
      });
      unsubscribe = () => subscription.unsubscribe();

      void supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (!active || authEventReceived) return;
          if (error) throw error;

          activateUser(data.session?.user ?? null);
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
