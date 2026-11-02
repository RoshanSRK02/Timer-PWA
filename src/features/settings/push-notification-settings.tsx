import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  subscribeToPush,
  unsubscribeFromPush,
} from "@/services/push-notifications";
import { useAuthStore } from "@/stores/use-auth-store";

export function PushNotificationSettings() {
  const userId = useAuthStore((state) => state.user?.id);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!("serviceWorker" in navigator)) {
      setIsLoading(false);
      return;
    }

    void navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => {
        if (active) setIsSubscribed(Boolean(subscription));
      })
      .catch((subscriptionError: unknown) => {
        if (active) {
          setError(
            subscriptionError instanceof Error
              ? subscriptionError.message
              : "Unable to check notification settings.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function toggleSubscription() {
    if (!userId) return;
    setError(null);
    setIsLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribeFromPush(userId);
        setIsSubscribed(false);
      } else {
        await subscribeToPush(userId);
        setIsSubscribed(true);
      }
    } catch (subscriptionError) {
      setError(
        subscriptionError instanceof Error
          ? subscriptionError.message
          : "Unable to update push notification settings.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <Bell className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Push notifications</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Get notified when a task focus session or break finishes. Delivery
            in the background depends on browser and operating-system support.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Requires an installed or open PWA, browser permission, and push
            service configuration.
          </p>
          {error && (
            <p className="mt-3 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant={isSubscribed ? "outline" : "default"}
          onClick={() => void toggleSubscription()}
          disabled={isLoading || !userId}
        >
          {isSubscribed ? (
            <>
              <BellOff className="size-4" /> Disable
            </>
          ) : (
            <>
              <Bell className="size-4" /> Enable
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
