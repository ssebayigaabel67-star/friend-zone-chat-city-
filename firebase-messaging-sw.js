// IMPORTANT: Home.js already registers /firebase-messaging-sw.js.
// If you already have this file, do NOT replace it. Copy only the
// "incoming_call" part of onBackgroundMessage and the notificationclick
// handler below into your existing file.
// Put this file in the ROOT of your site (same folder as Homepage.html).
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAxVyuHiNb-NEeXLfMfaq0RS9ERfahORt4",
  authDomain: "friend-zone-chat-city.firebaseapp.com",
  projectId: "friend-zone-chat-city",
  storageBucket: "friend-zone-chat-city.firebasestorage.app",
  messagingSenderId: "1077723243409",
  appId: "1:1077723243409:web:f030fdcd210f0326d93030"
});

const messaging = firebase.messaging();

// The Cloud Function sends data-only messages, so we draw the notification here.
messaging.onBackgroundMessage(payload => {
  const d = payload.data || {};

  if (d.kind !== "incoming_call") return;

  const name = d.callerName || "Someone";
  const video = d.type === "video";

  return self.registration.showNotification(
    video ? "Incoming video call" : "Incoming voice call",
    {
      body: `${name} is ${video ? "video calling" : "calling"} you`,
      icon: d.callerPhoto || "images/default-profile.png",
      tag: "incoming-call-" + d.callId,
      requireInteraction: true,
      renotify: true,
      vibrate: [400, 200, 400, 200, 400],
      data: { callId: d.callId }
    }
  );
});

// Tapping the notification opens the site; the ringing popup appears there.
self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return clients.openWindow("/");
    })
  );
});
