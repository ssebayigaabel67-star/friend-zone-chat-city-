// ==========================================
// FRIENDSZONE LIVE ROOM
// ==========================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  where,
  deleteDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ==========================================
// FIREBASE CONFIG
// ==========================================

const firebaseConfig = {

  apiKey:
    "AIzaSyAxVyuHiNb-NEeXLfMfaq0RS9ERfahORt4",

  authDomain:
    "friend-zone-chat-city.firebaseapp.com",

  projectId:
    "friend-zone-chat-city",

  storageBucket:
    "friend-zone-chat-city.firebasestorage.app",

  messagingSenderId:
    "1077723243409",

  appId:
    "1:1077723243409:web:f030fdcd210f0326d93030",

  measurementId:
    "G-3RD3QLSF3F"

};


// ==========================================
// INITIALIZE FIREBASE
// ==========================================

const app =
  initializeApp(firebaseConfig);

const auth =
  getAuth(app);

const db =
  getFirestore(app);


// ==========================================
// ELEMENTS
// ==========================================

const messages =
  document.getElementById("messages");

const messageInput =
  document.getElementById("messageInput");

const sendBtn =
  document.getElementById("sendBtn");

const onlineUsers =
  document.getElementById("onlineUsers");

const onlineCount =
  document.getElementById("onlineCount");
const onlineCountText =
  document.getElementById(
    "onlineCountText"
  );

const onlinePopover =
  document.getElementById(
    "onlinePopover"
  );

const closeOnlinePopover =
  document.getElementById(
    "closeOnlinePopover"
  );
const backBtn =
  document.getElementById("backBtn");

// ==============================
// 🤖 FRIENDSZONE AI
// ==============================

const FRIENDSZONE_AI = {
  id: "friendszone_ai",
  name: "FriendsZone AI",
  username: "friendszoneai",
  photoURL: "🤖"
};
// ==============================
// 🤖 AI CALL DETECTOR
// ==============================

function isCallingAI(text) {

  if (!text) {
    return false;
  }

  const message = text
    .trim()
    .toLowerCase();

  return (
    message.startsWith("ai ") ||
    message.startsWith("ai,") ||
    message.startsWith("ai?") ||
    message.startsWith("ai!") ||
    message.startsWith("hi ai") ||
    message.startsWith("hey ai") ||
    message.startsWith("@ai")
  );
}
// ==========================================
// IMAGE ELEMENTS
// ==========================================

const imageInput =
  document.getElementById("imageInput");

const imageBtn =
  document.getElementById("imageBtn");


// ==========================================
// REPLY ELEMENTS
// ==========================================

const replyPreview =
  document.getElementById("replyPreview");

const replyPreviewName =
  document.getElementById("replyPreviewName");

const replyPreviewText =
  document.getElementById("replyPreviewText");

const cancelReplyBtn =
  document.getElementById("cancelReplyBtn");


// ==========================================
// CURRENT USER
// ==========================================

let currentUser = null;


// ==========================================
// CURRENT USER PROFILE
// ==========================================

let currentUserProfile = {

  name: "User",

  username: "",

  photoURL: ""

};


// ==========================================
// CURRENT REPLY
// ==========================================

let replyingTo = null;


// ==========================================
// AUTH + LOAD PROFILE + ONLINE STATUS
// ==========================================

onAuthStateChanged(
  auth,
  async (user) => {

    // ----------------------------------------
    // NO USER
    // ----------------------------------------

    if (!user) {

      alert(
        "Please sign in first."
      );

      window.location.href =
        "index.html";

      return;

    }


    // ----------------------------------------
    // SAVE CURRENT USER
    // ----------------------------------------

    currentUser = user;


    console.log(
      "Live Room user:",
      user.uid
    );


    // ----------------------------------------
    // USER FIRESTORE DOCUMENT
    // ----------------------------------------

    const userRef =
      doc(
        db,
        "users",
        user.uid
      );


    try {

      // --------------------------------------
      // LOAD PROFILE
      // --------------------------------------

      const userSnap =
        await getDoc(userRef);


      if (userSnap.exists()) {

        const userData =
          userSnap.data();


        currentUserProfile.name =
          userData.name ||
          userData.username ||
          user.displayName ||
          "User";


        currentUserProfile.username =
          userData.username ||
          "";


        currentUserProfile.photoURL =
          userData.photoURL ||
          userData.profilePicture ||
          userData.photo ||
          "";


        console.log(
          "Live Room profile loaded:",
          currentUserProfile
        );

      } else {

        currentUserProfile.name =
          user.displayName ||
          "User";

        currentUserProfile.username =
          "";

        currentUserProfile.photoURL =
          user.photoURL ||
          "";

      }


      // --------------------------------------
      // SET USER ONLINE
      // --------------------------------------

      await updateDoc(
        userRef,
        {

          online:
            true,

          lastSeen:
            serverTimestamp()

        }
      );


      console.log(
        "User marked online in Live Room"
      );


    } catch (error) {

      console.error(
        "Could not load profile/update online status:",
        error
      );

    }

  }
);
// ==========================================
// ONLINE POPOVER
// ==========================================

