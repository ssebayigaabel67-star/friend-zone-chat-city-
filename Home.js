// ======================
// FIREBASE IMPORTS
// ======================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";


// ======================
// FIREBASE CONFIG
// ======================

const firebaseConfig = {
  apiKey: "AIzaSyAxVyuHiNb-NEeXLfMfaq0RS9ERfahORt4",
  appId: "1:1077723243409:web:f030fdcd210f0326d93030",
  authDomain: "friend-zone-chat-city.firebaseapp.com",
  projectId: "friend-zone-chat-city",
  storageBucket: "friend-zone-chat-city.firebasestorage.app",
  messagingSenderId: "1077723243409",
  measurementId: "G-3RD3QLSF3F"
};


// ======================
// INITIALIZE FIREBASE
// ======================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const storage = getStorage(app);


// ======================
// GLOBAL VARIABLES
// ======================

let typingTimeout;

let unreadCounts = {};

let lastMessageId = "";

let currentUserName = "";

let selectedFriendId = "";

let selectedGroupId = "";

let currentGroupAdmin = "";

let unsubscribeMessages = null;

let unsubscribeTyping = null;

let isGroupChat = false;

let replyingTo = null;


// ======================
// VOICE RECORDING
// ======================

let mediaRecorder = null;

let audioChunks = [];


// ======================
// NOTIFICATION SOUND
// ======================

const notificationSound =
  document.getElementById("notificationSound");


// ======================
// HELPER FUNCTION
// ======================

function getChatId(uid1, uid2) {

  return [uid1, uid2]
    .sort()
    .join("_");

}


// ======================
// ESCAPE HTML
// ======================

function escapeHTML(text) {

  if (text === undefined || text === null) {
    return "";
  }

  const div = document.createElement("div");

  div.textContent = String(text);

  return div.innerHTML;

}


// ======================
// LOAD FRIENDS
// ======================

async function loadFriends() {

  const list =
    document.getElementById("friendsList");

  if (!list || !auth.currentUser) return;

  list.innerHTML = "";

  try {

    const snapshot =
      await getDocs(
        collection(db, "users")
      );

    snapshot.forEach((userDoc) => {

      if (
        userDoc.id ===
        auth.currentUser.uid
      ) {
        return;
      }

      const friend =
        userDoc.data();

      const div =
        document.createElement("div");

      div.className = "friend";


      if (
        selectedFriendId ===
        userDoc.id
      ) {

        div.classList.add("active");

      }


      div.innerHTML = `

        <img
          src="${
            friend.photoURL ||
            "https://via.placeholder.com/45"
          }"
        >

        <span style="flex:1;">

          ${escapeHTML(
            friend.name ||
            friend.email ||
            "User"
          )}

          ${
            friend.online
              ? " 🟢"
              : " ⚫"
          }

        </span>

        ${
          unreadCounts[userDoc.id] > 0
            ? `

              <span style="
                background:red;
                color:white;
                border-radius:50%;
                min-width:22px;
                height:22px;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:12px;
                font-weight:bold;
              ">

                ${unreadCounts[userDoc.id]}

              </span>

            `
            : ""
        }

      `;


      div.addEventListener(
        "click",
        () => {

          selectedFriendId =
            userDoc.id;

          window.selectedFriendId =
            selectedFriendId;

          selectedGroupId = "";

          isGroupChat = false;

          unreadCounts[userDoc.id] = 0;


          document
            .querySelectorAll(".friend")
            .forEach(item => {

              item.classList.remove(
                "active"
              );

            });


          div.classList.add("active");


          const title =
            document.querySelector(
              ".header h3"
            );


          if (title) {

            title.textContent =
              friend.name ||
              friend.email ||
              "Friend";

          }


          loadMessages();

        }
      );


      list.appendChild(div);

    });

  } catch (error) {

    console.error(
      "Load friends error:",
      error
    );

  }

}


// ======================
// LOGIN CHECK
// ======================

