// ==============================
// FRIEND ZONE CHAT CITY
// CALLS.JS
// Voice + Video Calls using WebRTC
// ==============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ==============================
// FIREBASE CONFIG
// ==============================

const firebaseConfig = {
  apiKey: "AIzaSyAxVyuHiNb-NEeXLfMfaq0RS9ERfahORt4",
  authDomain: "friend-zone-chat-city.firebaseapp.com",
  projectId: "friend-zone-chat-city",
  storageBucket: "friend-zone-chat-city.firebasestorage.app",
  messagingSenderId: "1077723243409",
  appId: "1:1077723243409:web:f030fdcd210f0326d93030"
};


// ==============================
// FIREBASE
// ==============================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


// ==============================
// WEBRTC CONFIG
// ==============================

const rtcConfig = {

  iceServers: [

    {
      urls: "stun:stun.l.google.com:19302"
    }

  ]

};


// ==============================
// GLOBAL VARIABLES
// ==============================

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let currentCallId = null;

let currentCallType = null;

let callTimer = null;

let callSeconds = 0;

let isMuted = false;

let callsListenerStarted = false;

let answerListener = null;

let offerCandidateListener = null;

let answerCandidateListener = null;

let currentUserReady = false;


// ==============================
// HELPER
// ==============================

function getSelectedFriendId() {

  return window.selectedFriendId || "";

}


// ==============================
// CALL STATUS
// ==============================

function setCallStatus(text) {

  const status =
    document.getElementById("callStatus");

  if (status) {
    status.textContent = text;
  }

}


// ==============================
// CALL SCREEN
// ==============================

function showCallScreen() {

  const screen =
    document.getElementById("callScreen");

  if (screen) {
    screen.style.display = "block";
  }

}


// ==============================
// HIDE CALL SCREEN
// ==============================

function hideCallScreen() {

  const screen =
    document.getElementById("callScreen");

  if (screen) {
    screen.style.display = "none";
  }

}


// ==============================
// TIMER
// ==============================

function startCallTimer() {

  stopCallTimer();

  callSeconds = 0;

  const timer =
    document.getElementById("callTimer");

  if (timer) {
    timer.textContent = "00:00";
  }

  callTimer = setInterval(() => {

    callSeconds++;

    const minutes =
      Math.floor(callSeconds / 60);

    const seconds =
      callSeconds % 60;

    if (timer) {

      timer.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    }

  }, 1000);

}


// ==============================
// STOP TIMER
// ==============================

function stopCallTimer() {

  if (callTimer) {

    clearInterval(callTimer);

    callTimer = null;

  }

  callSeconds = 0;

  const timer =
    document.getElementById("callTimer");

  if (timer) {
    timer.textContent = "00:00";
  }

}


// ==============================
// STOP LOCAL MEDIA
// ==============================

function stopLocalStream() {

  if (!localStream) return;

  localStream
    .getTracks()
    .forEach(track => {

      track.stop();

    });

  localStream = null;

}


// ==============================
// CLEAN ICE LISTENERS
// ==============================

function removeCandidateListeners() {

  if (answerListener) {

    answerListener();

    answerListener = null;

  }

  if (offerCandidateListener) {

    offerCandidateListener();

    offerCandidateListener = null;

  }

  if (answerCandidateListener) {

    answerCandidateListener();

    answerCandidateListener = null;

  }

}


// ==============================
// CLOSE PEER CONNECTION
// ==============================