if (onlineCount) {

  onlineCount.addEventListener(
    "click",
    () => {

      onlinePopover.classList.toggle(
        "show"
      );

    }
  );

}


if (closeOnlinePopover) {

  closeOnlinePopover.addEventListener(
    "click",
    () => {

      onlinePopover.classList.remove(
        "show"
      );

    }
  );

}


// Close when clicking outside

document.addEventListener(
  "click",
  (event) => {

    if (
      onlinePopover &&
      onlineCount &&
      !onlinePopover.contains(event.target) &&
      !onlineCount.contains(event.target)
    ) {

      onlinePopover.classList.remove(
        "show"
      );

    }

  }
);

// ==========================================
// LOAD ONLINE USERS
// ==========================================

const onlineUsersQuery =
  query(

    collection(
      db,
      "users"
    ),

    where(
      "online",
      "==",
      true
    )

  );


onSnapshot(

  onlineUsersQuery,

  (snapshot) => {

    onlineUsers.innerHTML =
      "";

    onlineCount.textContent =
      `${snapshot.size} online`;


    if (snapshot.empty) {

      onlineUsers.innerHTML = `
        <p class="empty-text">
          No one is online yet.
        </p>
      `;

      return;

    }


    snapshot.forEach(
      (userDoc) => {

        const user =
          userDoc.data();


        // --------------------------------------
        // USER CONTAINER
        // --------------------------------------

        const userElement =
          document.createElement(
            "div"
          );

        userElement.className =
          "online-user";


        // --------------------------------------
        // PHOTO
        // --------------------------------------

        const photo =
          document.createElement(
            "img"
          );

        photo.className =
          "online-user-photo";


        photo.src =
          user.photoURL ||
          user.profilePicture ||
          user.photo ||
          "https://via.placeholder.com/48";


        photo.alt =
          user.name ||
          user.username ||
          "User";


        // --------------------------------------
        // NAME
        // --------------------------------------

        const name =
          document.createElement(
            "span"
          );

        name.className =
          "online-user-name";


        name.textContent =
          user.name ||
          user.username ||
          "User";


        userElement.appendChild(
          photo
        );

        userElement.appendChild(
          name
        );

        onlineUsers.appendChild(
          userElement
        );

      }
    );

  },

  (error) => {

    console.error(
      "Online users error:",
      error
    );

  }

);


// ==========================================
// START REPLY
// ==========================================

function startReply(
  messageData,
  messageId
) {

  replyingTo = {

    id:
      messageId,

    senderId:
      messageData.senderId ||
      "",

    senderName:
      messageData.senderName ||
      messageData.username ||
      "User",

    text:
      messageData.text ||
      (
        messageData.imageURL
          ? "📸 Image"
          : ""
      )

  };


  replyPreviewName.textContent =
    "Replying to " +
    replyingTo.senderName;


  replyPreviewText.textContent =
    replyingTo.text;


  replyPreview.style.display =
    "flex";


  messageInput.focus();

}


// ==========================================
// CANCEL REPLY
// ==========================================

function cancelReply() {

  replyingTo =
    null;


  replyPreview.style.display =
    "none";


  replyPreviewName.textContent =
    "Replying to";


  replyPreviewText.textContent =
    "";

}


// ==========================================
// CANCEL REPLY BUTTON
// ==========================================

if (cancelReplyBtn) {

  cancelReplyBtn.addEventListener(
    "click",
    cancelReply
  );

}


// ==========================================
// COMPRESS IMAGE
// ==========================================