onAuthStateChanged(
  auth,
  async (user) => {

    try {

      console.log(
        "Checking login..."
      );

      console.log(
        "User:",
        user
      );


      if (!user) {

        console.log(
          "No user logged in"
        );

        return;

      }


      console.log(
        "Logged in:",
        user.uid
      );


      const userRef =
        doc(
          db,
          "users",
          user.uid
        );


      const userSnap =
        await getDoc(userRef);


      await setDoc(
        userRef,
        {
          online: true,
          lastSeen:
            serverTimestamp()
        },
        {
          merge: true
        }
      );


      if (userSnap.exists()) {

        const data =
          userSnap.data();

        currentUserName =
          data.name ||
          user.email;

      } else {

        currentUserName =
          user.email;

      }


      const username =
        document.getElementById(
          "username"
        );


      if (username) {

        username.textContent =
          currentUserName;

      }


      if (
        userSnap.exists() &&
        userSnap.data().photoURL
      ) {

        const profilePic =
          document.getElementById(
            "profilePic"
          );


        if (profilePic) {

          profilePic.src =
            userSnap.data().photoURL;

        }

      }


      await loadFriends();

      await loadGroups();

      await loadFriendSelector();


      console.log(
        "Homepage loaded successfully"
      );


    } catch (error) {

      console.error(
        "HOME ERROR:",
        error
      );

      alert(error.message);

    }

  }
);


// ======================
// MESSAGE INPUT
// ======================

const messageInput =
  document.getElementById(
    "messageInput"
  );

const sendBtn =
  document.getElementById(
    "sendBtn"
  );


// ======================
// TYPING INDICATOR
// ======================

if (messageInput) {

  messageInput.addEventListener(
    "input",
    async () => {

      if (
        !selectedFriendId ||
        !auth.currentUser
      ) {
        return;
      }


      const chatId =
        getChatId(
          auth.currentUser.uid,
          selectedFriendId
        );


      await setDoc(
        doc(
          db,
          "typing",
          chatId
        ),
        {
          uid:
            auth.currentUser.uid,

          name:
            currentUserName,

          typing: true
        }
      );


      clearTimeout(
        typingTimeout
      );


      typingTimeout =
        setTimeout(
          async () => {

            await setDoc(
              doc(
                db,
                "typing",
                chatId
              ),
              {
                uid:
                  auth.currentUser.uid,

                name:
                  currentUserName,

                typing: false
              }
            );

          },
          1500
        );

    }
  );

}


// ======================
// SEND TEXT MESSAGE
// ======================

if (sendBtn) {

  sendBtn.addEventListener(
    "click",
    async () => {

      const input =
        document.getElementById(
          "messageInput"
        );


      const text =
        input.value.trim();


      if (!text) return;


      try {

        // ======================
        // GROUP MESSAGE
        // ======================

        if (
          isGroupChat &&
          selectedGroupId
        ) {

          await addDoc(
            collection(
              db,
              "groups",
              selectedGroupId,
              "messages"
            ),
            {

              senderId:
                auth.currentUser.uid,

              senderName:
                currentUserName,

              text:
                text,

              timestamp:
                serverTimestamp(),

              read: false,

              replyTo:
                replyingTo
                  ? replyingTo.text
                  : null,

              replyToId:
                replyingTo
                  ? replyingTo.id
                  : null

            }
          );


          input.value = "";

          replyingTo = null;

          input.placeholder =
            "Type your message...";

          return;

        }


        // ======================
        // PRIVATE MESSAGE
        // ======================

        if (!selectedFriendId) {

          alert(
            "Select a friend first."
          );

          return;

        }


        const chatId =
          getChatId(
            auth.currentUser.uid,
            selectedFriendId
          );


        await addDoc(
          collection(
            db,
            "chats",
            chatId,
            "messages"
          ),
          {

            senderId:
              auth.currentUser.uid,

            senderName:
              currentUserName,

            text:
              text,

            timestamp:
              serverTimestamp(),

            read: false,

            replyTo:
              replyingTo
                ? replyingTo.text
                : null,

            replyToId:
              replyingTo
                ? replyingTo.id
                : null

          }
        );


        input.value = "";

        replyingTo = null;

        input.placeholder =
          "Type your message...";


      } catch (error) {

        console.error(
          "Send message error:",
          error
        );

        alert(
          "Failed to send message."
        );

      }

    }
  );

}


