const CACHE_NAME = "tempo-app-shell-v2";
const APP_SHELL_URL = new URL("./", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(APP_SHELL_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("tempo-app-shell-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const isNavigation = request.mode === "navigate";
  const isStaticAsset =
    url.pathname.startsWith(new URL("assets/", self.registration.scope).pathname) ||
    /\.(?:css|html|ico|js|json|png|svg|txt|webmanifest|webp|woff2?)$/i.test(url.pathname);
  if (!isNavigation && !isStaticAsset) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch((error) =>
                console.error("Tempo could not cache an app resource.", error),
              ),
          );
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (isNavigation) {
          const appShell = await caches.match(APP_SHELL_URL);
          if (appShell) return appShell;
        }
        return Response.error();
      }),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "tempo-workspace-sync") return;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "TEMPO_SYNC_REQUEST" });
        }
      }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  const rawPayload = event.data?.text() ?? "";
  try {
    payload = rawPayload ? JSON.parse(rawPayload) : {};
  } catch {
    payload = { body: rawPayload };
  }

  const title = payload.title || "Tempo";
  const options = {
    body: payload.body || "Your timer session is complete.",
    icon: new URL("icons/tempo-192.png", self.registration.scope).href,
    badge: new URL("icons/tempo-192.png", self.registration.scope).href,
    tag: payload.tag || "tempo-timer-completion",
    data: { url: payload.url || self.registration.scope },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || self.registration.scope,
    self.registration.scope,
  );
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clients) => {
        const existing = clients.find((client) => "focus" in client);
        if (existing) {
          void existing.navigate(target.href);
          return existing.focus();
        }
        return self.clients.openWindow(target.href);
      },
    ),
  );
});
