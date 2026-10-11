// ==============================
// FRIEND ZONE CHAT CITY
// CALLS.JS  (fixed)
// Voice + Video Calls using WebRTC, signaling through Firestore
// ==============================

import {
  initializeApp,
  getApp,
  getApps
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ==============================
// FIREBASE
// ==============================

const firebaseConfig = {
  apiKey: "AIzaSyAxVyuHiNb-NEeXLfMfaq0RS9ERfahORt4",
  authDomain: "friend-zone-chat-city.firebaseapp.com",
  projectId: "friend-zone-chat-city",
  storageBucket: "friend-zone-chat-city.firebasestorage.app",
  messagingSenderId: "1077723243409",
  appId: "1:1077723243409:web:f030fdcd210f0326d93030"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==============================
// WEBRTC CONFIG
// ==============================
// STUN alone only works on some networks. Phones on mobile data (CGNAT)
// usually need a TURN server too. Add yours here, for example:
//   { urls: "turn:YOUR_TURN_HOST:443?transport=tcp",
//     username: "USER", credential: "PASS" }

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" }
  ]
};

const RING_TIMEOUT_MS = 45000;
const STALE_CALL_MS = 60000;

// ==============================
// STATE
// ==============================

let peerConnection = null;
let localStream = null;
let remoteStream = null;

let currentCallId = null;
let currentCallType = null;
let isCaller = false;

let callTimer = null;
let callSeconds = 0;
let isMuted = false;
let ringTimeout = null;

let callsListenerStarted = false;
let incomingUnsub = null;
let callWatcher = null;
let offerCandidateListener = null;
let answerCandidateListener = null;

// ==============================
// HELPERS
// ==============================

const $ = id => document.getElementById(id);

function getSelectedFriendId() {
  return window.selectedFriendId || "";
}

function showEl(id, on) {
  const el = $(id);
  if (!el) return;
  el.classList.toggle("show", on);
  // Clear any inline display so the CSS class decides (block / flex).
  el.style.display = "";
}

function setCallStatus(text) {
  const status = $("callStatus");
  if (status) status.textContent = text;

  const side = $("sidebarCallStatus");
  if (side) side.textContent = text;
}

function showCallScreen() {
  showEl("callScreen", true);
}

function hideCallScreen() {
  showEl("callScreen", false);
}

function showIncomingBox() {
  showEl("incomingCallBox", true);
}

function hideIncomingBox() {
  showEl("incomingCallBox", false);
}

function friendlyMediaError(error) {
  switch (error && error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone/camera permission was blocked. Allow it in your browser settings and try again.";
    case "NotFoundError":
      return "No microphone or camera was found on this device.";
    case "NotReadableError":
      return "Your microphone or camera is being used by another app.";
    default:
      return (error && error.message) || "Unknown error";
  }
}

// ==============================
// TIMER
// ==============================

function startCallTimer() {
  stopCallTimer();

  const timer = $("callTimer");

  callTimer = setInterval(() => {
    callSeconds++;
    const m = String(Math.floor(callSeconds / 60)).padStart(2, "0");
    const s = String(callSeconds % 60).padStart(2, "0");
    if (timer) timer.textContent = `${m}:${s}`;
  }, 1000);
}

function stopCallTimer() {
  if (callTimer) {
    clearInterval(callTimer);
    callTimer = null;
  }

  callSeconds = 0;

  const timer = $("callTimer");
  if (timer) timer.textContent = "00:00";
}

// ==============================
// MEDIA + PEER CONNECTION CLEANUP
// ==============================

function stopLocalStream() {
  if (!localStream) return;
  localStream.getTracks().forEach(t => t.stop());
  localStream = null;
}

function removeListeners() {
  if (callWatcher) { callWatcher(); callWatcher = null; }
  if (offerCandidateListener) { offerCandidateListener(); offerCandidateListener = null; }
  if (answerCandidateListener) { answerCandidateListener(); answerCandidateListener = null; }
}

function closePeerConnection() {
  if (peerConnection) {
    try {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
    } catch (error) {
      console.error("Peer connection close error:", error);
    }
  }

  peerConnection = null;
  remoteStream = null;
}

// ==============================
// CREATE PEER CONNECTION
// ==============================