// ======================
// LOAD PRIVATE MESSAGES
// ======================

function loadMessages() {

  if (
    !selectedFriendId ||
    !auth.currentUser
  ) {
    return;
  }


  if (unsubscribeMessages) {

    unsubscribeMessages();

    unsubscribeMessages = null;

  }


  if (unsubscribeTyping) {

    unsubscribeTyping();

    unsubscribeTyping = null;

  }


  const chatId =
    getChatId(
      auth.currentUser.uid,
      selectedFriendId
    );


  console.log(
    "Loading chat:",
    chatId
  );


  // ======================
  // TYPING LISTENER
  // ======================

  const typingRef =
    doc(
      db,
      "typing",
      chatId
    );


  unsubscribeTyping =
    onSnapshot(
      typingRef,
      (snap) => {

        const typingStatus =
          document.getElementById(
            "typingStatus"
          );


        if (!typingStatus) return;


        if (!snap.exists()) {

          typingStatus.textContent =
            "";

          return;

        }


        const typing =
          snap.data();


        if (
          typing.uid !==
            auth.currentUser.uid &&
          typing.typing
        ) {

          typingStatus.textContent =
            "✍️ " +
            (
              typing.name ||
              "Someone"
            ) +
            " is typing...";

        } else {

          typingStatus.textContent =
            "";

        }

      }
    );


  // ======================
  // MESSAGES LISTENER
  // ======================

  const messagesRef =
    collection(
      db,
      "chats",
      chatId,
      "messages"
    );


  const q =
    query(
      messagesRef,
      orderBy(
        "timestamp",
        "asc"
      )
    );


  unsubscribeMessages =
    onSnapshot(
      q,
      async (snapshot) => {

        const box =
          document.getElementById(
            "messages"
          );


        if (!box) return;


        box.innerHTML = "";


        for (
          const docSnap of
          snapshot.docs
        ) {

          const data =
            docSnap.data();


          // ======================
          // MARK AS READ
          // ======================

          if (
            data.senderId !==
              auth.currentUser.uid &&
            !data.read
          ) {

            try {

              await updateDoc(
                docSnap.ref,
                {
                  read: true
                }
              );

            } catch (e) {

              console.log(e);

            }

          }


          const div =
            document.createElement(
              "div"
            );


          div.className =
            "message";


          let html = `

            <b>
              ${escapeHTML(
                data.senderName ||
                "Unknown User"
              )}
            </b>

            <br>

          `;


          // ======================
          // REPLY PREVIEW
          // ======================

          if (data.replyTo) {

            html += `

              <div style="
                border-left:3px solid #25D366;
                padding-left:8px;
                margin-bottom:5px;
                font-size:12px;
                color:#666;
              ">

                ↩️
                ${escapeHTML(
                  data.replyTo
                )}

              </div>

            `;

          }


          // ======================
          // TEXT
          // ======================

          if (data.text) {

            html += `

              <div>
                ${escapeHTML(
                  data.text
                )}
              </div>

            `;

          }


          // ======================
          // IMAGE
          // ======================

          if (data.imageURL) {

            html += `

              <img
                src="${data.imageURL}"
                style="
                  max-width:220px;
                  border-radius:10px;
                  margin-top:8px;
                "
              >

            `;

          }


          // ======================
          // AUDIO
          // ======================

          if (data.audioURL) {

            html += `

              <audio
                controls
                style="
                  margin-top:8px;
                  width:220px;
                "
              >

                <source
                  src="${data.audioURL}"
                  type="audio/webm"
                >

                Your browser does not
                support audio.

              </audio>

            `;

          }


          // ======================
          // TIME + READ RECEIPT
          // ======================

          html += `

            <small>

              ${
                data.timestamp
                  ? data.timestamp
                      .toDate()
                      .toLocaleTimeString(
                        [],
                        {
                          hour:
                            "2-digit",

                          minute:
                            "2-digit"
                        }
                      )
                  : ""
              }

              ${
                data.senderId ===
                auth.currentUser.uid
                  ? (
                      data.read
                        ? " ✓✓"
                        : " ✓"
                    )
                  : ""
              }

            </small>

          `;


          // ======================
          // PRIVATE MESSAGE BUTTONS
          // ======================

          html += `

            <div style="
              margin-top:6px;
            ">

              <button
                onclick="replyToMessage(
                  '${docSnap.id}',
                  ${JSON.stringify(
                    data.text || ""
                  )}
                )"
              >
                ↩️ Reply
              </button>

              ${
                data.senderId ===
                auth.currentUser.uid
                  ? `

                    <button
                      onclick="deleteMessage(
                        '${chatId}',
                        '${docSnap.id}'
                      )"
                    >
                      🗑 Delete
                    </button>

                  `
                  : ""
              }

            </div>

          `;


          div.innerHTML =
            html;


          box.appendChild(div);

        }


        box.scrollTop =
          box.scrollHeight;

      },
      (error) => {

        console.error(
          "Load messages error:",
          error
        );

      }
    );

}


