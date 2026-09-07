// ==========================================
// FRIEND ZONE CHAT CITY
// FIREBASE CLOUD MESSAGING SERVICE WORKER
// ==========================================

importScripts(
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js"
);


// ==========================================
// FIREBASE CONFIG
// ==========================================

firebase.initializeApp({
  apiKey: "AIzaSyAxSyuHiNb-NEeXLfMfaq0RS9ERfahORt4",
  authDomain: "friend-zone-chat-city.firebaseapp.com",
  projectId: "friend-zone-chat-city",
  storageBucket: "friend-zone-chat-city.firebasestorage.app",
  messagingSenderId: "1077723243409",
  appId: "1:1077723243409:web:f030fdcd210f0326d93030"
});


// ==========================================
// FIREBASE MESSAGING
// ==========================================

const messaging = firebase.messaging();


// ==========================================
// BACKGROUND NOTIFICATIONS
// ==========================================

messaging.onBackgroundMessage((payload) => {

  console.log(
    "[firebase-messaging-sw.js] Background message:",
    payload
  );

  const notificationTitle =
    payload.notification?.title ||
    "Friend Zone Chat City";

  const notificationOptions = {

    body:
      payload.notification?.body ||
      "You have a new message.",

    icon:
      payload.notification?.icon ||
      "/icon.png",

    badge:
      payload.notification?.icon ||
      "/icon.png",

    data: payload.data || {}

  };


  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );

});


// ==========================================
// WHEN USER TAPS NOTIFICATION
// ==========================================

self.addEventListener("notificationclick", (event) => {

  event.notification.close();

  const chatUrl =
    event.notification.data?.chatUrl ||
    "/Homepage.html";


  event.waitUntil(

    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    })

    .then((clientList) => {

      for (const client of clientList) {

        if ("focus" in client) {

          client.focus();

          if ("navigate" in client) {
            client.navigate(chatUrl);
          }

          return;
        }

      }

      if (clients.openWindow) {
        return clients.openWindow(chatUrl);
      }

    })

  );

});
