// ======================
// FIREBASE IMPORTS
// ======================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ======================
// FIREBASE CONFIG
// ======================

const firebaseConfig = {

  apiKey: "AIzaSyAxVyuHiNb-NEeXLfMfaq0RS9ERfahORt",
  authDomain: "friend-zone-chat-city.firebaseapp.com",
  projectId: "friend-zone-chat-city",
  storageBucket: "friend-zone-chat-city.firebasestorage.app",
  messagingSenderId: "1077723243409",
  appId: "1:1077723243409:web:f030fdcd210f0326d93030"

};


// ======================
// INITIALIZE FIREBASE
// ======================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


// ======================
// WEBRTC CONFIG
// ======================

const rtcConfig = {

  iceServers: [

    {
      urls: "stun:stun.l.google.com:19302"
    }

  ]

};


// ======================
// GLOBAL VARIABLES
// ======================

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let currentCallId = null;

let callSeconds = 0;

let callTimer = null;

let isMuted = false;



// ======================
// CALL TIMER
// ======================

function startCallTimer(){

  stopCallTimer();

  callTimer = setInterval(()=>{

    callSeconds++;

    const minutes = Math.floor(callSeconds / 60);

    const seconds = callSeconds % 60;


    const timer =
    document.getElementById("callTimer");


    if(timer){

      timer.textContent =
      `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;

    }


  },1000);

}



function stopCallTimer(){

  clearInterval(callTimer);

  callTimer = null;

  callSeconds = 0;


  const timer =
  document.getElementById("callTimer");


  if(timer){

    timer.textContent="00:00";

  }

}



// ======================
// CREATE PEER CONNECTION
// ======================

async function createPeerConnection(){


  peerConnection =
  new RTCPeerConnection(rtcConfig);



  remoteStream =
  new MediaStream();



  const remoteAudio =
  document.getElementById("remoteAudio");


  if(remoteAudio){

    remoteAudio.srcObject = remoteStream;

  }



  peerConnection.ontrack = (event)=>{


    event.streams[0]
    .getTracks()
    .forEach(track=>{

      remoteStream.addTrack(track);

    });


  };



  if(localStream){


    localStream
    .getTracks()
    .forEach(track=>{

      peerConnection.addTrack(
        track,
        localStream
      );


    });


  }



  peerConnection.onconnectionstatechange = ()=>{


    console.log(
      "Connection:",
      peerConnection.connectionState
    );


    if(
      peerConnection.connectionState === "connected"
    ){

      const status =
      document.getElementById("callStatus");


      if(status){

        status.textContent="Connected";

      }


      startCallTimer();

    }


  };



  return peerConnection;

}


// ======================
// MUTE BUTTON
// ======================

const muteBtn =
document.getElementById("muteBtn");


if(muteBtn){


muteBtn.addEventListener("click",()=>{


  if(!localStream) return;


  isMuted = !isMuted;


  localStream
  .getAudioTracks()
  .forEach(track=>{

    track.enabled = !isMuted;

  });



  muteBtn.textContent =
  isMuted ? "🔇 Unmute" : "🎤 Mute";


});


}
// ======================
// START VOICE CALL
// ======================

const voiceCallBtn =
document.getElementById("voiceCallBtn");


if(voiceCallBtn){


voiceCallBtn.addEventListener("click", async()=>{


if(!window.selectedFriendId){

alert("Select a friend first.");

return;

}



try{


localStream =
await navigator.mediaDevices.getUserMedia({

audio:{
echoCancellation:true,
noiseSuppression:true
}

});



const callRef =
doc(collection(db,"calls"));



currentCallId =
callRef.id;



const offerCandidates =
collection(callRef,"offerCandidates");

const answerCandidates =
collection(callRef,"answerCandidates");



await createPeerConnection();



peerConnection.onicecandidate =
async(event)=>{


if(event.candidate){


await addDoc(
offerCandidates,
event.candidate.toJSON()
);


}


};




const offer =
await peerConnection.createOffer();



await peerConnection.setLocalDescription(
offer
);



await setDoc(callRef,{


caller:auth.currentUser.uid,

receiver:window.selectedFriendId,


offer:{

type:offer.type,

sdp:offer.sdp

},


status:"ringing",


createdAt:serverTimestamp()


});



const callScreen =
document.getElementById("callScreen");


if(callScreen){

callScreen.style.display="block";

}



const status =
document.getElementById("callStatus");


if(status){

status.textContent="Calling...";

}



}
catch(error){


console.error(error);


alert(
"Microphone permission failed"
);


}


});


}



// ======================
// LISTEN FOR INCOMING CALLS
// ======================


onSnapshot(
collection(db,"calls"),
(snapshot)=>{


snapshot.docChanges()
.forEach(change=>{


if(change.type !== "added")
return;



const call =
change.doc.data();



if(

auth.currentUser &&

call.receiver === auth.currentUser.uid &&

call.status === "ringing"

){



currentCallId =
change.doc.id;



const box =
document.getElementById("incomingCallBox");



const name =
document.getElementById("callerName");



if(name){

name.textContent =
"📞 Incoming call...";

}



if(box){

box.style.display="block";

}



}



});


});



// ======================
// ACCEPT CALL
// ======================


const acceptCallBtn =
document.getElementById("acceptCallBtn");



if(acceptCallBtn){


acceptCallBtn.addEventListener(
"click",
async()=>{


document
.getElementById("incomingCallBox")
.style.display="none";



const callRef =
doc(db,"calls",currentCallId);



const callSnap =
await getDoc(callRef);



const callData =
callSnap.data();



const answerCandidates =
collection(
callRef,
"answerCandidates"
);



localStream =
await navigator.mediaDevices.getUserMedia({

audio:{
echoCancellation:true,
noiseSuppression:true
}

});



await createPeerConnection();



peerConnection.onicecandidate =
async(event)=>{


if(event.candidate){


await addDoc(

answerCandidates,

event.candidate.toJSON()

);


}


};




await peerConnection.setRemoteDescription(

new RTCSessionDescription(
callData.offer
)

);
listenForOfferCandidates(currentCallId);


const answer =
await peerConnection.createAnswer();



await peerConnection.setLocalDescription(
answer
);



await updateDoc(callRef,{


answer:{


type:answer.type,

sdp:answer.sdp


},


status:"connected"


});



const callScreen =
document.getElementById("callScreen");

if(callScreen){

callScreen.style.display="block";

}



});


}




// ======================
// DECLINE CALL
// ======================


const declineCallBtn =
document.getElementById("declineCallBtn");



if(declineCallBtn){


declineCallBtn.addEventListener(
"click",
async()=>{


const callRef =
doc(db,"calls",currentCallId);



await updateDoc(callRef,{

status:"declined"

});



document
.getElementById("incomingCallBox")
.style.display="none";


});


}
// ======================
// LISTEN FOR ANSWER
// (CALLER SIDE)
// ======================

onSnapshot(
collection(db,"calls"),
(snapshot)=>{


snapshot.docChanges()
.forEach(async(change)=>{


const call =
change.doc.data();



if(

auth.currentUser &&

call.caller === auth.currentUser.uid &&

call.answer &&

peerConnection &&

!peerConnection.currentRemoteDescription

){



await peerConnection.setRemoteDescription(

new RTCSessionDescription(
call.answer
)

);



const callRef =
doc(db,"calls",change.doc.id);



const answerCandidates =
collection(
callRef,
"answerCandidates"
);



onSnapshot(
answerCandidates,
(candidateSnapshot)=>{


candidateSnapshot.docChanges()
.forEach(async(candidateChange)=>{


if(candidateChange.type==="added"){


const candidate =
new RTCIceCandidate(
candidateChange.doc.data()
);



await peerConnection.addIceCandidate(
candidate
);



}


});


});


}



});


});




// ======================
// LISTEN FOR CALLER ICE
// (RECEIVER SIDE)
// ======================


function listenForOfferCandidates(callId){


const callRef =
doc(db,"calls",callId);



const offerCandidates =
collection(
callRef,
"offerCandidates"
);



onSnapshot(
offerCandidates,
(snapshot)=>{


snapshot.docChanges()
.forEach(async(change)=>{


if(change.type==="added"){


const candidate =
new RTCIceCandidate(
change.doc.data()
);



await peerConnection.addIceCandidate(
candidate
);



}


});


});


}



// ======================
// HANG UP
// ======================


async function endCall(){


try{


if(currentCallId){


const callRef =
doc(db,"calls",currentCallId);



await updateDoc(callRef,{

status:"ended",

endedAt:serverTimestamp()

});


}



if(localStream){


localStream
.getTracks()
.forEach(track=>{

track.stop();

});


}



if(peerConnection){


peerConnection.close();

peerConnection=null;


}



stopCallTimer();



localStream=null;

remoteStream=null;



const screen =
document.getElementById("callScreen");


if(screen){

screen.style.display="none";

}



const status =
document.getElementById("callStatus");


if(status){

status.textContent="Call ended";

}



}
catch(error){


console.error(
"End call error:",
error
);


}



}



// ======================
// HANG UP BUTTON
// ======================


const hangUpBtn =
document.getElementById("hangUpBtn");



if(hangUpBtn){


hangUpBtn.addEventListener(
"click",
()=>{


endCall();


});


}




// ======================
// OTHER USER ENDED CALL
// ======================


onSnapshot(
collection(db,"calls"),
(snapshot)=>{


snapshot.docChanges()
.forEach(change=>{


const call =
change.doc.data();



if(

auth.currentUser &&

call.status==="ended" &&

(

call.caller===auth.currentUser.uid ||

call.receiver===auth.currentUser.uid

)

){


endCall();


}



});


});