// ======================
// LOAD FRIEND SELECTOR
// ======================

async function loadFriendSelector() {

  const select =
    document.getElementById(
      "friendSelect"
    );


  if (!select) return;


  select.innerHTML = "";


  try {

    const users =
      await getDocs(
        collection(db, "users")
      );


    users.forEach(
      (userDoc) => {

        if (
          userDoc.id ===
          auth.currentUser.uid
        ) {
          return;
        }


        const user =
          userDoc.data();


        const option =
          document.createElement(
            "option"
          );


        option.value =
          userDoc.id;


        option.textContent =
          user.name ||
          user.email ||
          "User";


        select.appendChild(
          option
        );

      }
    );


  } catch (error) {

    console.error(
      "Friend selector error:",
      error
    );

  }

}


// ======================
// CREATE GROUP
// ======================

const createGroupBtn =
  document.getElementById(
    "createGroupBtn"
  );


if (createGroupBtn) {

  createGroupBtn.addEventListener(
    "click",
    async () => {

      const groupName =
        document
          .getElementById(
            "groupName"
          )
          .value
          .trim();


      if (!groupName) {

        alert(
          "Enter a group name."
        );

        return;

      }


      // ======================
      // GROUP MEMBERS
      // ======================

      const members = {};


      // The creator is automatically
      // added as a group member.

      members[
        auth.currentUser.uid
      ] = true;


      try {

        const groupRef =
          doc(
            collection(
              db,
              "groups"
            )
          );


        await setDoc(
          groupRef,
          {

            name:
              groupName,

            admin:
              auth.currentUser.uid,

            createdBy:
              auth.currentUser.uid,

            createdAt:
              serverTimestamp(),

            members:
              members

          }
        );


        alert(
          "Group created successfully."
        );


        document
          .getElementById(
            "groupName"
          )
          .value = "";


        await loadGroups();


      } catch (error) {
   console.error(
          "Create group error:",
          error
        );

        alert(
          "Failed to create group."
        );

      }

    }
  );

}


// ======================
// LOAD GROUPS
// ======================

async function loadGroups() {

  const list =
    document.getElementById(
      "groupsList"
    );


  if (!list || !auth.currentUser) {
    return;
  }


  list.innerHTML = "";


  try {

    const snapshot =
      await getDocs(
        collection(db, "groups")
      );


    snapshot.forEach(
      (groupDoc) => {

        const group =
          groupDoc.data();


        if (
          !group.members ||
          !group.members[
            auth.currentUser.uid
          ]
        ) {
          return;
        }


        const div =
          document.createElement(
            "div"
          );


        div.className =
          "friend";


        div.innerHTML = `

          👥
          ${escapeHTML(
            group.name ||
            "Unnamed Group"
          )}

        `;


        div.onclick = () => {

          selectedGroupId =
            groupDoc.id;

          selectedFriendId =
            "";

          window.selectedFriendId =
            "";

          isGroupChat = true;

          currentGroupAdmin =
            group.admin || "";


          const title =
            document.querySelector(
              ".header h3"
            );


          if (title) {

            title.textContent =
              group.name ||
              "Group";

          }


          loadGroupMessages();

        };


        list.appendChild(div);

      }
    );


  } catch (error) {

    console.error(
      "Load groups error:",
      error
    );

  }

}


