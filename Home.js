// ======================
// FIREBASE IMPORTS
// ======================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

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
let typingTimeout = null;
let unreadCounts = {};
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
// HELPER
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
  if (
    text === undefined ||
    text === null
  ) {
    return "";
  }
  const div =
document.createElement("div");
  div.textContent =
    String(text);
  return div.innerHTML;}
// ======================
// LOAD FRIENDS
// ======================
async function loadFriends() {
  const list =
  document.getElementById(
      "friendsList" );
  if (
    !list ||
    !auth.currentUser
  ) {
    return;
  }
  list.innerHTML = "";
  try {
    const snapshot =
      await getDocs(
        collection(db, "users")
      );
    snapshot.forEach(
      (userDoc) => {

        if (
          userDoc.id ===
          auth.currentUser.uid
        ) {
          return;
        }
        const friend =
          userDoc.data();
        const div =
  document.createElement(
            "div"
          );
        div.className =
          "friend";
        if (
        selectedFriendId ===
          userDoc.id
        ) {

          div.classList.add(
            "active"
          );

        }


        div.innerHTML = `

          <img
            src="${
              friend.photoURL ||
              "https://via.placeholder.com/45"
            }"
            alt="Profile"
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

            unreadCounts[userDoc.id] =
              0;


            document
              .querySelectorAll(
                ".friend"
              )
              .forEach(
                item => {

                  item.classList.remove(
                    "active"
                  );

                }
              );


            div.classList.add(
              "active"
            );


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

      }
    );


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
        await getDoc(
          userRef
        );


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


      if (
        userSnap.exists()
      ) {

        const data =
          userSnap.data();

        currentUserName =
          data.name ||
          user.email ||
          "User";

      } else {

        currentUserName =
          user.email ||
          "User";

      }


      const username =
        document.getElementById(
          "username"
        );


      if (username) {

        username.textContent =
          currentUserName;

      }


      // ======================
      // LOAD FRIENDS
      // ======================

      await loadFriends();


      // ======================
      // LOAD GROUPS
      // ======================

      await loadGroups();


      // ======================
      // LOAD FRIEND SELECTOR
      // ======================

      await loadFriendSelector();


      console.log(
        "Homepage loaded successfully"
      );


    } catch (error) {

      console.error(
        "HOME ERROR:",
        error
      );

      alert(
        "Homepage error: " +
        error.message
      );

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
        !auth.currentUser ||
        !selectedFriendId
      ) {
        return;
      }


      const chatId =
        getChatId(
          auth.currentUser.uid,
          selectedFriendId
        );


      try {

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

            typing:
              true
          }
        );


        clearTimeout(
          typingTimeout
        );


        typingTimeout =
          setTimeout(
            async () => {

              try {

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

                    typing:
                      false
                  }
                );

              } catch (error) {

                console.error(
                  "Typing update error:",
                  error
                );

              }

            },
            1500
          );

      } catch (error) {

        console.error(
          "Typing error:",
          error
        );

      }

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
console.log("SEND BUTTON CLICKED");
      if (!auth.currentUser) {

        alert(
          "Please log in first."
        );

        return;

      }


      const input =
        document.getElementById(
          "messageInput"
        );


      if (!input) {
        return;
      }


      const text =
        input.value.trim();


      if (!text) {
        return;
      }


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

              read:
                false,

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

            read:
              false,

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
          "Failed to send message: " +
          error.message
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

    unsubscribeMessages =
      null;

  }


  if (unsubscribeTyping) {

    unsubscribeTyping();

    unsubscribeTyping =
      null;

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


        if (!typingStatus) {
          return;
        }


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


        if (!box) {
          return;
        }


        box.innerHTML = "";


        for (
          const docSnap of
          snapshot.docs
        ) {

          const data =
            docSnap.data();


          // ======================
          // MARK READ
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
                  read:
                    true
                }
              );

            } catch (error) {

              console.error(
                "Read receipt error:",
                error
              );

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
                src="${escapeHTML(
                  data.imageURL
                )}"
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
                  src="${escapeHTML(
                    data.audioURL
                  )}"
                  type="audio/webm"
                >

                Your browser does not
                support audio.

              </audio>

            `;

          }


          // ======================
          // TIME + READ
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
          // BUTTONS
          // ======================

          html += `

            <div style="
              margin-top:6px;
            ">

              <button
                class="reply-message-btn"
                data-id="${docSnap.id}"
                data-text="${escapeHTML(
                  data.text || ""
                )}"
              >
                ↩️ Reply
              </button>

              ${
                data.senderId ===
                auth.currentUser.uid
                  ? `

                    <button
                      class="delete-message-btn"
                      data-chat="${chatId}"
                      data-id="${docSnap.id}"
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


          // ======================
          // REPLY BUTTON
          // ======================

          const replyButton =
            div.querySelector(
              ".reply-message-btn"
            );


          if (replyButton) {

            replyButton.addEventListener(
              "click",
              () => {

                replyToMessage(
                  replyButton.dataset.id,
                  replyButton.dataset.text
                );

              }
            );

          }


          // ======================
          // DELETE BUTTON
          // ======================

          const deleteButton =
            div.querySelector(
              ".delete-message-btn"
            );


          if (deleteButton) {

            deleteButton.addEventListener(
              "click",
              () => {

                deleteMessage(
                  deleteButton.dataset.chat,
                  deleteButton.dataset.id
                );

              }
            );

          }


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


  if (!select || !auth.currentUser) {
    return;
  }


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

      if (!auth.currentUser) {

        alert(
          "Please log in first."
        );

        return;

      }


      const groupInput =
        document.getElementById(
          "groupName"
        );


      if (!groupInput) {
        return;
      }


      const groupName =
        groupInput.value.trim();


      if (!groupName) {

        alert(
          "Enter a group name."
        );

        return;

      }


      const members = {};


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


        groupInput.value = "";


        await loadGroups();


      } catch (error) {

        console.error(
          "Create group error:",
          error
        );

        alert(
          "Failed to create group: " +
          error.message
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
    document.getElementById("groupsList");

  if (
    !list ||
    !auth.currentUser
  ) {
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

        // ======================
        // CHECK MEMBERSHIP
        // ======================

        if (
          !group.members ||
          !group.members[
            auth.currentUser.uid
          ]
        ) {
          return;
        }

        // ======================
        // GROUP ITEM
        // ======================

        const div =
          document.createElement("div");

        div.className =
          "friend";

        div.innerHTML = `

          <span style="
            font-size:20px;
            margin-right:8px;
          ">
            👥
          </span>

          <span style="
            flex:1;
            font-weight:bold;
          ">
            ${escapeHTML(
              group.name ||
              "Unnamed Group"
            )}
          </span>

        `;

        // ======================
        // OPEN GROUP
        // ======================

        div.addEventListener(
          "click",
          () => {

            selectedGroupId =
              groupDoc.id;

            selectedFriendId =
              "";

            window.selectedFriendId =
              "";

            isGroupChat =
              true;

            currentGroupAdmin =
              group.admin || "";

            // ======================
            // HEADER
            // ======================

            const title =
              document.querySelector(
                ".header h3"
              );

            if (title) {

              title.textContent =
                group.name ||
                "Group";

            }

            // ======================
            // SHOW ADD MEMBER BUTTON
            // ======================

            showGroupMemberButton();

            // ======================
            // LOAD GROUP MESSAGES
            // ======================

            loadGroupMessages();

          }
        );

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
// SHOW GROUP MEMBER BUTTON
// ======================

function showGroupMemberButton() {

  let button =
    document.getElementById(
      "groupAddMemberButton"
    );

  // Create button if it doesn't exist

  if (!button) {

    button =
      document.createElement("button");

    button.id =
      "groupAddMemberButton";

    button.type =
      "button";

    button.innerHTML =
      "👥 Add Member";

    button.style.cssText = `
      display:block;
      width:calc(100% - 20px);
      margin:8px 10px;
      padding:10px;
      background:#2196F3;
      color:white;
      border:none;
      border-radius:7px;
      cursor:pointer;
      font-weight:bold;
      font-size:14px;
    `;

    // Put button above groups list

    const groupsList =
      document.getElementById(
        "groupsList"
      );

    if (groupsList) {

      groupsList.parentNode.insertBefore(
        button,
        groupsList
      );

    }

    // ======================
    // BUTTON CLICK
    // ======================

    button.addEventListener(
      "click",
      (event) => {

        event.stopPropagation();

        openAddMemberDialog();

      }
    );

  }

  button.style.display =
    "block";

}
// ======================
// OPEN ADD MEMBER DIALOG
// ======================

async function openAddMemberDialog() {

  if (
    !auth.currentUser ||
    !selectedGroupId ||
    !isGroupChat
  ) {

    alert(
      "Please open a group first."
    );

    return;

  }

  try {

    // ======================
    // GET GROUP
    // ======================

    const groupRef =
      doc(
        db,
        "groups",
        selectedGroupId
      );

    const groupSnap =
      await getDoc(groupRef);

    if (!groupSnap.exists()) {

      alert(
        "Group not found."
      );

      return;

    }

    const group =
      groupSnap.data();

    // ======================
    // CHECK ADMIN
    // ======================

    if (
      group.admin &&
      group.admin !==
        auth.currentUser.uid
    ) {

      alert(
        "Only the group admin can add members."
      );

      return;

    }

    // ======================
    // GET FRIENDS
    // ======================

    const usersSnapshot =
      await getDocs(
        collection(db, "users")
      );

    const availableFriends = [];

    usersSnapshot.forEach(
      (userDoc) => {

        if (
          userDoc.id ===
          auth.currentUser.uid
        ) {
          return;
        }

        const user =
          userDoc.data();

        // Skip existing members

        if (
          group.members &&
          group.members[userDoc.id]
        ) {
          return;
        }

        availableFriends.push({
          id: userDoc.id,
          name:
            user.name ||
            user.email ||
            "User",
          photoURL:
            user.photoURL ||
            "images/default-profile.png"
        });

      }
    );

    // ======================
    // CREATE POPUP
    // ======================

    const oldDialog =
      document.getElementById(
        "addMemberDialog"
      );

    if (oldDialog) {
      oldDialog.remove();
    }

    const dialog =
      document.createElement("div");

    dialog.id =
      "addMemberDialog";

    dialog.style.cssText = `
      position:fixed;
      top:50%;
      left:50%;
      transform:translate(-50%,-50%);
      width:90%;
      max-width:350px;
      max-height:80vh;
      overflow-y:auto;
      background:white;
      border-radius:15px;
      padding:18px;
      box-shadow:0 8px 30px rgba(0,0,0,0.35);
      z-index:20000;
    `;

    // ======================
    // TITLE
    // ======================

    dialog.innerHTML = `

      <h3 style="
        text-align:center;
        margin-bottom:15px;
      ">
        👥 Add Members
      </h3>

      <p style="
        text-align:center;
        color:#666;
        font-size:13px;
        margin-bottom:12px;
      ">
        Select a friend to add
      </p>

      <div id="availableMembersList"></div>

      <button
        id="closeAddMemberDialog"
        type="button"
        style="
          width:100%;
          margin-top:15px;
          padding:10px;
          border:none;
          border-radius:8px;
          background:#eee;
          cursor:pointer;
          font-weight:bold;
        "
      >
        Cancel
      </button>

    `;

    document.body.appendChild(dialog);

    const membersList =
      document.getElementById(
        "availableMembersList"
      );

    // ======================
    // NO FRIENDS
    // ======================

    if (
      availableFriends.length === 0
    ) {

      membersList.innerHTML = `

        <p style="
          text-align:center;
          color:#777;
          padding:15px;
        ">
          🎉 All your friends
          are already in this group.
        </p>

      `;

    }

    // ======================
    // FRIEND LIST
    // ======================

    availableFriends.forEach(
      (friend) => {

        const item =
          document.createElement("div");

        item.style.cssText = `
          display:flex;
          align-items:center;
          padding:10px;
          margin-bottom:7px;
          background:#f5f5f5;
          border-radius:10px;
          cursor:pointer;
        `;

        item.innerHTML = `

          <img
            src="${escapeHTML(
              friend.photoURL
            )}"
            style="
              width:42px;
              height:42px;
              border-radius:50%;
              object-fit:cover;
              margin-right:10px;
            "
          >

          <span style="
            flex:1;
            font-weight:bold;
          ">
            ${escapeHTML(
              friend.name
            )}
          </span>

          <button
            type="button"
            style="
              border:none;
              background:#2196F3;
              color:white;
              padding:7px 10px;
              border-radius:7px;
              cursor:pointer;
              font-weight:bold;
            "
          >
            Add
          </button>

        `;

        // ======================
        // ADD MEMBER
        // ======================

        const addButton =
          item.querySelector("button");

        addButton.addEventListener(
          "click",
          async (event) => {

            event.stopPropagation();

            await addMemberToGroup(
              friend.id,
              friend.name,
              item,
              addButton
            );

          }
        );

        membersList.appendChild(item);

      }
    );

    // ======================
    // CLOSE
    // ======================

    const closeButton =
      document.getElementById(
        "closeAddMemberDialog"
      );

    if (closeButton) {

      closeButton.addEventListener(
        "click",
        () => {

          dialog.remove();

        }
      );

    }

  } catch (error) {

    console.error(
      "Open add member error:",
      error
    );

    alert(
      "Failed to load friends: " +
      error.message
    );

  }

}
// ======================
// ADD MEMBER TO GROUP
// ======================

async function addMemberToGroup(
  userId,
  userName,
  item,
  addButton
) {

  if (
    !auth.currentUser ||
    !selectedGroupId
  ) {

    return;

  }

  try {

    // ======================
    // GET GROUP
    // ======================

    const groupRef =
      doc(
        db,
        "groups",
        selectedGroupId
      );

    const groupSnap =
      await getDoc(groupRef);

    if (!groupSnap.exists()) {

      alert(
        "Group no longer exists."
      );

      return;

    }

    const group =
      groupSnap.data();

    // ======================
    // CHECK ADMIN
    // ======================

    if (
      group.admin &&
      group.admin !==
        auth.currentUser.uid
    ) {

      alert(
        "Only the group admin can add members."
      );

      return;

    }

    // ======================
    // CHECK EXISTING MEMBER
    // ======================

    if (
      group.members &&
      group.members[userId]
    ) {

      alert(
        "This user is already a member."
      );

      return;

    }

    // ======================
    // DISABLE BUTTON
    // ======================

    addButton.disabled =
      true;

    addButton.textContent =
      "Adding...";

    // ======================
    // ADD MEMBER
    // ======================

    await updateDoc(
      groupRef,
      {
        [`members.${userId}`]:
          true
      }
    );

    // ======================
    // SUCCESS
    // ======================

    addButton.textContent =
      "✅ Added";

    addButton.style.background =
      "#4CAF50";

    item.style.opacity =
      "0.6";

    // ======================
    // REFRESH GROUPS
    // ======================

    await loadGroups();

    console.log(
      "Member added:",
      userName,
      userId
    );

  } catch (error) {

    console.error(
      "Add member error:",
      error
    );

    addButton.disabled =
      false;

    addButton.textContent =
      "Add";

    alert(
      "Failed to add member: " +
      error.message
    );

  }

}
// ======================
// LOAD GROUP MESSAGES
// ======================

function loadGroupMessages() {

  if (
    !selectedGroupId ||
    !auth.currentUser
  ) {
    return;
  }


  if (unsubscribeMessages) {

    unsubscribeMessages();

    unsubscribeMessages =
      null;

  }


  if (unsubscribeTyping) {

    unsubscribeTyping();

    unsubscribeTyping =
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


        if (!box) {
          return;
        }


        box.innerHTML = "";


        for (
          const docSnap of
          snapshot.docs
        ) {

          const data =
            docSnap.data();


          // ======================
          // MARK READ
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
                  read:
                    true
                }
              );

            } catch (error) {

              console.error(
                "Group read error:",
                error
              );

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
          // REPLY
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
                src="${escapeHTML(
                  data.imageURL
                )}"
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
                  src="${escapeHTML(
                    data.audioURL
                  )}"
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
          // REPLY BUTTON
          // ======================

          html += `

            <div style="
              margin-top:6px;
            ">

              <button
                class="group-reply-btn"
                data-id="${docSnap.id}"
q                  data.text || ""
                )}"
              >
                ↩️ Reply
              </button>

            </div>

          `;


          div.innerHTML =
            html;


          const replyButton =
            div.querySelector(
              ".group-reply-btn"
            );


          if (replyButton) {

            replyButton.addEventListener(
              "click",
              () => {

                replyToMessage(
                  replyButton.dataset.id,
                  replyButton.dataset.text
                );

              }
            );

          }


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


      if (!file) {
        return;
      }


      if (
        !file.type.startsWith(
          "image/"
        )
      ) {

        alert(
          "Please choose an image."
        );

        chatImage.value = "";

        return;

      }


      try {

        if (!auth.currentUser) {

          alert(
            "Please log in first."
          );

          chatImage.value = "";

          return;

        }


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

          read:
            false

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
          "Failed to send image: " +
          error.message
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


      if (!auth.currentUser) {

        alert(
          "Please log in first."
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

                read:
                  false

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
                "Failed to send voice message: " +
                error.message
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

async function deleteMessage(
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

}


// ======================
// MAKE AVAILABLE TO HTML
// ======================

window.deleteMessage =
  deleteMessage;


// ======================
// REPLY TO MESSAGE
// ======================

function replyToMessage(
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
      (
        text ||
        "message"
      );

    input.focus();

  }

}


window.replyToMessage =
  replyToMessage;


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
              online:
                false,

              lastSeen:
                serverTimestamp()
            }
          );

        }


        await signOut(
          auth
        );


        window.location.href =
          "sign in page.html";


      } catch (error) {

        console.error(
          "Logout error:",
          error
        );

        alert(
          "Logout failed: " +
          error.message
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
  () => {

    try {

      if (
        auth.currentUser
      ) {

        updateDoc(
          doc(
            db,
            "users",
            auth.currentUser.uid
          ),
          {
            online:
              false,

            lastSeen:
              serverTimestamp()
          }
        ).catch(
          console.error
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
    )
    .catch(
      error => {

        console.error(
          "Notification permission error:",
          error
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
// ======================
// PROFILE POPOVER
// ======================

const profilePictureElement =
  document.getElementById("profilePic");

const profilePopoverElement =
  document.getElementById("profilePopover");

if (
  profilePictureElement &&
  profilePopoverElement
) {

  profilePictureElement.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();

      profilePopoverElement.classList.toggle(
        "show"
      );

    }
  );

  profilePopoverElement.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();

    }
  );

}


// ======================
// CREATE GROUP POPOVER
// ======================

const openGroupPopoverButton =
  document.getElementById(
    "openCreateGroupBtn"
  );

const groupPopoverElement =
  document.getElementById(
    "createGroupPopover"
  );

const cancelGroupPopoverButton =
  document.getElementById(
    "cancelCreateGroupBtn"
  );

const groupNameInput =
  document.getElementById(
    "groupName"
  );


// OPEN CREATE GROUP POPOVER

if (
  openGroupPopoverButton &&
  groupPopoverElement
) {

  openGroupPopoverButton.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();

      groupPopoverElement.classList.add(
        "show"
      );

      if (groupNameInput) {

        setTimeout(() => {

          groupNameInput.focus();

        }, 100);

      }

    }
  );

}


// CANCEL CREATE GROUP

if (
  cancelGroupPopoverButton &&
  groupPopoverElement
) {

  cancelGroupPopoverButton.addEventListener(
    "click",
    () => {

      groupPopoverElement.classList.remove(
        "show"
      );

      if (groupNameInput) {

        groupNameInput.value = "";

      }

    }
  );

}


// CLOSE POPOVERS WHEN CLICKING OUTSIDE

document.addEventListener(
  "click",
  (event) => {

    // Profile popover

    if (
      profilePopoverElement &&
      profilePopoverElement.classList.contains(
        "show"
      ) &&
      !profilePopoverElement.contains(
        event.target
      ) &&
      event.target !==
        profilePictureElement
    ) {

      profilePopoverElement.classList.remove(
        "show"
      );

    }


    // Create group popover

    if (
      groupPopoverElement &&
      groupPopoverElement.classList.contains(
        "show"
      ) &&
      !groupPopoverElement.contains(
        event.target
      ) &&
      event.target !==
        openGroupPopoverButton
    ) {

      groupPopoverElement.classList.remove(
        "show"
      );

    }

  }
);