function compressImage(file) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();


      reader.onload =
        (event) => {

          const img =
            new Image();


          img.onload =
            () => {

              const canvas =
                document.createElement(
                  "canvas"
                );


              const maxWidth =
                800;

              const maxHeight =
                800;


              let width =
                img.width;

              let height =
                img.height;


              if (
                width > maxWidth ||
                height > maxHeight
              ) {

                const ratio =
                  Math.min(
                    maxWidth / width,
                    maxHeight / height
                  );


                width =
                  Math.round(
                    width * ratio
                  );


                height =
                  Math.round(
                    height * ratio
                  );

              }


              canvas.width =
                width;

              canvas.height =
                height;


              const ctx =
                canvas.getContext(
                  "2d"
                );


              ctx.drawImage(
                img,
                0,
                0,
                width,
                height
              );


              const compressed =
                canvas.toDataURL(
                  "image/jpeg",
                  0.7
                );


              resolve(
                compressed
              );

            };


          img.onerror =
            reject;


          img.src =
            event.target.result;

        };


      reader.onerror =
        reject;


      reader.readAsDataURL(
        file
      );

    }
  );

}
// ==========================================
// SEND MESSAGE
// ==========================================
async function sendMessage() {

  if (!currentUser) {

    alert(
      "Please wait for your account to load."
    );

    return;

  }


  const text =
    messageInput.value.trim();


  if (!text) {

    return;

  }


  try {

    // ----------------------------------------
    // SEND USER MESSAGE
    // ----------------------------------------

    await addDoc(

      collection(
        db,
        "liveRoom",
        "messages",
        "messages"
      ),

      {

        senderId:
          currentUser.uid,

        senderName:
          currentUserProfile.name,

        username:
          currentUserProfile.username,

        photoURL:
          currentUserProfile.photoURL,

        text:
          text,

        timestamp:
          serverTimestamp(),

        replyTo:
          replyingTo
            ? {

                id:
                  replyingTo.id,

                senderName:
                  replyingTo.senderName,

                text:
                  replyingTo.text

              }
            : null

      }

    );


    // ----------------------------------------
    // 🤖 CHECK IF USER CALLED AI
    // ----------------------------------------

    if (isCallingAI(text)) {

      // --------------------------------------
      // REMOVE AI NAME FROM QUESTION
      // --------------------------------------

      const aiQuestion =
        text
          .replace(/^@ai[\s,:!?-]*/i, "")
          .replace(/^hi ai[\s,:!?-]*/i, "")
          .replace(/^hey ai[\s,:!?-]*/i, "")
          .replace(/^ai[\s,:!?-]*/i, "")
          .trim();


      // --------------------------------------
      // IF USER ONLY SAYS "HI AI"
      // --------------------------------------

      const finalQuestion =
        aiQuestion ||
        "Say hello to the user and ask how you can help.";


      // --------------------------------------
      // 🤖 CALL FRIENDSZONE AI API
      // --------------------------------------

      const response =
        await fetch(
          "/api/ask-ai",
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${await currentUser.getIdToken()}`

            },

            body:
              JSON.stringify({

                question:
                  finalQuestion

              })

          }
        );


      // --------------------------------------
      // READ API RESPONSE
      // --------------------------------------

      const data =
        await response.json();


      // --------------------------------------
      // CHECK AI ERROR
      // --------------------------------------

      if (!response.ok || !data.success) {

        console.error(
          "FriendsZone AI error:",
          data
        );

        throw new Error(
          data.error ||
          "FriendsZone AI could not respond."
        );

      }

      // --------------------------------------
      // AI MESSAGE IS ALREADY SAVED
      // BY /api/ask-ai
      // --------------------------------------
      
    }


    // ----------------------------------------
    // CLEAR INPUT
    // ----------------------------------------

    messageInput.value =
      "";


    // ----------------------------------------
    // CLEAR REPLY
    // ----------------------------------------

    cancelReply();


    messageInput.focus();


  } catch (error) {

    console.error(
      "Send message error:",
      error
    );

    alert(
      error?.message ||
      "Could not send the message."
    );

  }

}
// ==========================================
// SEND IMAGE
// ==========================================

async function sendImage(file) {

  if (!currentUser) {

    alert(
      "Please wait for your account to load."
    );

    return;

  }


  if (!file) {

    return;

  }


  // ----------------------------------------
  // CHECK IMAGE
  // ----------------------------------------

  if (
    !file.type.startsWith(
      "image/"
    )
  ) {

    alert(
      "Please select an image."
    );

    return;

  }


  try {

    console.log(
      "Compressing image..."
    );


    const imageData =
      await compressImage(
        file
      );


    // ----------------------------------------
    // CHECK IMAGE SIZE
    // ----------------------------------------

    const imageSize =
      imageData.length;


    if (
      imageSize > 700000
    ) {

      alert(
        "This image is too large. Please choose a smaller image."
      );

      return;

    }


    // ----------------------------------------
    // SAVE IMAGE
    // ----------------------------------------

    await addDoc(

      collection(

        db,

        "liveRoom",

        "messages",

        "messages"

      ),

      {

        senderId:
          currentUser.uid,

        senderName:
          currentUserProfile.name,

        username:
          currentUserProfile.username,

        photoURL:
          currentUserProfile.photoURL,

        imageURL:
          imageData,

        text:
          "",

        timestamp:
          serverTimestamp(),

        replyTo:
          replyingTo
            ? {

                id:
                  replyingTo.id,

                senderName:
                  replyingTo.senderName,

                text:
                  replyingTo.text

              }
            : null

      }

    );


    // ----------------------------------------
    // CLEAR REPLY
    // ----------------------------------------

    cancelReply();


    console.log(
      "Image sent successfully"
    );


  } catch (error) {

    console.error(
      "Send image error:",
      error
    );

    alert(
      "Could not send the image."
    );

  }

}


// ==========================================
// IMAGE BUTTON
// ==========================================

if (imageBtn) {

  imageBtn.addEventListener(
    "click",
    () => {

      imageInput.click();

    }
  );

}


// ==========================================
// IMAGE SELECTED
// ==========================================

if (imageInput) {

  imageInput.addEventListener(
    "change",
    async () => {

      const file =
        imageInput.files[0];


      if (!file) {

        return;

      }


      await sendImage(
        file
      );


      imageInput.value =
        "";

    }
  );

}


// ==========================================
// SEND BUTTON
// ==========================================

sendBtn.addEventListener(
  "click",
  sendMessage
);


// ==========================================
// ENTER TO SEND
// ==========================================

messageInput.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Enter"
    ) {

      event.preventDefault();

      sendMessage();

    }

  }
);


// ==========================================
// LOAD LIVE MESSAGES
// ==========================================

const messagesQuery =
  query(

    collection(

      db,

      "liveRoom",

      "messages",

      "messages"

    ),

    orderBy(
      "timestamp",
      "asc"
    )

  );


onSnapshot(

  messagesQuery,

  (snapshot) => {

    messages.innerHTML =
      "";


    snapshot.forEach(
      (messageDoc) => {

        const data =
          messageDoc.data();


        // ======================================
        // MESSAGE CONTAINER
        // ======================================

        const message =
          document.createElement(
            "div"
          );

        message.className =
          "public-message";


        // ======================================
        // PROFILE IMAGE
        // ======================================

        const avatar =
          document.createElement(
            "img"
          );

        avatar.className =
          "public-message-avatar";


        avatar.src =
          data.photoURL ||
          data.profilePicture ||
          data.photo ||
          "https://via.placeholder.com/36";


        avatar.alt =
          data.senderName ||
          data.username ||
          "User";


        // ======================================
        // CONTENT
        // ======================================

        const content =
          document.createElement(
            "div"
          );

        content.className =
          "public-message-content";


        // ======================================
        // NAME
        // ======================================

        const name =
          document.createElement(
            "div"
          );

        name.className =
          "public-message-name";


        name.textContent =
          data.senderName ||
          data.username ||
          "User";


        content.appendChild(
          name
        );


        // ======================================
        // USERNAME
        // ======================================

        if (
          data.username &&
          data.username !==
            data.senderName
        ) {

          const username =
            document.createElement(
              "div"
            );

          username.style.fontSize =
            "10px";

          username.style.color =
            "#888";

          username.style.marginBottom =
            "3px";

          username.textContent =
            "@" +
            data.username;


          content.appendChild(
            username
          );

        }


        // ======================================
        // REPLIED MESSAGE
        // ======================================

        if (
          data.replyTo
        ) {

          const repliedMessage =
            document.createElement(
              "div"
            );


          repliedMessage.style.background =
            "rgba(0,0,0,0.06)";


          repliedMessage.style.borderLeft =
            "3px solid #777";


          repliedMessage.style.borderRadius =
            "6px";


          repliedMessage.style.padding =
            "6px 8px";


          repliedMessage.style.marginBottom =
            "6px";


          repliedMessage.style.fontSize =
            "11px";


          const repliedName =
            document.createElement(
              "strong"
            );


          repliedName.textContent =
            data.replyTo.senderName ||
            "User";


          const repliedText =
            document.createElement(
              "div"
            );


          repliedText.textContent =
            data.replyTo.text ||
            "📸 Image";


          repliedMessage.appendChild(
            repliedName
          );


          repliedMessage.appendChild(
            repliedText
          );


          content.appendChild(
            repliedMessage
          );

        }


        // ======================================
        // MESSAGE TEXT
        // ======================================

        if (
          data.text
        ) {

          const text =
            document.createElement(
              "div"
            );

          text.className =
            "public-message-text";


          text.textContent =
            data.text;


          content.appendChild(
            text
          );

        }


        // ======================================
        // IMAGE MESSAGE
        // ======================================

        if (
          data.imageURL
        ) {

          const image =
            document.createElement(
              "img"
            );


          image.src =
            data.imageURL;


          image.alt =
            "Shared image";


          image.style.maxWidth =
            "260px";


          image.style.maxHeight =
            "300px";


          image.style.width =
            "auto";


          image.style.height =
            "auto";


          image.style.display =
            "block";


          image.style.borderRadius =
            "12px";


          image.style.objectFit =
            "cover";


          image.style.cursor =
            "pointer";


          image.addEventListener(
            "click",
            () => {

              window.open(
                data.imageURL,
                "_blank"
              );

            }
          );


          content.appendChild(
            image
          );

        }


        // ======================================
        // TIME
        // ======================================

        const time =
          document.createElement(
            "div"
          );

        time.className =
          "public-message-time";


        if (
          data.timestamp
        ) {

          const date =
            data.timestamp.toDate();


          time.textContent =
            date.toLocaleTimeString(
              [],
              {

                hour:
                  "2-digit",

                minute:
                  "2-digit"

              }
            );

        }


        content.appendChild(
          time
        );


        // ======================================
        // REPLY BUTTON
        // ======================================

        const replyBtn =
          document.createElement(
            "button"
          );


        replyBtn.type =
          "button";


        replyBtn.textContent =
          "↩️ Reply";


        replyBtn.style.border =
          "none";


        replyBtn.style.background =
          "transparent";


        replyBtn.style.color =
          "#555";


        replyBtn.style.fontSize =
          "10px";


        replyBtn.style.padding =
          "3px 8px 3px 0";


        replyBtn.style.cursor =
          "pointer";


        replyBtn.addEventListener(
          "click",
          () => {

            startReply(
              data,
              messageDoc.id
            );

          }
        );


        content.appendChild(
          replyBtn
        );


        // ======================================
        // DELETE BUTTON
        // ======================================

        if (
          currentUser &&
          data.senderId ===
            currentUser.uid
        ) {

          const deleteBtn =
            document.createElement(
              "button"
            );


          deleteBtn.type =
            "button";


          deleteBtn.textContent =
            "Delete";


          deleteBtn.style.border =
            "none";


          deleteBtn.style.background =
            "transparent";


          deleteBtn.style.color =
            "#d32f2f";


          deleteBtn.style.fontSize =
            "10px";


          deleteBtn.style.padding =
            "3px 0";


          deleteBtn.style.cursor =
            "pointer";


          deleteBtn.addEventListener(
            "click",
            async () => {

              const confirmed =
                confirm(
                  "Delete this message?"
                );


              if (!confirmed) {

                return;

              }


              try {

                await deleteDoc(

                  doc(

                    db,

                    "liveRoom",

                    "messages",

                    "messages",

                    messageDoc.id

                  )

                );


                console.log(
                  "Message deleted:",
                  messageDoc.id
                );


              } catch (error) {

                console.error(
                  "Delete message error:",
                  error
                );


                alert(
                  "Could not delete the message."
                );

              }

            }
          );


          content.appendChild(
            deleteBtn
          );

        }


        // ======================================
        // ADD AVATAR
        // ======================================

        message.appendChild(
          avatar
        );


        // ======================================
        // ADD CONTENT
        // ======================================

        message.appendChild(
          content
        );


        // ======================================
        // ADD TO SCREEN
        // ======================================

        messages.appendChild(
          message
        );

      }
    );


    // ========================================
    // SCROLL TO BOTTOM
    // ========================================

    messages.scrollTop =
      messages.scrollHeight;

  },


  (error) => {

    console.error(
      "Message loading error:",
      error
    );

  }

);


// ==========================================
// BACK BUTTON
// ==========================================

backBtn.addEventListener(
  "click",
  () => {

    window.history.back();

  }
);