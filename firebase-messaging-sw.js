// Must live in the ROOT of your site: /firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAxVyuHiNb-NEeXLfMfaq0RS9ERfahORt4",
  appId: "1:1077723243409:web:f030fdcd210f0326d93030",
  authDomain: "friend-zone-chat-city.firebaseapp.com",
  projectId: "friend-zone-chat-city",
  storageBucket: "friend-zone-chat-city.firebasestorage.app",
  messagingSenderId: "1077723243409"
});

const messaging = firebase.messaging();

// Runs when a push arrives and the site is closed / in background / phone locked.
// The server sends DATA-ONLY messages, so we must show the popup ourselves.
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  return self.registration.showNotification(d.title || "Friend Zone Chat City", {
    body: d.body || "You have a new message.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.senderId || "fzcc",   // same sender = one popup, no flood
    renotify: true,
    data: d
  });
});

// Tapping the popup opens (or focuses) the chat
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const url = d.chatUrl || "/Homepage.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
