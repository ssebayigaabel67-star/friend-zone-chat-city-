import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAxVyuHiNb-NEeXLfMfaq0RS9ERfahORt4",
  authDomain: "friend-zone-chat-city.firebaseapp.com",
  projectId: "friend-zone-chat-city",
  storageBucket: "friend-zone-chat-city.firebasestorage.app",
  messagingSenderId: "1077723243409",
  appId: "1:1077723243409:web:f030fdcd210f0326d93030",
  measurementId: "G-3RD3QLSF3F"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence)
.then(() => {
  console.log("Auth persistence enabled");
})
.catch((error) => {
  console.error(error);
});

document.getElementById("loginBtn").addEventListener("click", async () => {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {const userCredential = await signInWithEmailAndPassword(
  auth,
  email,
  password
);

alert("Login successful!");

window.location.href = "Homepage.html";} catch (error) {

    document.getElementById("message").textContent =
      error.message;

    console.error(error);

  }

});