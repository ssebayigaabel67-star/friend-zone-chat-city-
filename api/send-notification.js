import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
    })
  });
}

const DEAD_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token"
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    // 1. Only logged-in users may send
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return res.status(401).json({ success: false, error: "Not logged in" });
    }
    const sender = await admin.auth().verifyIdToken(idToken);

    // 2. Look up ALL of the receiver's device tokens on the server
    const { receiverId, title, body, data } = req.body || {};
    if (!receiverId) {
      return res.status(400).json({ success: false, error: "receiverId is required" });
    }

    const userRef = admin.firestore().collection("users").doc(receiverId);
    const snap = await userRef.get();
    const userData = snap.exists ? snap.data() : {};

    // FIX: the app saves every device in `fcmTokens` (array) and only the
    // newest one in `fcmToken`. Before, only `fcmToken` was used, so any
    // other phone/browser the user was logged in on never got the push.
    const tokens = [
      ...new Set([
        ...(Array.isArray(userData.fcmTokens) ? userData.fcmTokens : []),
        userData.fcmToken
      ].filter(t => typeof t === "string" && t.length > 0))
    ];

    if (tokens.length === 0) {
      return res.status(200).json({ success: false, error: "Receiver has no push token" });
    }

    // 3. Data-only message (all values must be strings).
    // The service worker (firebase-messaging-sw.js) turns it into a popup.
    const safeData = {};
    for (const [k, v] of Object.entries(data || {})) safeData[k] = String(v);
    safeData.title = String(title || "FriendsZone").slice(0, 100);
    safeData.body = String(body || "You have a new notification.").slice(0, 200);
    safeData.senderId = sender.uid;

    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      data: safeData,
      webpush: { headers: { Urgency: "high", TTL: "86400" } }
    });

    // 4. Remove dead tokens (from BOTH fcmToken and fcmTokens)
    const dead = [];
    result.responses.forEach((r, i) => {
      if (!r.success && DEAD_TOKEN_CODES.includes(r.error?.code)) dead.push(tokens[i]);
      else if (!r.success) console.error("FCM ERROR:", r.error);
    });

    if (dead.length) {
      const update = { fcmTokens: admin.firestore.FieldValue.arrayRemove(...dead) };
      if (dead.includes(userData.fcmToken)) {
        update.fcmToken = admin.firestore.FieldValue.delete();
      }
      await userRef.update(update).catch(() => {});
    }

    if (result.successCount === 0) {
      return res.status(200).json({
        success: false,
        error: "Push could not be delivered to any device"
      });
    }

    return res.status(200).json({
      success: true,
      sent: result.successCount,
      failed: result.failureCount
    });

  } catch (error) {
    console.error("FCM ERROR:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
