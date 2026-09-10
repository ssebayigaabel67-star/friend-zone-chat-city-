import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";


// =====================================
// FIREBASE ADMIN SETUP
// =====================================

if (!getApps().length) {

  const serviceAccount =
    JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    );

  initializeApp({
    credential:
      cert(serviceAccount)
  });

}


// =====================================
// DELETE ACCOUNT
// =====================================

export default async function handler(
  req,
  res
) {

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  }


  try {

    // Get Firebase ID token
    const authorization =
      req.headers.authorization || "";


    if (!authorization.startsWith("Bearer ")) {

      return res.status(401).json({
        success: false,
        message: "Not authenticated"
      });

    }


    const idToken =
      authorization.substring(7);


    // Verify the logged-in user
    const decodedToken =
      await getAuth().verifyIdToken(
        idToken
      );


    const uid =
      decodedToken.uid;


    // =================================
    // DELETE FIREBASE AUTH ACCOUNT
    // =================================

    await getAuth().deleteUser(
      uid
    );


    // =================================
    // DELETE FIRESTORE PROFILE
    // =================================

    await getFirestore()
      .collection("users")
      .doc(uid)
      .delete();


    return res.status(200).json({

      success: true,

      message:
        "Account deleted successfully"

    });


  } catch (error) {

    console.error(
      "DELETE ACCOUNT ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Could not delete account"

    });

  }

}