// ============================================================
// FRIENDSZONE AI - GROQ VERSION
// ============================================================

import {
  cert,
  getApps,
  initializeApp
} from "firebase-admin/app";

import {
  getAuth
} from "firebase-admin/auth";

import {
  getFirestore
} from "firebase-admin/firestore";

// ============================================================
// BASIC RATE LIMIT
// ============================================================

const aiRequests = new Map();

// ============================================================
// FRIENDSZONE AI PROFILE
// ============================================================

const FRIENDSZONE_AI = {
  id: "friendszone_ai",
  name: "FriendsZone AI",
  username: "friendszoneai",
  photoURL: "🤖"
};

// ============================================================
// API HANDLER
// ============================================================

export default async function handler(req, res) {

  // ----------------------------------------------------------
  // ONLY POST
  // ----------------------------------------------------------

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    // ========================================================
    // ENVIRONMENT VARIABLES
    // ========================================================

    const projectId =
      process.env.FIREBASE_PROJECT_ID;

    const clientEmail =
      process.env.FIREBASE_CLIENT_EMAIL;

    const privateKey =
      process.env.FIREBASE_PRIVATE_KEY;

    const groqKey =
      process.env.GROQ_API_KEY;

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

    if (!groqKey) {
      throw new Error(
        "GROQ_API_KEY is missing"
      );
    }

    // ========================================================
    // FIREBASE ADMIN
    // ========================================================

    if (!getApps().length) {

      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey:
            privateKey.replace(/\\n/g, "\n")
        })
      });

    }

    const adminAuth = getAuth();
    const db = getFirestore();

    // ========================================================
    // VERIFY USER
    // ========================================================

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

    const decodedToken =
      await adminAuth.verifyIdToken(idToken);

    if (!decodedToken.uid) {

      return res.status(401).json({
        success: false,
        error: "Invalid authentication"
      });

    }

    const uid = decodedToken.uid;

    // ========================================================
    // RATE LIMIT
    // ========================================================

    const now = Date.now();

    const lastRequest =
      aiRequests.get(uid) || 0;

    if (now - lastRequest < 3000) {

      return res.status(429).json({
        success: false,
        error:
          "Please wait a few seconds before asking FriendsZone AI again."
      });

    }

    aiRequests.set(uid, now);

    // ========================================================
    // GET QUESTION
    // ========================================================

    const body = req.body || {};

    const question =
      typeof body.question === "string"
        ? body.question.trim()
        : "";

    if (!question) {

      return res.status(400).json({
        success: false,
        error: "Question is required"
      });

    }

    if (question.length > 2000) {

      return res.status(400).json({
        success: false,
        error: "Question is too long"
      });

    }

    // ========================================================
    // GET RECENT LIVE ROOM MESSAGES
    // ========================================================

    let recentMessages = [];

    try {

      const messagesSnapshot =
        await db
          .collection("liveRoom")
          .doc("messages")
          .collection("messages")
          .orderBy("timestamp", "desc")
          .limit(10)
          .get();

      recentMessages =
        messagesSnapshot.docs
          .reverse()
          .map((messageDoc) => {

            const data =
              messageDoc.data();

            const name =
              data.senderName || "User";

            const message =
              typeof data.text === "string"
                ? data.text.trim()
                : "";

            if (!message) {
              return null;
            }

            return `${name}: ${message}`;

          })
          .filter(Boolean);

    } catch (contextError) {

      console.error(
        "LIVE ROOM CONTEXT ERROR:",
        contextError
      );

      recentMessages = [];

    }

    // ========================================================
    // BUILD CONVERSATION CONTEXT
    // ========================================================

    let conversationContext = "";

    if (recentMessages.length > 0) {

      conversationContext = `

Recent FriendsZone Live Room conversation:

${recentMessages.join("\n")}

Use this conversation only as context.

Do not claim that you personally saw,
experienced, or participated in anything
outside the conversation provided here.

`;

    }

    // ========================================================
    // FRIENDSZONE AI INSTRUCTIONS
    // ========================================================

    const systemInstruction = `

You are FriendsZone AI.

You are the official AI assistant inside
FriendsZone Chat City.

Your personality should be:

- Friendly
- Helpful
- Respectful
- Clear
- Natural
- Fun when appropriate
- Easy to understand

You are speaking to people inside a public
FriendsZone Live Room.

Keep answers reasonably short unless the
user asks for detailed information.

You can answer questions, explain things,
help users learn, help with coding,
brainstorm ideas, and have normal conversations.

Do not pretend to be a human.

Do not claim that you personally know
or experienced events outside the information
provided to you.

If you don't know something, say so clearly.

${conversationContext}

`;

    // ========================================================
    // CALL GROQ
    // ========================================================

    const groqResponse =
      await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization":
              `Bearer ${groqKey}`
          },

          body: JSON.stringify({

            model:
              "openai/gpt-oss-20b",

            messages: [

              {
                role: "system",
                content: systemInstruction
              },

              {
                role: "user",
                content: question
              }

            ],

            temperature: 0.7,

            max_completion_tokens: 1000

          })
        }
      );

    // ========================================================
    // HANDLE GROQ ERROR
    // ========================================================

    if (!groqResponse.ok) {

      const errorText =
        await groqResponse.text();

      console.error(
        "GROQ ERROR:",
        errorText
      );

      return res.status(500).json({
        success: false,
        error:
          "FriendsZone AI could not answer right now."
      });

    }

    // ========================================================
    // READ GROQ RESPONSE
    // ========================================================

    const data =
      await groqResponse.json();

    let answer =
      data?.choices?.[0]?.message?.content || "";

    answer =
      typeof answer === "string"
        ? answer.trim()
        : "";

    // ========================================================
    // EMPTY RESPONSE
    // ========================================================

    if (!answer) {

      console.error(
        "GROQ RETURNED NO TEXT:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        success: false,
        error:
          "FriendsZone AI returned an empty response."
      });

    }

    // ========================================================
    // SAVE AI MESSAGE TO FIRESTORE
    // ========================================================

    const aiMessageRef =
      await db
        .collection("liveRoom")
        .doc("messages")
        .collection("messages")
        .add({

          senderId:
            FRIENDSZONE_AI.id,

          senderName:
            FRIENDSZONE_AI.name,

          username:
            FRIENDSZONE_AI.username,

          photoURL:
            FRIENDSZONE_AI.photoURL,

          text:
            answer,

          timestamp:
            new Date(),

          replyTo:
            null,

          reactions:
            {}

        });

    // ========================================================
    // RETURN RESPONSE
    // ========================================================

    return res.status(200).json({

      success: true,

      answer,

      messageId:
        aiMessageRef.id,

      uid

    });

  } catch (error) {

    console.error(
      "FRIENDSZONE AI API ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        error?.message ||
        "Unknown server error"

    });

  }

}
