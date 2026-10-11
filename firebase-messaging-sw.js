// FRIEND ZONE CHAT CITY - FCM SERVICE WORKER
// Must live at the site root: https://yoursite.com/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

// IMPORTANT: apiKey must be IDENTICAL to the one in Home.js
firebase.initializeApp({
  apiKey: "AIzaSyAxSyuHiNb-NEeXLfMfaq0RS9ERfahORt4",
  authDomain: "friend-zone-chat-city.firebaseapp.com",
  projectId: "friend-zone-chat-city",
  storageBucket: "friend-zone-chat-city.firebasestorage.app",
  messagingSenderId: "1077723243409",
  appId: "1:1077723243409:web:f030fdcd210f0326d93030"
});

const messaging = firebase.messaging();

// The server sends DATA-ONLY messages, so this is the only place a
// popup is created (no duplicates).
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};

  return self.registration.showNotification(
    d.title || "Friend Zone Chat City",
    {
      body: d.body || "You have a new message.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: d.chatId || "fz-chat",   // groups messages from one chat
      renotify: true,
      data: d
    }
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(
    event.notification.data?.chatUrl || "/Homepage.html",
    self.location.origin
  ).href;

  event.waitUntil((async () => {
    const list = await clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of list) {
      try {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      } catch (e) { /* try next / open new window */ }
    }

    if (clients.openWindow) return clients.openWindow(target);
  })());
});
