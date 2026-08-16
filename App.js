// ======================
// FIREBASE IMPORTS
// ======================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


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

const app =
  initializeApp(firebaseConfig);

const auth =
  getAuth(app);

const db =
  getFirestore(app);


// ======================
// CREATE ACCOUNT
// ======================

document
  .getElementById("signupBtn")
  .addEventListener(
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