// ======================
// LOAD GROUP MESSAGES
// ======================

function loadGroupMessages() {

  if (!selectedGroupId) {
    return;
  }


  if (unsubscribeMessages) {

    unsubscribeMessages();

    unsubscribeMessages =
      null;

  }


  const q =
    query(
      collection(
        db,
        "groups",
        selectedGroupId,
        "messages"
      ),
      orderBy(
        "timestamp",
        "asc"
      )
    );


  unsubscribeMessages =
    onSnapshot(
      q,
      async (snapshot) => {

        const box =
          document.getElementById(
            "messages"
          );


        if (!box) return;


        box.innerHTML = "";


        for (
          const docSnap of
          snapshot.docs
        ) {

          const data =
            docSnap.data();


          // ======================
          // MARK GROUP MESSAGE READ
          // ======================

          if (
            data.senderId !==
              auth.currentUser.uid &&
            !data.read
          ) {

            await updateDoc(
              docSnap.ref,
              {
                read: true
              }
            ).catch(
              console.error
            );

          }


          const div =
            document.createElement(
              "div"
            );


          div.className =
            "message";


          let html = `

            <b>
              ${escapeHTML(
                data.senderName ||
                "Unknown User"
              )}
            </b>

            <br>

          `;


          // ======================
          // REPLY PREVIEW
          // ======================

          if (data.replyTo) {

            html += `

              <div style="
                border-left:3px solid #25D366;
                padding-left:8px;
                margin-bottom:5px;
                font-size:12px;
                color:#666;
              ">

                ↩️
                ${escapeHTML(
                  data.replyTo
                )}

              </div>

            `;

          }


          // ======================
          // TEXT
          // ======================

          if (data.text) {

            html += `

              <div>
                ${escapeHTML(
                  data.text
                )}
              </div>

            `;

          }


          // ======================
          // IMAGE
          // ======================

          if (data.imageURL) {

            html += `

              <img
                src="${data.imageURL}"
                style="
                  max-width:220px;
                  border-radius:10px;
                  margin-top:8px;
                "
              >

            `;

          }


          // ======================
          // AUDIO
          // ======================

          if (data.audioURL) {

            html += `

              <audio
                controls
                style="
                  margin-top:8px;
                  width:220px;
                "
              >

                <source
                  src="${data.audioURL}"
                  type="audio/webm"
                >

                Your browser does not
                support audio.

              </audio>

            `;

          }


          // ======================
          // TIME
          // ======================

          html += `

            <small>

              ${
                data.timestamp
                  ? data.timestamp
                      .toDate()
                      .toLocaleTimeString(
                        [],
                        {
                          hour:
                            "2-digit",

                          minute:
                            "2-digit"
                        }
                      )
                  : ""
              }

              ${
                data.senderId ===
                auth.currentUser.uid
                  ? (
                      data.read
                        ? " ✓✓"
                        : " ✓"
                    )
                  : ""
              }

            </small>

          `;


          // ======================
          // GROUP BUTTON
          // REPLY ONLY
          // ======================

          html += `

            <div style="
              margin-top:6px;
            ">

              <button
                onclick="replyToMessage(
                  '${docSnap.id}',
                  ${JSON.stringify(
                    data.text || ""
                  )}
                )"
              >
                ↩️ Reply
              </button>

            </div>

          `;


          div.innerHTML =
            html;


          box.appendChild(div);

        }


        box.scrollTop =
          box.scrollHeight;

      },
      (error) => {

        console.error(
          "Group messages error:",
          error
        );

      }
    );

}