function createPeerConnection() {
  closePeerConnection();

  const pc = new RTCPeerConnection(rtcConfig);
  peerConnection = pc;

  remoteStream = new MediaStream();

  const remoteAudio = $("remoteAudio");
  if (remoteAudio) remoteAudio.srcObject = remoteStream;

  const remoteVideo = $("remoteVideo");
  if (remoteVideo) remoteVideo.srcObject = remoteStream;

  // Receive remote tracks
  pc.ontrack = event => {
    const tracks = event.streams && event.streams[0]
      ? event.streams[0].getTracks()
      : [event.track];

    tracks.forEach(track => {
      if (!remoteStream.getTracks().includes(track)) {
        remoteStream.addTrack(track);
      }
    });

    if (remoteAudio) {
      // Called after a tap (Call/Accept), so mobile browsers allow it.
      remoteAudio.play().catch(err => console.warn("Remote audio play blocked:", err));
    }

    if (remoteVideo && remoteStream.getVideoTracks().length) {
      remoteVideo.style.display = "block";
      remoteVideo.play().catch(() => {});
    }
  };

  // Send local tracks
  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.onconnectionstatechange = () => {
    if (pc !== peerConnection) return;

    console.log("WebRTC connection:", pc.connectionState);

    if (pc.connectionState === "connected") {
      clearTimeout(ringTimeout);
      setCallStatus("Connected");
      startCallTimer();
    }

    if (pc.connectionState === "failed") {
      setCallStatus("Connection failed. Both phones may need a TURN server.");
    }

    if (pc.connectionState === "disconnected") {
      setCallStatus("Disconnected");
    }
  };

  return pc;
}

// ==============================
// GET MEDIA
// ==============================

async function getMedia(type) {
  stopLocalStream();

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: type === "video"
  });

  const localVideo = $("localVideo");

  if (localVideo && localStream.getVideoTracks().length) {
    localVideo.srcObject = localStream;
    localVideo.style.display = "block";
  }

  return localStream;
}

// ==============================
// START CALL (CALLER)
// ==============================

async function startCall(type) {
  const user = auth.currentUser;

  if (!user) {
    alert("You are not logged in.");
    return;
  }

  if (peerConnection || currentCallId) {
    alert("You are already in a call.");
    return;
  }

  const friendId = getSelectedFriendId();

  if (!friendId) {
    alert("Select a friend first.");
    return;
  }

  if (friendId === user.uid) {
    alert("You cannot call yourself.");
    return;
  }

  try {
    isCaller = true;
    currentCallType = type;

    // Show the call screen right away so the caller always sees something.
    showCallScreen();
    setCallStatus("Requesting microphone...");

    await getMedia(type);

    const callRef = doc(collection(db, "calls"));
    currentCallId = callRef.id;

    const offerCandidates = collection(callRef, "offerCandidates");

    const pc = createPeerConnection();

    pc.onicecandidate = async event => {
      if (!event.candidate) return;

      try {
        await addDoc(offerCandidates, event.candidate.toJSON());
      } catch (error) {
        console.error("Offer ICE error:", error);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await setDoc(callRef, {
      caller: user.uid,
      receiver: friendId,
      type,
      offer: { type: offer.type, sdp: offer.sdp },
      status: "ringing",
      createdAt: serverTimestamp()
    });

    setCallStatus(type === "video" ? "Calling with video..." : "Calling...");

    watchCall(currentCallId);

    // Stop ringing forever if nobody answers.
    clearTimeout(ringTimeout);
    ringTimeout = setTimeout(async () => {
      if (currentCallId && isCaller && peerConnection &&
          peerConnection.connectionState !== "connected") {
        setCallStatus("No answer");
        await endCall("No answer");
      }
    }, RING_TIMEOUT_MS);

  } catch (error) {
    console.error("Start call error:", error);

    const message =
      error && error.code === "permission-denied"
        ? "Firestore blocked the call. Check your Firestore rules for the \"calls\" collection."
        : friendlyMediaError(error);

    await cleanupCall("");
    alert("Call failed: " + message);
  }
}

// ==============================
// WATCH THE CALL DOCUMENT (BOTH SIDES)
// ==============================

function watchCall(callId) {
  if (callWatcher) callWatcher();

  const callRef = doc(db, "calls", callId);

  callWatcher = onSnapshot(
    callRef,
    async snapshot => {
      if (callId !== currentCallId) return;
      if (!snapshot.exists()) return;

      const call = snapshot.data();

      if (call.status === "ended") {
        await cleanupCall("Call ended");
        return;
      }

      if (call.status === "declined") {
        await cleanupCall("Call declined");
        return;
      }

      // Caller: answer arrived
      if (
        isCaller &&
        call.answer &&
        peerConnection &&
        !peerConnection.currentRemoteDescription
      ) {
        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(call.answer)
          );

          setCallStatus("Connecting...");
          listenForCandidates(callId, "answerCandidates");
        } catch (error) {
          console.error("Set remote answer error:", error);
        }
      }
    },
    error => console.error("Call watcher error:", error)
  );
}

