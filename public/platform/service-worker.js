const FALLBACK_URL = "./index.html#home";

// Service Worker receives background push messages from the browser Push
// Service in production. With a Node backend, web-push sends JSON payloads
// to each stored subscription endpoint; this handler renders the system
// notification even when the page is closed.
self.addEventListener("push", (event) => {
  let payload = {
    title: "旅遊優惠通知",
    body: "有新的行程與優惠可以查看。",
    url: FALLBACK_URL,
    icon: "./icon.svg",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || "./icon.svg",
      image: payload.image,
      badge: "./icon.svg",
      data: { url: payload.url || FALLBACK_URL },
    }),
  );
});

// Clicking a system notification focuses an existing tab if possible,
// otherwise it opens the target URL. This is the mobile-like notification
// behavior users expect from Web Push.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || FALLBACK_URL, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
