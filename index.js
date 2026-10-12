// Firebase Cloud Function: sends a push when a new call document is created.
// Deploy:  firebase init functions  (JavaScript)  ->  replace index.js  ->  firebase deploy --only functions
// Requires the Blaze (pay as you go) plan. Normal chat usage stays within the free quota.

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

exports.notifyIncomingCall = onDocumentCreated("calls/{callId}", async event => {
  const call = event.data && event.data.data();
  if (!call || call.status !== "ringing" || !call.receiver) return;

  const db = getFirestore();
  const userSnap = await db.collection("users").doc(call.receiver).get();
  const u = userSnap.exists ? userSnap.data() : {};

  // Home.js saves a single "fcmToken"; also accept an "fcmTokens" array.
  const tokens = [...new Set([u.fcmToken, ...(u.fcmTokens || [])].filter(Boolean))];

  if (!tokens.length) return;

  const res = await getMessaging().sendEachForMulticast({
    tokens,
    data: {
      kind: "incoming_call",
      callId: event.params.callId,
      type: call.type || "voice",
      callerName: call.callerName || "Someone",
      callerPhoto: call.callerPhoto || ""
    },
    webpush: { headers: { Urgency: "high", TTL: "45" } },
    android: { priority: "high", ttl: 45000 }
  });

  // Remove dead tokens
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token") {
      dead.push(tokens[i]);
    }
  });

  if (dead.length) {
    const patch = { fcmTokens: FieldValue.arrayRemove(...dead) };
    if (dead.includes(u.fcmToken)) patch.fcmToken = FieldValue.delete();
    await userSnap.ref.update(patch);
  }
});
