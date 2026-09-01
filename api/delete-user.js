import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
}

const adminAuth = getAuth();

const ADMIN_UID = process.env.ADMIN_UID;

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    // Get Firebase ID token
    const authHeader =
      req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated"
      });
    }

    const idToken =
      authHeader.substring(7);


    // Verify the person making the request
    const decodedToken =
      await adminAuth.verifyIdToken(idToken);


    // Make sure they are YOUR admin account
    if (decodedToken.uid !== ADMIN_UID) {
      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });
    }


    // Get target UID
    const { uid } = req.body || {};

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: "User UID is required"
      });
    }


    // Never allow admin to delete themselves
    if (uid === ADMIN_UID) {
      return res.status(400).json({
        success: false,
        error: "You cannot delete the admin account"
      });
    }


    // Delete Firebase Authentication account
    await adminAuth.deleteUser(uid);


    return res.status(200).json({
      success: true,
      message: "User account deleted successfully"
    });

  } catch (error) {

    console.error(
      "Delete user error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });

  }
}