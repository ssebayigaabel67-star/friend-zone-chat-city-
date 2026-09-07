// ======================
// FIREBASE IMPORTS
// ======================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging.js";


// ======================
// FIREBASE CONFIG
// ======================

const firebaseConfig = {
  apiKey: "AIzaSyAxVyuHiNb-NEeXLfMfaq0RS9ERfahORt4",
  authDomain: "friend-zone-chat-city.firebaseapp.com",
  projectId: "friend-zone-chat-city",
  storageBucket: "friend-zone-chat-city.firebasestorage.app",
  messagingSenderId: "1077723243409",
  appId: "1:1077723243409:web:f030fdcd210f0326d93030",
  measurementId: "G-3RD3QLSF3F"
};


// ======================
// INITIALIZE FIREBASE
// ======================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const messaging = getMessaging(app);


// ==================================================
// FIREBASE CLOUD MESSAGING + AUTH
// ==================================================

if ("serviceWorker" in navigator) {

  navigator.serviceWorker
    .register("/firebase-messaging-sw.js")

    .then((registration) => {

      console.log(
        "Firebase messaging service worker registered."
      );


      // ==================================================
      // CHECK LOGGED-IN USER
      // ==================================================

      onAuthStateChanged(auth, async (user) => {

        if (!user) {

          console.log(
            "No user is signed in."
          );

          return;
        }


        console.log(
          "Logged-in user:",
          user.uid
        );


        try {

          // ======================
          // NOTIFICATION PERMISSION
          // ======================

          if (
            Notification.permission !== "granted"
          ) {

            const permission =
              await Notification.requestPermission();


            if (
              permission !== "granted"
            ) {

              console.log(
                "Notification permission denied."
              );

              return;
            }
          }


          // ======================
          // GET FCM TOKEN
          // ======================

          const token =
            await getToken(
              messaging,
              {
                vapidKey:
                  "BH6XiMfNNPSfvcnvFFtQNawwu1IcW1g25KUnMzvd9WDnB7UgalJoIkCkA4Kz2g_6BvOhCdUP1iY4LTD11xeW2e8",

                serviceWorkerRegistration:
                  registration
              }
            );


          if (!token) {

            console.log(
              "No FCM token available."
            );

            return;
          }


          console.log(
            "FCM Token:",
            token
          );


          // ======================
          // SAVE TOKEN TO FIRESTORE
          // ======================

          await setDoc(
            doc(
              db,
              "users",
              user.uid
            ),
            {
              fcmToken: token
            },
            {
              merge: true
            }
          );


          console.log(
            "FCM token saved to Firestore."
          );


        } catch (error) {

          console.error(
            "FCM token setup failed:",
            error
          );

        }

      });

    })

    .catch((error) => {

      console.error(
        "Firebase Messaging setup failed:",
        error
      );

    });

}


// ==================================================
// CREATE ACCOUNT
// ==================================================

const signupBtn =
  document.getElementById("signupBtn");


if (signupBtn) {

  signupBtn.addEventListener(
    "click",
    async () => {


      // ======================
      // GET FORM VALUES
      // ======================

      const name =
        document
          .getElementById("name")
          .value
          .trim();


      const email =
        document
          .getElementById("email")
          .value
          .trim();


      const password =
        document
          .getElementById("password")
          .value;


      const dob =
        document
          .getElementById("dob")
          .value;


      const phone =
        document
          .getElementById("phone")
          .value
          .trim();


      const nationality =
        document
          .getElementById("nationality")
          .value
          .trim();


      // ======================
      // GET GENDER
      // ======================

      const genderInput =
        document.querySelector(
          'input[name="gender"]:checked'
        );


      const gender =
        genderInput
          ? genderInput.value
          : "";


      // ======================
      // VALIDATION
      // ======================

      if (
        !name ||
        !email ||
        !password ||
        !dob ||
        !phone ||
        !nationality ||
        !gender
      ) {

        alert(
          "Please fill in all fields."
        );

        return;
      }


      try {

        // ======================
        // CREATE AUTH ACCOUNT
        // ======================

        const userCredential =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );


        const uid =
          userCredential.user.uid;


        // ======================
        // SAVE USER PROFILE
        // ======================

        await setDoc(
          doc(
            db,
            "users",
            uid
          ),
          {

            name: name,

            email: email,

            dob: dob,

            phone: phone,

            gender: gender,

            nationality: nationality,

            photoURL:
              "images/default-profile.png",

            online: true,

            friendsCount: 0,

            likesCount: 0

          }
        );


        // ======================
        // SUCCESS
        // ======================

        alert(
          "Account created successfully!"
        );


        window.location.href =
          "Homepage.html";


      } catch (error) {

        console.error(
          "Signup error:",
          error
        );


        alert(
          error.message
        );

      }

    }
  );

}


// ==================================================
// NEWS ROOM
// ==================================================

const rightNewsBtn =
  document.getElementById(
    "rightNewsBtn"
  );


const newsRoomPopover =
  document.getElementById(
    "newsRoomPopover"
  );


const closeNewsRoomPopover =
  document.getElementById(
    "closeNewsRoomPopover"
  );


// ======================
// OPEN NEWS ROOM
// ======================

if (
  rightNewsBtn &&
  newsRoomPopover
) {

  rightNewsBtn.addEventListener(
    "click",
    (event) => {

      event.preventDefault();

      event.stopPropagation();


      newsRoomPopover.classList.add(
        "show"
      );

    }
  );

}


// ======================
// CLOSE NEWS ROOM
// ======================

if (
  closeNewsRoomPopover &&
  newsRoomPopover
) {

  closeNewsRoomPopover.addEventListener(
    "click",
    (event) => {

      event.preventDefault();

      event.stopPropagation();


      newsRoomPopover.classList.remove(
        "show"
      );

    }
  );

}


// ==================================================
// NEWS ROOM CONNECTION TEST
// ==================================================

console.log(
  "📰 NEWS ROOM JS LOADED"
);


const testNewsButton =
  document.getElementById(
    "rightNewsBtn"
  );


console.log(
  "News button:",
  testNewsButton
);


if (testNewsButton) {

  testNewsButton.addEventListener(
    "click",
    () => {

      console.log(
        "📰 NEWS BUTTON CLICKED"
      );


      alert(
        "News Room button is connected!"
      );

    }
  );

} else {

  console.error(
    "❌ rightNewsBtn was NOT found."
  );

}