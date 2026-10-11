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

    // 2. Look up the receiver's token on the server
    const { receiverId, title, body, data } = req.body || {};
    if (!receiverId) {
      return res.status(400).json({ success: false, error: "receiverId is required" });
    }

    const userRef = admin.firestore().collection("users").doc(receiverId);
    const snap = await userRef.get();
    const token = snap.exists ? snap.data().fcmToken : null;
    if (!token) {
      return res.status(200).json({ success: false, error: "Receiver has no push token" });
    }

    // 3. Data-only message (all values must be strings)
    const safeData = {};
    for (const [k, v] of Object.entries(data || {})) safeData[k] = String(v);
    safeData.title = String(title || "FriendsZone").slice(0, 100);
    safeData.body = String(body || "You have a new notification.").slice(0, 200);
    safeData.senderId = sender.uid;

    const messageId = await admin.messaging().send({
      token,
      data: safeData,
      webpush: { headers: { Urgency: "high", TTL: "86400" } }
    });

    return res.status(200).json({ success: true, messageId });

  } catch (error) {
    console.error("FCM ERROR:", error);

    // Dead token: remove it so it stops failing
    if (error.code === "messaging/registration-token-not-registered" && req.body?.receiverId) {
      await admin.firestore().collection("users").doc(req.body.receiverId)
        .update({ fcmToken: admin.firestore.FieldValue.delete() }).catch(() => {});
    }

    return res.status(500).json({ success: false, error: error.message });
  }
}