// ==============================
// ICE CANDIDATES FROM THE OTHER SIDE
// ==============================

function listenForCandidates(callId, subcollection) {
  const isOffer = subcollection === "offerCandidates";

  if (isOffer && offerCandidateListener) offerCandidateListener();
  if (!isOffer && answerCandidateListener) answerCandidateListener();

  const unsub = onSnapshot(
    collection(db, "calls", callId, subcollection),
    snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type !== "added") return;
        if (!peerConnection) return;

        try {
          await peerConnection.addIceCandidate(
            new RTCIceCandidate(change.doc.data())
          );
        } catch (error) {
          console.error(subcollection + " ICE error:", error);
        }
      });
    },
    error => console.error(subcollection + " listener error:", error)
  );

  if (isOffer) offerCandidateListener = unsub;
  else answerCandidateListener = unsub;
}

// ==============================
// INCOMING CALL LISTENER (RECEIVER)
// ==============================

function startIncomingCallListener(user) {
  if (callsListenerStarted) return;
  callsListenerStarted = true;

  incomingUnsub = onSnapshot(
    query(collection(db, "calls"), where("receiver", "==", user.uid)),
    snapshot => {
      snapshot.docChanges().forEach(change => {
        const call = change.doc.data();
        const id = change.doc.id;

        // Caller cancelled / call ended while it was still ringing
        if (change.type === "modified" || change.type === "removed") {
          if (id === currentCallId && !isCaller && !peerConnection &&
              call.status !== "ringing") {
            hideIncomingBox();
            currentCallId = null;
            currentCallType = null;
          }
          return;
        }

        if (change.type !== "added") return;
        if (call.status !== "ringing") return;
        if (call.caller === user.uid) return;

        // Ignore old calls that were never closed
        const created = call.createdAt && call.createdAt.toMillis
          ? call.createdAt.toMillis()
          : Date.now();

        if (Date.now() - created > STALE_CALL_MS) return;

        // Already busy: tell the caller
        if (currentCallId || peerConnection) {
          updateDoc(doc(db, "calls", id), {
            status: "declined",
            endedAt: serverTimestamp()
          }).catch(() => {});
          return;
        }

        currentCallId = id;
        currentCallType = call.type || "voice";
        isCaller = false;

        showIncomingCall(call);
      });
    },
    error => {
      console.error("Incoming call listener error:", error);
      if (error.code === "permission-denied") {
        console.error('Firestore rules are blocking reads on the "calls" collection.');
      }
    }
  );
}

// ==============================
// SHOW INCOMING CALL
// ==============================

function showIncomingCall(call) {
  const callerName = $("callerName");

  if (callerName) {
    callerName.textContent =
      call.type === "video"
        ? "Incoming video call..."
        : "Incoming voice call...";
  }

  showIncomingBox();

  if (navigator.vibrate) {
    navigator.vibrate([300, 150, 300]);
  }

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(
        call.type === "video" ? "Incoming video call" : "Incoming voice call"
      );
    } catch (e) {
      // Some mobile browsers only allow notifications via service workers.
    }
  }
}

// ==============================
// ACCEPT CALL (RECEIVER)
// ==============================