// ======================
// PROFILE PHOTO UPLOAD
// ======================

const uploadBtn =
  document.getElementById(
    "uploadBtn"
  );


if (uploadBtn) {

  uploadBtn.addEventListener(
    "click",
    async () => {

      const file =
        document.getElementById(
          "imageInput"
        ).files[0];


      if (!file) {

        alert(
          "Choose an image first."
        );

        return;

      }


      try {

        const imageRef =
          ref(
            storage,
            "profilePictures/" +
            auth.currentUser.uid
          );


        await uploadBytes(
          imageRef,
          file
        );


        const photoURL =
          await getDownloadURL(
            imageRef
          );


        await setDoc(
          doc(
            db,
            "users",
            auth.currentUser.uid
          ),
          {
            photoURL:
              photoURL
          },
          {
            merge: true
          }
        );


        const profilePic =
          document.getElementById(
            "profilePic"
          );


        if (profilePic) {

          profilePic.src =
            photoURL;

        }


        alert(
          "Profile picture updated successfully."
        );


      } catch (error) {

        console.error(
          "Profile upload error:",
          error
        );

        alert(
          "Failed to upload profile picture."
        );

      }

    }
  );

}


// ======================
// SEND CHAT IMAGE
// ======================

const imageBtn =
  document.getElementById(
    "imageBtn"
  );

const chatImage =
  document.getElementById(
    "chatImage"
  );


if (
  imageBtn &&
  chatImage
) {

  imageBtn.addEventListener(
    "click",
    () => {

      chatImage.click();

    }
  );


  chatImage.addEventListener(
    "change",
    async () => {

      const file =
        chatImage.files[0];


      if (!file) return;


      try {

        if (
          !isGroupChat &&
          !selectedFriendId
        ) {

          alert(
            "Select a friend first."
          );

          chatImage.value = "";

          return;

        }


        const imageRef =
          ref(
            storage,
            "chatImages/" +
            Date.now() +
            "_" +
            file.name
          );


        await uploadBytes(
          imageRef,
          file
        );


        const imageURL =
          await getDownloadURL(
            imageRef
          );


        const messageData = {

          senderId:
            auth.currentUser.uid,

          senderName:
            currentUserName,

          imageURL:
            imageURL,

          timestamp:
            serverTimestamp(),

          read: false

        };


        if (
          isGroupChat &&
          selectedGroupId
        ) {

          await addDoc(
            collection(
              db,
              "groups",
              selectedGroupId,
              "messages"
            ),
            messageData
          );

        } else {

          const chatId =
            getChatId(
              auth.currentUser.uid,
              selectedFriendId
            );


          await addDoc(
            collection(
              db,
              "chats",
              chatId,
              "messages"
            ),
            messageData
          );

        }


        chatImage.value = "";


      } catch (error) {

        console.error(
          "Image upload error:",
          error
        );

        alert(
          "Failed to send image."
        );

      }

    }
  );

}


// ======================
// VOICE RECORDING
// ======================

const recordBtn =
  document.getElementById(
    "recordBtn"
  );


