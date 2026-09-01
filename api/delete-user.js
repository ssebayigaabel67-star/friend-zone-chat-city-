import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export default async function handler(req, res) {

  // =========================================
  // ONLY POST ALLOWED
  // =========================================

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    // =========================================
    // CHECK ENVIRONMENT VARIABLES
    // =========================================

    const projectId =
      process.env.FIREBASE_PROJECT_ID;

    const clientEmail =
      process.env.FIREBASE_CLIENT_EMAIL;

    const privateKey =
      process.env.FIREBASE_PRIVATE_KEY;

    const adminUid =
      process.env.ADMIN_UID;


    if (!projectId) {
      throw new Error(
        "FIREBASE_PROJECT_ID is missing"
      );
    }

    if (!clientEmail) {
      throw new Error(
        "FIREBASE_CLIENT_EMAIL is missing"
      );
    }

    if (!privateKey) {
      throw new Error(
        "FIREBASE_PRIVATE_KEY is missing"
      );
    }

    if (!adminUid) {
      throw new Error(
        "ADMIN_UID is missing"
      );
    }


    // =========================================
    // INITIALIZE FIREBASE ADMIN
    // =========================================

    if (!getApps().length) {

      initializeApp({
        credential: cert({
          projectId: projectId,

          clientEmail: clientEmail,

          privateKey:
            privateKey.replace(
              /\\n/g,
              "\n"
            )
        })
      });

    }


    const adminAuth =
      getAuth();


    // =========================================
    // GET AUTHORIZATION HEADER
    // =========================================

    const authHeader =
      req.headers.authorization || "";


    if (
      !authHeader.startsWith(
        "Bearer "
      )
    ) {

      return res.status(401).json({
        success: false,
        error: "Not authenticated"
      });

    }


    const idToken =
      authHeader.substring(7);


    // =========================================
    // VERIFY ADMIN LOGIN
    // =========================================

    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken
      );


    if (
      decodedToken.uid !== adminUid
    ) {

      return res.status(403).json({
        success: false,
        error: "Admin access required"
      });

    }


    // =========================================
    // GET TARGET USER
    // =========================================

    const body =
      req.body || {};

    const uid =
      body.uid;


    if (!uid) {

      return res.status(400).json({
        success: false,
        error: "User UID is required"
      });

    }


    // =========================================
    // NEVER DELETE ADMIN
    // =========================================

    if (
      uid === adminUid
    ) {

      return res.status(400).json({
        success: false,
        error:
          "You cannot delete the admin account"
      });

    }


    // =========================================
    // DELETE AUTH ACCOUNT
    // =========================================

    await adminAuth.deleteUser(
      uid
    );


    // =========================================
    // SUCCESS
    // =========================================

    return res.status(200).json({
      success: true,
      message:
        "User account deleted successfully"
    });


  } catch (error) {

    console.error(
      "DELETE USER API ERROR:",
      error
    );


    // =========================================
    // ALWAYS RETURN JSON
    // =========================================

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Unknown server error"
    });

  }

}