async function acceptCall() {
  if (!currentCallId) {
    alert("No incoming call found.");
    return;
  }

  const callId = currentCallId;

  try {
    const callRef = doc(db, "calls", callId);
    const callSnap = await getDoc(callRef);

    if (!callSnap.exists()) {
      alert("This call no longer exists.");
      await cleanupCall("");
      return;
    }

    const call = callSnap.data();

    if (call.status !== "ringing") {
      alert("This call is no longer available.");
      await cleanupCall("");
      return;
    }

    const type = call.type || "voice";
    currentCallType = type;
    isCaller = false;

    hideIncomingBox();
    showCallScreen();
    setCallStatus("Connecting...");

    await getMedia(type);

    const pc = createPeerConnection();

    const answerCandidates = collection(callRef, "answerCandidates");

    pc.onicecandidate = async event => {
      if (!event.candidate) return;

      try {
        await addDoc(answerCandidates, event.candidate.toJSON());
      } catch (error) {
        console.error("Answer ICE error:", error);
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(call.offer));

    listenForCandidates(callId, "offerCandidates");

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await updateDoc(callRef, {
      answer: { type: answer.type, sdp: answer.sdp },
      status: "connected",
      answeredAt: serverTimestamp()
    });

    // So the receiver also notices when the caller hangs up.
    watchCall(callId);

  } catch (error) {
    console.error("Accept call error:", error);

    const message =
      error && error.code === "permission-denied"
        ? "Firestore blocked the call. Check your Firestore rules for the \"calls\" collection."
        : friendlyMediaError(error);

    await cleanupCall("");
    alert("Could not accept the call: " + message);
  }
}

// ==============================
// DECLINE CALL
// ==============================

async function declineCall() {
  const callId = currentCallId;

  hideIncomingBox();

  if (!callId) return;

  try {
    await updateDoc(doc(db, "calls", callId), {
      status: "declined",
      endedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Decline call error:", error);
  }

  currentCallId = null;
  currentCallType = null;
}

// ==============================
// END CALL
// ==============================

async function endCall(message) {
  const callId = currentCallId;

  try {
    if (callId) {
      await updateDoc(doc(db, "calls", callId), {
        status: "ended",
        endedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("End call Firebase error:", error);
  }

  await cleanupCall(typeof message === "string" ? message : "");
}

// ==============================
// CLEANUP
// ==============================

async function cleanupCall(message) {
  clearTimeout(ringTimeout);
  ringTimeout = null;

  removeListeners();
  stopLocalStream();
  closePeerConnection();
  stopCallTimer();

  hideIncomingBox();
  hideCallScreen();

  ["remoteAudio", "localAudio", "remoteVideo", "localVideo"].forEach(id => {
    const el = $(id);
    if (el) el.srcObject = null;
  });

  const rv = $("remoteVideo");
  if (rv) rv.style.display = "none";

  const lv = $("localVideo");
  if (lv) lv.style.display = "none";

  isMuted = false;

  const muteBtn = $("muteBtn");
  if (muteBtn) {
    if (muteBtn.lastChild) muteBtn.lastChild.textContent = " Mute";
  }

  setCallStatus(message || "");

  if (message) {
    setTimeout(() => {
      if (!currentCallId) setCallStatus("");
    }, 3000);
  }

  currentCallId = null;
  currentCallType = null;
  isCaller = false;
}

// ==============================
// BUTTONS (event delegation, works even if the HTML is re-rendered)
// ==============================

document.addEventListener("click", event => {
  const t = event.target;

  if (t.closest("#voiceCallBtn")) {
    console.log("Voice call button clicked, friend:", getSelectedFriendId());
    startCall("voice");
    return;
  }

  if (t.closest("#videoCallBtn")) {
    console.log("Video call button clicked, friend:", getSelectedFriendId());
    startCall("video");
    return;
  }

  if (t.closest("#acceptCallBtn")) {
    acceptCall();
    return;
  }

  if (t.closest("#declineCallBtn")) {
    declineCall();
    return;
  }

  if (t.closest("#hangUpBtn") || t.closest("#callHangUpBtn")) {
    endCall();
    return;
  }

  const muteBtn = t.closest("#muteBtn");

  if (muteBtn) {
    if (!localStream) return;

    isMuted = !isMuted;

    localStream.getAudioTracks().forEach(track => {
      track.enabled = !isMuted;
    });

    if (muteBtn.lastChild) {
      muteBtn.lastChild.textContent = isMuted ? " Unmute" : " Mute";
    }

    return;
  }

  if (t.closest("#speakerBtn")) {
    const audio = $("remoteAudio");
    if (audio) audio.volume = audio.volume < 1 ? 1 : 0.5;
  }
});

// ==============================
// AUTH STATE
// ==============================

onAuthStateChanged(auth, user => {
  if (!user) {
    if (incomingUnsub) {
      incomingUnsub();
      incomingUnsub = null;
    }

    callsListenerStarted = false;
    return;
  }

  console.log("Calls.js ready for:", user.uid);

  startIncomingCallListener(user);
});

// ==============================
// DEBUG EXPORT
// ==============================

window.endFriendZoneCall = endCall;

console.log("Calls.js loaded successfully");
