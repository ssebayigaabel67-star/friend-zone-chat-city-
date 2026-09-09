import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      token,
      title,
      body,
      data
    } = req.body;

    if (!token) {
      return res.status(400).json({
        error: "FCM token is required"
      });
    }

    const message = {
      token,

      notification: {
        title: title || "FriendsZone",
        body: body || "You have a new notification."
      },

      data: data || {},

      webpush: {
        notification: {
          title: title || "FriendsZone",
          body: body || "You have a new notification.",
          icon: "/icon-192.png"
        }
      }
    };

    const response = await admin.messaging().send(message);

    return res.status(200).json({
      success: true,
      messageId: response
    });

  } catch (error) {
    console.error("FCM ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}