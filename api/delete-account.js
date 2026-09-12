import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";


// =====================================
// FIREBASE ADMIN SETUP
// =====================================

if (!getApps().length) {

  initializeApp({

    credential: cert({

      projectId:
        process.env.FIREBASE_PROJECT_ID,

      clientEmail:
        process.env.FIREBASE_CLIENT_EMAIL,

      privateKey:
        process.env.FIREBASE_PRIVATE_KEY
          .replace(/\\n/g, "\n")

    })

  });

}

// =====================================
// DELETE ACCOUNT
// =====================================

export default async function handler(req, res) {

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  }


  try {

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
      await getAuth().verifyIdToken(idToken);


    const uid =
      decodedToken.uid;


    // Delete Firebase Authentication account
    await getAuth().deleteUser(uid);


    // Delete Firestore user profile
    await getFirestore()
      .collection("users")
      .doc(uid)
      .delete();


    return res.status(200).json({
      success: true,
      message: "Account deleted successfully"
    });


  } catch (error) {

    console.error(
      "DELETE ACCOUNT ERROR:",
      error
    );


    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Could not delete account"
    });

  }

}