if (recordBtn) {

  recordBtn.addEventListener(
    "click",
    async () => {

      // ======================
      // STOP RECORDING
      // ======================

      if (
        mediaRecorder &&
        mediaRecorder.state ===
          "recording"
      ) {

        mediaRecorder.stop();

        recordBtn.textContent =
          "🎤";

        return;

      }


      // ======================
      // CHECK CHAT
      // ======================

      if (
        !isGroupChat &&
        !selectedFriendId
      ) {

        alert(
          "Select a friend first."
        );

        return;

      }


      try {

        const stream =
          await navigator
            .mediaDevices
            .getUserMedia({
              audio: true
            });


        mediaRecorder =
          new MediaRecorder(
            stream
          );


        audioChunks = [];


        mediaRecorder.ondataavailable =
          (event) => {

            if (
              event.data.size > 0
            ) {

              audioChunks.push(
                event.data
              );

            }

          };


        mediaRecorder.onstop =
          async () => {

            try {

              stream
                .getTracks()
                .forEach(
                  track =>
                    track.stop()
                );


              const audioBlob =
                new Blob(
                  audioChunks,
                  {
                    type:
                      "audio/webm"
                  }
                );


              const audioRef =
                ref(
                  storage,
                  "voiceMessages/" +
                  Date.now() +
                  ".webm"
                );


              await uploadBytes(
                audioRef,
                audioBlob
              );


              const audioURL =
                await getDownloadURL(
                  audioRef
                );


              const messageData = {

                senderId:
                  auth.currentUser.uid,

                senderName:
                  currentUserName,

                audioURL:
                  audioURL,

                timestamp:
                  serverTimestamp(),

                read: false

              };


              if (
                isGroupChat &&
                selectedGroupId
              ) {

                await addDoc(
                  collection(
                    db,
                    "groups",
                    selectedGroupId,
                    "messages"
                  ),
                  messageData
                );

              } else {

                const chatId =
                  getChatId(
                    auth.currentUser.uid,
                    selectedFriendId
                  );


                await addDoc(
                  collection(
                    db,
                    "chats",
                    chatId,
                    "messages"
                  ),
                  messageData
                );

              }


            } catch (error) {

              console.error(
                "Voice message error:",
                error
              );

              alert(
                "Failed to send voice message."
              );

            }

          };


        mediaRecorder.start();

        recordBtn.textContent =
          "⏹";


      } catch (error) {

        console.error(
          "Microphone error:",
          error
        );

        alert(
          "Microphone permission denied or unavailable."
        );

      }

    }
  );

}
// ======================
// DELETE PRIVATE MESSAGE
// ======================

window.deleteMessage =
  async function (
    chatId,
    messageId
  ) {

    if (
      !confirm(
        "Delete this message?"
      )
    ) {
      return;
    }


    try {

      await deleteDoc(
        doc(
          db,
          "chats",
          chatId,
          "messages",
          messageId
        )
      );


    } catch (error) {

      console.error(
        "Delete message error:",
        error
      );

      alert(
        "Failed to delete message."
      );

    }

  };


// ======================
// REPLY TO MESSAGE
// ======================

window.replyToMessage =
  function (
    messageId,
    text
  ) {

    replyingTo = {

      id:
        messageId,

      text:
        text || ""

    };


    const input =
      document.getElementById(
        "messageInput"
      );


    if (input) {

      input.placeholder =
        "Replying to: " +
        (text || "message");

      input.focus();

    }

  };


// ======================
// LOGOUT
// ======================

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );


if (logoutBtn) {

  logoutBtn.addEventListener(
    "click",
    async () => {

      try {

        if (auth.currentUser) {

          await updateDoc(
            doc(
              db,
              "users",
              auth.currentUser.uid
            ),
            {

              online: false,

              lastSeen:
                serverTimestamp()

            }
          );

        }


        await signOut(auth);


        window.location.href =
          "sign in page.html";


      } catch (error) {

        console.error(
          "Logout error:",
          error
        );

        alert(
          "Logout failed."
        );

      }

    }
  );

}


// ======================
// OFFLINE STATUS
// ======================

window.addEventListener(
  "beforeunload",
  async () => {

    try {

      if (auth.currentUser) {

        await updateDoc(
          doc(
            db,
            "users",
            auth.currentUser.uid
          ),
          {

            online: false,

            lastSeen:
              serverTimestamp()

          }
        );

      }

    } catch (error) {

      console.error(
        "Offline status error:",
        error
      );

    }

  }
);


// ======================
// NOTIFICATION PERMISSION
// ======================

if (
  "Notification" in window
) {

  Notification
    .requestPermission()
    .then(
      permission => {

        console.log(
          "Notification permission:",
          permission
        );

      }
    );

}


// ======================
// FINISHED
// ======================

console.log(
  "✅ Home.js loaded successfully"
);