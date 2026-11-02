import { getSupabaseClient } from "@/services/supabase";

export function isPushConfigured(): boolean {
  return Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY);
}

function decodeBase64Url(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = Uint8Array.from(window.atob(base64), (character) =>
    character.charCodeAt(0),
  );
  const buffer = new ArrayBuffer(binary.length);
  new Uint8Array(buffer).set(binary);
  return buffer;
}

export async function subscribeToPush(userId: string): Promise<void> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Push notifications are not supported by this browser.");
  }
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error(
      "Push is not configured. Set VITE_VAPID_PUBLIC_KEY and configure the Supabase push sender.",
    );
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration();
  if (!existingRegistration) {
    throw new Error(
      "Push requires the installed PWA service worker. Open Tempo over HTTPS and try again.",
    );
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(publicKey),
    }));
  const { error } = await getSupabaseClient()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        subscription: subscription.toJSON(),
      },
      { onConflict: "endpoint" },
    );
  if (error) {
    await subscription.unsubscribe();
    throw error;
  }
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const { error } = await getSupabaseClient()
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", subscription.endpoint);
  if (error) throw error;
  const unsubscribed = await subscription.unsubscribe();
  if (!unsubscribed) throw new Error("The browser could not remove this subscription.");
}

export async function sendTimerPush(
  title: string,
  body: string,
): Promise<void> {
  const { error } = await getSupabaseClient().functions.invoke("send-push", {
    body: { title, body },
  });
  if (error) throw error;
}
