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

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error(error);
});

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const messageEl = document.getElementById("message");

// ---- "Show password" tick box (added here, no HTML change needed) ----
const showWrap = document.createElement("label");
showWrap.style.cssText =
  "display:block;margin:2px 0 6px;font-size:13px;color:#fff;cursor:pointer;";
showWrap.innerHTML =
  '<input type="checkbox" id="showPassword" style="width:auto;margin:0 6px 0 0;padding:0;vertical-align:middle;"> Show password';
passwordEl.insertAdjacentElement("afterend", showWrap);
passwordEl.insertAdjacentElement("afterend", document.createElement("br"));
// (the <br> that was already after the password box stays; the tick box sits between)
document.getElementById("showPassword").addEventListener("change", (e) => {
  passwordEl.type = e.target.checked ? "text" : "password";
});

function friendlyError(error) {
  switch (error && error.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password. Please try again.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes or use “Forgot Password?”.";
    case "auth/network-request-failed":
      return "No internet connection. Please check your network and try again.";
    default:
      return "Could not sign in. Please try again.";
  }
}

async function signIn() {
  const email = emailEl.value.trim();
  const password = passwordEl.value;

  messageEl.textContent = "";

  if (!email || !password) {
    messageEl.textContent = "Please enter your email and password.";
    return;
  }

  loginBtn.disabled = true;
  const oldText = loginBtn.textContent;
  loginBtn.textContent = "Signing in...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "Homepage.html";
  } catch (error) {
    console.error(error);
    messageEl.textContent = friendlyError(error);
    loginBtn.disabled = false;
    loginBtn.textContent = oldText;
  }
}

loginBtn.addEventListener("click", signIn);

[emailEl, passwordEl].forEach((el) => {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") signIn();
  });
});
