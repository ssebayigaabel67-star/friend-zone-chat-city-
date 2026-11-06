// ==========================================================
// CREATE ACCOUNT  (checks everything before the account exists)
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  fillCountrySelect,
  fillDialSelect,
  countryByIso,
  dobLimits,
  validateName,
  validateEmail,
  validatePassword,
  validateDob,
  validateCountry,
  validatePhone
} from "./fz-validate.js";

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
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

const nameEl = $("name");
const emailEl = $("email");
const passwordEl = $("password");
const confirmEl = $("confirmPassword");
const dobEl = $("dob");
const countryEl = $("country");
const dialEl = $("phoneCountry");
const phoneEl = $("phone");
const agreeEl = $("agree");
const signupBtn = $("signupBtn");
const formMessage = $("formMessage");

// ---------- set up the boxes ----------
fillCountrySelect(countryEl, "", "Select your country");
fillDialSelect(dialEl, "UG");

const limits = dobLimits();
dobEl.min = limits.min;
dobEl.max = limits.max;

// picking a country also picks its phone code (until the person changes the code themselves)
let dialTouched = false;
dialEl.addEventListener("change", () => { dialTouched = true; });
countryEl.addEventListener("change", () => {
  if (!dialTouched && countryByIso(countryEl.value)) {
    dialEl.value = countryEl.value;
  }
});

// show / hide passwords
$("showPw").addEventListener("change", (e) => {
  const type = e.target.checked ? "text" : "password";
  passwordEl.type = type;
  confirmEl.type = type;
});

// ---------- showing results ----------
function mark(inputId, errId, result) {
  const input = $(inputId);
  const err = $(errId);
  if (err) err.textContent = result.ok ? "" : result.error;
  if (input) {
    input.classList.toggle("invalid", !result.ok);
    input.classList.toggle("valid", result.ok);
  }
  return result;
}

const checks = {
  name: () => mark("name", "err-name", validateName(nameEl.value)),
  email: () => mark("email", "err-email", validateEmail(emailEl.value)),
  password: () => mark("password", "err-password", validatePassword(passwordEl.value)),
  confirmPassword: () => {
    const same = passwordEl.value === confirmEl.value && confirmEl.value !== "";
    return mark("confirmPassword", "err-confirmPassword",
      same ? { ok: true } : { ok: false, error: "The two passwords do not match." });
  },
  dob: () => mark("dob", "err-dob", validateDob(dobEl.value)),
  country: () => mark("country", "err-country", validateCountry(countryEl.value)),
  phone: () => mark("phone", "err-phone", validatePhone(dialEl.value, phoneEl.value)),
  gender: () => {
    const picked = document.querySelector('input[name="gender"]:checked');
    const result = picked ? { ok: true } : { ok: false, error: "Please choose your gender." };
    $("err-gender").textContent = result.ok ? "" : result.error;
    $("genderRow").classList.toggle("invalid", !result.ok);
    return result;
  },
  agree: () => {
    const result = agreeEl.checked
      ? { ok: true }
      : { ok: false, error: "Please tick the box to continue." };
    $("err-agree").textContent = result.ok ? "" : result.error;
    return result;
  }
};

// check each box when the person leaves it
[["name", nameEl], ["email", emailEl], ["password", passwordEl],
 ["confirmPassword", confirmEl], ["dob", dobEl], ["country", countryEl],
 ["phone", phoneEl]].forEach(([key, el]) => {
  el.addEventListener("blur", () => { if (el.value) checks[key](); });
});
countryEl.addEventListener("change", checks.country);
dobEl.addEventListener("change", checks.dob);
document.querySelectorAll('input[name="gender"]').forEach((r) => {
  r.addEventListener("change", checks.gender);
});
agreeEl.addEventListener("change", checks.agree);

function say(text, kind) {
  formMessage.textContent = text;
  formMessage.className = kind || "";
}

function friendlyAuthError(error) {
  switch (error && error.code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "That password is too weak. Use at least 8 characters with letters and numbers.";
    case "auth/network-request-failed":
      return "No internet connection. Please check your network and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    default:
      return "Could not create the account. Please try again.";
  }
}

// ---------- create the account ----------
signupBtn.addEventListener("click", async () => {
  say("", "");

  const order = ["name", "email", "password", "confirmPassword", "dob",
                 "country", "phone", "gender", "agree"];
  let firstBad = null;
  order.forEach((key) => {
    const result = checks[key]();
    if (!result.ok && !firstBad) firstBad = key;
  });

  if (firstBad) {
    say("Please fix the red messages above.", "bad");
    const target = $(firstBad) || $("genderRow");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    if (target.focus && $(firstBad)) target.focus({ preventScroll: true });
    return;
  }

  // clean, checked values
  const name = validateName(nameEl.value).value;
  const email = validateEmail(emailEl.value).value;
  const dob = validateDob(dobEl.value).value;
  const country = validateCountry(countryEl.value).value;
  const phone = validatePhone(dialEl.value, phoneEl.value);
  const gender = document.querySelector('input[name="gender"]:checked').value;

  signupBtn.disabled = true;
  signupBtn.textContent = "Creating account...";

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, passwordEl.value);
    const user = credential.user;

    await setDoc(doc(db, "users", user.uid), {
      name: name,
      email: email,
      dob: dob,
      gender: gender,

      // country (with its code, so the flag always shows)
      country: country.name,
      countryCode: country.iso,
      nationality: country.name, // kept so older parts of the app keep working

      // phone saved in full international format
      phone: phone.e164,
      phoneCountry: phone.iso,

      photoURL: "images/default-profile.png",
      online: true,
      friendsCount: 0,
      likesCount: 0,
      createdAt: serverTimestamp()
    });

    // proves the email really belongs to this person
    let mailSent = true;
    try {
      await sendEmailVerification(user);
    } catch (mailError) {
      mailSent = false;
      console.warn("Verification email not sent:", mailError);
    }

    say(
      mailSent
        ? "✅ Account created! We sent a link to " + email + " — open it to confirm your email."
        : "✅ Account created!",
      "good"
    );

    setTimeout(() => { window.location.href = "Homepage.html"; }, 2200);

  } catch (error) {
    console.error("Signup error:", error);
    say(friendlyAuthError(error), "bad");
    signupBtn.disabled = false;
    signupBtn.textContent = "Create Account";
  }
});

// "Back" goes to the page the person came from
const backLink = document.getElementById("backLink");
if (backLink) {
  backLink.addEventListener("click", (e) => {
    if (window.history.length > 1) {
      e.preventDefault();
      window.history.back();
    }
  });
}
