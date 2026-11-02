function getNotificationPath(path: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${path.replace(/^\//, "")}`;
}

export async function showTimerNotification(
  title: string,
  body: string,
): Promise<void> {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const options: NotificationOptions = {
    body,
    icon: getNotificationPath("icons/tempo-192.png"),
    badge: getNotificationPath("icons/tempo-192.png"),
    tag: "tempo-timer-completion",
    data: { url: getNotificationPath("") },
  };
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) {
    await registration.showNotification(title, options);
  } else {
    new Notification(title, options);
  }
}