function closePeerConnection() {

  if (peerConnection) {

    try {

      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;

      peerConnection.close();

    } catch (error) {

      console.error(
        "Peer connection close error:",
        error
      );

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

  peerConnection =
    new RTCPeerConnection(rtcConfig);

  remoteStream =
    new MediaStream();

  const remoteAudio =
    document.getElementById("remoteAudio");

  if (remoteAudio) {

    remoteAudio.srcObject =
      remoteStream;

  }


  // RECEIVE REMOTE TRACKS

  peerConnection.ontrack = event => {

    event.streams[0]
      .getTracks()
      .forEach(track => {

        remoteStream.addTrack(track);

      });

  };


  // ADD LOCAL TRACKS

  if (localStream) {

    localStream
      .getTracks()
      .forEach(track => {

        peerConnection.addTrack(
          track,
          localStream
        );

      });

  }


  // CONNECTION STATE

  peerConnection.onconnectionstatechange = () => {

    if (!peerConnection) return;

    console.log(
      "WebRTC connection:",
      peerConnection.connectionState
    );


    if (
      peerConnection.connectionState ===
      "connected"
    ) {

      setCallStatus("Connected");

      startCallTimer();

    }


    if (
      peerConnection.connectionState ===
      "failed"
    ) {

      setCallStatus(
        "Connection failed"
      );

    }


    if (
      peerConnection.connectionState ===
      "disconnected"
    ) {

      setCallStatus(
        "Disconnected"
      );

    }

  };


  return peerConnection;

}


// ==============================
// GET MEDIA
// ==============================

async function getMedia(type) {

  if (localStream) {

    stopLocalStream();

  }


  if (type === "video") {

    localStream =
      await navigator.mediaDevices.getUserMedia({

        audio: {
          echoCancellation: true,
          noiseSuppression: true
        },

        video: true

      });

  } else {

    localStream =
      await navigator.mediaDevices.getUserMedia({

        audio: {
          echoCancellation: true,
          noiseSuppression: true
        },

        video: false

      });

  }


  // Show local video if available

  const localVideo =
    document.getElementById("localVideo");

  if (
    localVideo &&
    localStream.getVideoTracks().length
  ) {

    localVideo.srcObject =
      localStream;

  }


  return localStream;

}


// ==============================
// START CALL
// ==============================

async function startCall(type) {

  const user = auth.currentUser;

  if (!user) {

    alert("You are not logged in.");

    return;

  }


  const friendId =
    getSelectedFriendId();


  if (!friendId) {

    alert(
      "Select a friend first."
    );

    return;

  }


  if (
    friendId === user.uid
  ) {

    alert(
      "You cannot call yourself."
    );

    return;

  }


  try {

    setCallStatus(
      "Requesting microphone..."
    );


    await getMedia(type);


    currentCallType =
      type;


    const callRef =
      doc(collection(db, "calls"));


    currentCallId =
      callRef.id;


    const offerCandidates =
      collection(
        callRef,
        "offerCandidates"
      );


    createPeerConnection();


    // ICE candidates

    peerConnection.onicecandidate =
      async event => {

        if (!event.candidate) return;

        try {

          await addDoc(
            offerCandidates,
            event.candidate.toJSON()
          );

        } catch (error) {

          console.error(
            "Offer ICE error:",
            error
          );

        }

      };


    // Create offer

    const offer =
      await peerConnection.createOffer();


    await peerConnection.setLocalDescription(
      offer
    );


    // Save call

    await setDoc(
      callRef,
      {

        caller: user.uid,

        receiver: friendId,

        type: type,

        offer: {

          type: offer.type,

          sdp: offer.sdp

        },

        status: "ringing",

        createdAt:
          serverTimestamp()

      }
    );


    showCallScreen();


    setCallStatus(
      type === "video"
        ? "Calling with video..."
        : "Calling..."
    );


    listenForAnswer(
      currentCallId
    );


  } catch (error) {

    console.error(
      "Start call error:",
      error
    );

    stopLocalStream();

    closePeerConnection();

    alert(
      "Could not start the call. Check microphone/camera permissions."
    );

    setCallStatus("");

  }

}


// ==============================
// LISTEN FOR ANSWER
// ==============================

function listenForAnswer(callId) {

  if (answerListener) {

    answerListener();

  }


  const callRef =
    doc(db, "calls", callId);


  answerListener =
    onSnapshot(
      callRef,
      async snapshot => {

        if (!snapshot.exists()) return;

        const call =
          snapshot.data();


        // Call ended

        if (
          call.status ===
          "ended"
        ) {

          await cleanupCall(
            false
          );

          return;

        }


        // Call declined

        if (
          call.status ===
          "declined"
        ) {

          setCallStatus(
            "Call declined"
          );

          await cleanupCall(
            false
          );

          return;

        }


        // Answer received

        if (
          call.answer &&
          peerConnection &&
          !peerConnection.currentRemoteDescription
        ) {

          try {

            await peerConnection.setRemoteDescription(

              new RTCSessionDescription(
                call.answer
              )

            );


            listenForAnswerCandidates(
              callId
            );


          } catch (error) {

            console.error(
              "Set remote answer error:",
              error
            );

          }

        }

      }
    );

}


// ==============================
// ANSWER ICE CANDIDATES
// ==============================

function listenForAnswerCandidates(
  callId
) {

  if (answerCandidateListener) {

    answerCandidateListener();

  }


  const candidatesRef =
    collection(
      db,
      "calls",
      callId,
      "answerCandidates"
    );


  answerCandidateListener =
    onSnapshot(
      candidatesRef,
      snapshot => {

        snapshot.docChanges()
          .forEach(async change => {

            if (
              change.type !==
              "added"
            ) return;


            if (!peerConnection) return;


            try {

              await peerConnection.addIceCandidate(

                new RTCIceCandidate(
                  change.doc.data()
                )

              );

            } catch (error) {

              console.error(
                "Answer ICE error:",
                error
              );

            }

          });

      }
    );

}


// ==============================
// INCOMING CALL LISTENER
// ==============================

function startIncomingCallListener() {

  if (callsListenerStarted) return;

  callsListenerStarted = true;


  onSnapshot(
    collection(db, "calls"),
    snapshot => {

      snapshot.docChanges()
        .forEach(change => {

          if (
            change.type !==
            "added"
          ) return;


          const call =
            change.doc.data();


          const user =
            auth.currentUser;


          if (!user) return;


          if (
            call.receiver !==
            user.uid
          ) return;


          if (
            call.status !==
            "ringing"
          ) return;


          // Ignore our own calls

          if (
            call.caller ===
            user.uid
          ) return;


          currentCallId =
            change.doc.id;

          currentCallType =
            call.type || "voice";


          showIncomingCall(
            call
          );

        });

    }
  );

}


// ==============================
// SHOW INCOMING CALL
// ==============================

async function showIncomingCall(
  call
) {

  const box =
    document.getElementById(
      "incomingCallBox"
    );


  const callerName =
    document.getElementById(
      "callerName"
    );


  if (callerName) {

    callerName.textContent =
      call.type === "video"
        ? "📹 Incoming video call..."
        : "📞 Incoming voice call...";

  }


  if (box) {

    box.style.display =
      "block";

  }


  // Try notification

  if (
    "Notification" in window &&
    Notification.permission ===
      "granted"
  ) {

    new Notification(
      call.type === "video"
        ? "Incoming video call"
        : "Incoming voice call"
    );

  }

}


// ==============================
// ACCEPT CALL
// ==============================

async function acceptCall() {

  if (!currentCallId) {

    alert(
      "No incoming call found."
    );

    return;

  }


  const callId =
    currentCallId;


  try {

    const callRef =
      doc(db, "calls", callId);


    const callSnap =
      await getDoc(callRef);


    if (!callSnap.exists()) {

      alert(
        "This call no longer exists."
      );

      return;

    }


    const call =
      callSnap.data();


    if (
      call.status !==
      "ringing"
    ) {

      alert(
        "This call is no longer available."
      );

      return;

    }


    const type =
      call.type || "voice";


    currentCallType =
      type;


    const box =
      document.getElementById(
        "incomingCallBox"
      );


    if (box) {

      box.style.display =
        "none";

    }


    setCallStatus(
      "Connecting..."
    );


    await getMedia(type);


    createPeerConnection();


    const answerCandidates =
      collection(
        callRef,
        "answerCandidates"
      );


    // ICE candidates

    peerConnection.onicecandidate =
      async event => {

        if (!event.candidate) return;

        try {

          await addDoc(
            answerCandidates,
            event.candidate.toJSON()
          );

        } catch (error) {

          console.error(
            "Answer ICE error:",
            error
          );

        }

      };


    // Set caller offer

    await peerConnection.setRemoteDescription(

      new RTCSessionDescription(
        call.offer
      )

    );


    // Listen for caller ICE

    listenForOfferCandidates(
      callId
    );


    // Create answer

    const answer =
      await peerConnection.createAnswer();


    await peerConnection.setLocalDescription(
      answer
    );


    await updateDoc(
      callRef,
      {

        answer: {

          type: answer.type,

          sdp: answer.sdp

        },

        status:
          "connected",

        answeredAt:
          serverTimestamp()

      }
    );


    showCallScreen();


    setCallStatus(
      "Connecting..."
    );


  } catch (error) {

    console.error(
      "Accept call error:",
      error
    );

    alert(
      "Could not accept the call."
    );

    await cleanupCall(
      true
    );

  }

}


// ==============================
// OFFER ICE CANDIDATES
// ==============================

function listenForOfferCandidates(
  callId
) {

  if (offerCandidateListener) {

    offerCandidateListener();

  }


  const candidatesRef =
    collection(
      db,
      "calls",
      callId,
      "offerCandidates"
    );


  offerCandidateListener =
    onSnapshot(
      candidatesRef,
      snapshot => {

        snapshot.docChanges()
          .forEach(async change => {

            if (
              change.type !==
              "added"
            ) return;


            if (!peerConnection) return;


            try {

              await peerConnection.addIceCandidate(

                new RTCIceCandidate(
                  change.doc.data()
                )

              );

            } catch (error) {

              console.error(
                "Offer ICE error:",
                error
              );

            }

          });

      }
    );

}


// ==============================
// DECLINE CALL
// ==============================

async function declineCall() {

  if (!currentCallId) return;


  try {

    await updateDoc(

      doc(
        db,
        "calls",
        currentCallId
      ),

      {

        status:
          "declined",

        endedAt:
          serverTimestamp()

      }

    );

  } catch (error) {

    console.error(
      "Decline call error:",
      error
    );

  }


  const box =
    document.getElementById(
      "incomingCallBox"
    );


  if (box) {

    box.style.display =
      "none";

  }


  currentCallId =
    null;

}


// ==============================
// END CALL
// ==============================

async function endCall() {

  const callId =
    currentCallId;


  try {

    if (callId) {

      await updateDoc(

        doc(
          db,
          "calls",
          callId
        ),

        {

          status:
            "ended",

          endedAt:
            serverTimestamp()

        }

      );

    }

  } catch (error) {

    console.error(
      "End call Firebase error:",
      error
    );

  }


  await cleanupCall(
    false
  );

}


// ==============================
// CLEANUP
// ==============================

async function cleanupCall(
  updateFirebase
) {

  removeCandidateListeners();

  stopLocalStream();

  closePeerConnection();

  stopCallTimer();


  const box =
    document.getElementById(
      "incomingCallBox"
    );


  if (box) {

    box.style.display =
      "none";

  }


  hideCallScreen();


  const remoteAudio =
    document.getElementById(
      "remoteAudio"
    );


  if (remoteAudio) {

    remoteAudio.srcObject =
      null;

  }


  const localAudio =
    document.getElementById(
      "localAudio"
    );


  if (localAudio) {

    localAudio.srcObject =
      null;

  }


  isMuted = false;


  const muteBtn =
    document.getElementById(
      "muteBtn"
    );


  if (muteBtn) {

    muteBtn.textContent =
      "🎤 Mute";

  }


  setCallStatus(
    updateFirebase
      ? "Call ended"
      : ""
  );


  currentCallId =
    null;

  currentCallType =
    null;

}


// ==============================
// MUTE BUTTON
// ==============================

const muteBtn =
  document.getElementById(
    "muteBtn"
  );


if (muteBtn) {

  muteBtn.addEventListener(
    "click",
    () => {

      if (!localStream) return;


      isMuted =
        !isMuted;


      localStream
        .getAudioTracks()
        .forEach(track => {

          track.enabled =
            !isMuted;

        });


      muteBtn.textContent =
        isMuted
          ? "🔇 Unmute"
          : "🎤 Mute";

    }
  );

}

// ==============================
// CALL BUTTONS
// ==============================

document.addEventListener("click", (event) => {

  // ============================
  // VOICE CALL
  // ============================

  const voiceButton =
    event.target.closest("#voiceCallBtn");

  if (voiceButton) {

    console.log("📞 Voice call button clicked");

    const friendId =
      getSelectedFriendId();

    console.log(
      "Selected friend ID:",
      friendId
    );

    if (!friendId) {

      alert("Please select a friend first.");

      return;

    }

    startCall("voice");

    return;

  }


  // ============================
  // VIDEO CALL
  // ============================

  const videoButton =
    event.target.closest("#videoCallBtn");

  if (videoButton) {

    console.log("📹 Video call button clicked");

    const friendId =
      getSelectedFriendId();

    console.log(
      "Selected friend ID:",
      friendId
    );

    if (!friendId) {

      alert("Please select a friend first.");

      return;

    }

    startCall("video");

    return;

  }

});


// ==============================
// ACCEPT BUTTON
// ==============================

const acceptCallBtn =
  document.getElementById(
    "acceptCallBtn"
  );


if (acceptCallBtn) {

  acceptCallBtn.addEventListener(
    "click",
    () => {

      acceptCall();

    }
  );

}


// ==============================
// DECLINE BUTTON
// ==============================

const declineCallBtn =
  document.getElementById(
    "declineCallBtn"
  );


if (declineCallBtn) {

  declineCallBtn.addEventListener(
    "click",
    () => {

      declineCall();

    }
  );

}


// ==============================
// HANG UP BUTTON
// ==============================

const hangUpBtn =
  document.getElementById(
    "hangUpBtn"
  );


if (hangUpBtn) {

  hangUpBtn.addEventListener(
    "click",
    () => {

      endCall();

    }
  );

}


// ==============================
// CALL SCREEN HANG UP
// ==============================

const callHangUpBtn =
  document.getElementById(
    "callHangUpBtn"
  );


if (callHangUpBtn) {

  callHangUpBtn.addEventListener(
    "click",
    () => {

      endCall();

    }
  );

}


// ==============================
// AUTH STATE
// ==============================

onAuthStateChanged(
  auth,
  user => {

    if (!user) {

      currentUserReady =
        false;

      return;

    }


    currentUserReady =
      true;


    console.log(
      "Calls.js ready for:",
      user.uid
    );


    startIncomingCallListener();

  }
);


// ==============================
// EXPORT FOR DEBUGGING
// ==============================

window.endFriendZoneCall =
  endCall;


console.log(
  "✅ Calls.js loaded successfully"
);