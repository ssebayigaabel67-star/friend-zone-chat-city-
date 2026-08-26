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
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  increment,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
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
      "friendsList"
    );

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
        collection(
          db,
          "users"
        )
      );


    snapshot.forEach(
      (userDoc) => {

        // ======================
        // DON'T SHOW YOURSELF
        // ======================

        if (
          userDoc.id ===
          auth.currentUser.uid
        ) {
          return;
        }


        const friend =
          userDoc.data();


        // ======================
        // FRIEND ROW
        // ======================

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


        // ======================
        // FRIEND HTML
        // ======================

        div.innerHTML = `

          <img
            class="friend-profile-picture"
            src="${
              friend.photoURL ||
              "images/default-profile.png"
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


        // ======================
        // PROFILE PICTURE
        // ======================

        const profilePicture =
          div.querySelector(
            ".friend-profile-picture"
          );


        if (profilePicture) {

          profilePicture.addEventListener(
            "click",
            (event) => {

              // Don't open the chat
              event.stopPropagation();


              openUserProfilePopover(
                userDoc.id,
                friend
              );

            }
          );

        }


        // ======================
        // OPEN CHAT
        // ======================

        div.addEventListener(
          "click",
          () => {

            selectedFriendId =
              userDoc.id;

            window.selectedFriendId =
              selectedFriendId;

            selectedGroupId =
              "";

            isGroupChat =
              false;


            unreadCounts[
              userDoc.id
            ] = 0;


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


        list.appendChild(
          div
        );

      }
    );


  } catch (error) {

    console.error(
      "Load friends error:",
      error
    );

  }

}
// ==================================================
// UNREAD PRIVATE MESSAGE LISTENER
// ==================================================

let unreadMessageListeners = {};

function startUnreadMessageListeners() {

  if (!auth.currentUser) {
    return;
  }

  const myUid =
    auth.currentUser.uid;


  // ======================
  // STOP OLD LISTENERS
  // ======================

  Object.values(
    unreadMessageListeners
  ).forEach(
    unsubscribe => {

      if (
        typeof unsubscribe ===
        "function"
      ) {

        unsubscribe();

      }

    }
  );


  unreadMessageListeners = {};

  unreadCounts = {};


  // ======================
  // GET ALL USERS
  // ======================

  getDocs(
    collection(
      db,
      "users"
    )
  ).then(
    snapshot => {

      snapshot.forEach(
        userDoc => {

          const friendId =
            userDoc.id;


          // ======================
          // DON'T WATCH YOURSELF
          // ======================

          if (
            friendId === myUid
          ) {

            return;

          }


          const chatId =
            getChatId(
              myUid,
              friendId
            );


          const messagesRef =
            collection(
              db,
              "chats",
              chatId,
              "messages"
            );


          const unreadQuery =
            query(
              messagesRef,

              where(
                "senderId",
                "==",
                friendId
              ),

              where(
                "read",
                "==",
                false
              )
            );


          // ======================
          // LISTEN FOR UNREAD
          // ======================

          const unsubscribe =
            onSnapshot(
              unreadQuery,
              (messagesSnapshot) => {

                if (
                  selectedFriendId ===
                  friendId
                ) {

                  unreadCounts[
                    friendId
                  ] = 0;

                } else {

                  unreadCounts[
                    friendId
                  ] =
                    messagesSnapshot.size;

                }


                // ======================
                // UPDATE BADGE ONLY
                // ======================
                //
                // IMPORTANT:
                // Do NOT call loadFriends()
                // here. That was causing
                // the friend list to rebuild.
                //

                const friendRow =
                  document.querySelector(
                    `.friend[data-friend-id="${friendId}"]`
                  );


                if (!friendRow) {

                  return;

                }


                let unreadBadge =
                  friendRow.querySelector(
                    ".unread-message-badge"
                  );


                const count =
                  unreadCounts[
                    friendId
                  ] || 0;


                if (count > 0) {

                  if (!unreadBadge) {

                    unreadBadge =
                      document.createElement(
                        "span"
                      );

                    unreadBadge.className =
                      "unread-message-badge";

                    unreadBadge.style.cssText = `
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
                      margin-left:8px;
                    `;

                    friendRow.appendChild(
                      unreadBadge
                    );

                  }


                  unreadBadge.textContent =
                    count;


                } else {

                  if (unreadBadge) {

                    unreadBadge.remove();

                  }

                }

              },

              (error) => {

                console.error(
                  "Unread listener error:",
                  error
                );

              }
            );


          unreadMessageListeners[
            friendId
          ] =
            unsubscribe;

        }

      );

    }

  ).catch(
    error => {

      console.error(
        "Unread users error:",
        error
      );

    }
  );

}
// ======================
// OPEN USER PROFILE POPOVER
// ======================

function openUserProfilePopover(
  userId,
  userData
) {

  const popover =
    document.getElementById(
      "userProfilePopover"
    );

  if (!popover) {
    console.error(
      "User profile popover not found."
    );
    return;
  }


  // ======================
  // GET ELEMENTS
  // ======================

  const photo =
    document.getElementById(
      "userPopoverPhoto"
    );

  const name =
    document.getElementById(
      "userPopoverName"
    );

  const email =
    document.getElementById(
      "userPopoverEmail"
    );

  const status =
    document.getElementById(
      "userPopoverStatus"
    );

  const age =
    document.getElementById(
      "userPopoverAge"
    );

  const nationality =
    document.getElementById(
      "userPopoverNationality"
    );

  const friends =
    document.getElementById(
      "userPopoverFriends"
    );

  const likes =
    document.getElementById(
      "userPopoverLikes"
    );


  // ======================
  // PROFILE PHOTO
  // ======================

  if (photo) {

    photo.src =
      userData.photoURL ||
      "images/default-profile.png";

  }


  // ======================
  // NAME
  // ======================

  if (name) {

    name.textContent =
      userData.name ||
      userData.email ||
      "User";

  }


  // ======================
  // EMAIL
  // ======================

  if (email) {

    email.textContent =
      userData.email ||
      "";

  }


  // ======================
  // ONLINE STATUS
  // ======================

  if (status) {

    if (userData.online) {

      status.textContent =
        "🟢 Online";

    } else {

      status.textContent =
        "⚫ Offline";

    }

  }


  // ======================
  // CALCULATE AGE
  // ======================

  let calculatedAge =
    "—";


  if (userData.dob) {

    const birthDate =
      new Date(
        userData.dob
      );

    const today =
      new Date();


    calculatedAge =
      today.getFullYear() -
      birthDate.getFullYear();


    const monthDifference =
      today.getMonth() -
      birthDate.getMonth();


    if (
      monthDifference < 0 ||
      (
        monthDifference === 0 &&
        today.getDate() <
        birthDate.getDate()
      )
    ) {

      calculatedAge--;

    }

  }


  if (age) {

    age.textContent =
      "Age: " +
      calculatedAge;

  }


  // ======================
  // NATIONALITY
  // ======================

  if (nationality) {

    nationality.textContent =
      "Nationality: " +
      (
        userData.nationality ||
        "Not provided"
      );

  }


  // ======================
  // FRIEND COUNT
  // ======================

  if (friends) {

    friends.textContent =
      "Friends: " +
      (
        userData.friendsCount ||
        0
      );

  }


  // ======================
  // LIKE COUNT
  // ======================

  if (likes) {

    likes.textContent =
      "Likes: " +
      (
        userData.likesCount ||
        0
      );

  }


  // ======================
  // SAVE SELECTED USER
  // ======================

  window.selectedProfileUserId =
    userId;


  window.selectedProfileUserData =
    userData;


  // ======================
  // SHOW POPOVER
  // ======================

  popover.classList.add(
    "show"
  );

}
// ======================
// LIKE USER
// ======================

const likeUserBtn =
  document.getElementById(
    "likeUserBtn"
  );

if (likeUserBtn) {

  likeUserBtn.addEventListener(
    "click",
    async () => {

      // ======================
      // CHECK LOGIN
      // ======================

      if (!auth.currentUser) {

        alert(
          "Please log in first."
        );

        return;

      }


      // ======================
      // GET TARGET USER
      // ======================

      const targetUserId =
        window.selectedProfileUserId;


      if (!targetUserId) {

        return;

      }


      // ======================
      // DON'T LIKE YOURSELF
      // ======================

      if (
        targetUserId ===
        auth.currentUser.uid
      ) {

        alert(
          "You cannot like yourself."
        );

        return;

      }


      try {

        const likeRef =
          doc(
            db,
            "users",
            targetUserId,
            "likes",
            auth.currentUser.uid
          );


        const likeSnap =
          await getDoc(
            likeRef
          );


        // ======================
        // REMOVE LIKE
        // ======================

        if (likeSnap.exists()) {

          await deleteDoc(
            likeRef
          );
await updateDoc(
  doc(db, "users", targetUserId),
  {
    likesCount: increment(-1)
  }
);

          likeUserBtn.textContent =
            "❤️ Like";


          // Update displayed count
          const likesElement =
            document.getElementById(
              "userPopoverLikes"
            );


          if (likesElement) {

            let currentLikes =
              parseInt(
                likesElement
                  .textContent
                  .replace(
                    /\D/g,
                    ""
                  )
              ) || 0;


            currentLikes =
              Math.max(
                0,
                currentLikes - 1
              );


            likesElement.textContent =
              "Likes: " +
              currentLikes;

          }


          return;

        }


        // ======================
        // ADD LIKE
        // ======================

        await setDoc(
          likeRef,
          {
            userId:
              auth.currentUser.uid,

            timestamp:
              serverTimestamp()
          }
        );
await updateDoc(
  doc(db, "users", targetUserId),
  {
    likesCount: increment(1)
  }
);

        likeUserBtn.textContent =
          "💔 Unlike";


        // Update displayed count
        const likesElement =
          document.getElementById(
            "userPopoverLikes"
          );


        if (likesElement) {

          let currentLikes =
            parseInt(
              likesElement
                .textContent
                .replace(
                  /\D/g,
                  ""
                )
            ) || 0;


          currentLikes++;


          likesElement.textContent =
            "Likes: " +
            currentLikes;

        }

      } catch (error) {

        console.error(
          "Like user error:",
          error
        );

        alert(
          "Could not update like."
        );

      }

    }
  );

}
// ======================
// CLOSE USER PROFILE POPOVER
// ======================

const closeUserProfilePopover =
  document.getElementById(
    "closeUserProfilePopover"
  );

if (closeUserProfilePopover) {

  closeUserProfilePopover.addEventListener(
    "click",
    () => {

      const popover =
        document.getElementById(
          "userProfilePopover"
        );

      if (popover) {

        popover.classList.remove(
          "show"
        );

      }

    }
  );

}
// ======================
// CLOSE WHEN CLICKING OUTSIDE
// ======================

const userProfilePopover =
  document.getElementById(
    "userProfilePopover"
  );

if (userProfilePopover) {

  userProfilePopover.addEventListener(
    "click",
    (event) => {

      if (
        event.target ===
        userProfilePopover
      ) {

        userProfilePopover.classList.remove(
          "show"
        );

      }

    }
  );

}
// ======================
// SEND FRIEND REQUEST
// ======================

const addFriendBtn =
  document.getElementById(
    "addFriendBtn"
  );

if (addFriendBtn) {

  addFriendBtn.addEventListener(
    "click",
    async () => {

      // ======================
      // CHECK LOGIN
      // ======================

      if (!auth.currentUser) {

        alert(
          "Please log in first."
        );

        return;

      }


      // ======================
      // GET TARGET USER
      // ======================

      const targetUserId =
        window.selectedProfileUserId;


      if (!targetUserId) {
        return;
      }


      // ======================
      // DON'T ADD YOURSELF
      // ======================

      if (
        targetUserId ===
        auth.currentUser.uid
      ) {

        alert(
          "You cannot add yourself."
        );

        return;

      }


      try {

        // ======================
        // CREATE REQUEST ID
        // ======================

        const requestId =
          auth.currentUser.uid +
          "_" +
          targetUserId;


        const requestRef =
          doc(
            db,
            "friendRequests",
            requestId
          );


        // ======================
        // CHECK EXISTING REQUEST
        // ======================

        const requestSnap =
          await getDoc(
            requestRef
          );


        if (
          requestSnap.exists()
        ) {

          alert(
            "Friend request already sent."
          );

          return;

        }


        // ======================
        // SAVE REQUEST
        // ======================

        await setDoc(
          requestRef,
          {

            senderId:
              auth.currentUser.uid,

            receiverId:
              targetUserId,

            status:
              "pending",

            timestamp:
              serverTimestamp()

          }
        );


        // ======================
        // CHANGE BUTTON
        // ======================

        addFriendBtn.textContent =
          "⏳ Request Sent";

        addFriendBtn.disabled =
          true;


        alert(
          "Friend request sent!"
        );


      } catch (error) {

        console.error(
          "Friend request error:",
          error
        );

        alert(
          "Could not send friend request."
        );

      }

    }
  );

}
// ======================
// LOAD FRIEND REQUESTS
// ======================

async function loadFriendRequests() {

  const list =
    document.getElementById(
      "friendRequestsList"
    );

  if (
    !list ||
    !auth.currentUser
  ) {
    return;
  }

  list.innerHTML = "";

  try {

    const requestsQuery =
      query(
        collection(
          db,
          "friendRequests"
        ),
        where(
          "receiverId",
          "==",
          auth.currentUser.uid
        ),
        where(
          "status",
          "==",
          "pending"
        )
      );

    const snapshot =
      await getDocs(
        requestsQuery
      );


    if (snapshot.empty) {

      list.innerHTML = `
        <div style="
          padding:10px;
          color:#aaa;
        ">
          No friend requests
        </div>
      `;

      return;
    }


    for (
      const requestDoc
      of snapshot.docs
    ) {

      const request =
        requestDoc.data();


      // ======================
      // GET SENDER
      // ======================

      const senderSnap =
        await getDoc(
          doc(
            db,
            "users",
            request.senderId
          )
        );


      if (
        !senderSnap.exists()
      ) {
        continue;
      }


      const sender =
        senderSnap.data();


      // ======================
      // REQUEST CONTAINER
      // ======================

      const requestDiv =
        document.createElement(
          "div"
        );

      requestDiv.className =
        "friend-request";


      requestDiv.innerHTML = `

        <img
          src="${
            sender.photoURL ||
            "images/default-profile.png"
          }"
          alt="Profile"
          style="
            width:45px;
            height:45px;
            border-radius:50%;
            object-fit:cover;
          "
        >

        <div style="
          flex:1;
          margin-left:10px;
        ">

          <strong>
            ${escapeHTML(
              sender.name ||
              sender.email ||
              "User"
            )}
          </strong>

          <div style="
            font-size:12px;
            color:#aaa;
          ">
            wants to be your friend
          </div>

        </div>

        <button
          class="accept-request-btn"
          type="button"
        >
          ✅
        </button>

        <button
          class="decline-request-btn"
          type="button"
        >
          ❌
        </button>

      `;


      // ======================
      // ACCEPT
      // ======================

      requestDiv
        .querySelector(
          ".accept-request-btn"
        )
        .addEventListener(
          "click",
          () => {

            acceptFriendRequest(
              requestDoc.id,
              request
            );

          }
        );


      // ======================
      // DECLINE
      // ======================

      requestDiv
        .querySelector(
          ".decline-request-btn"
        )
        .addEventListener(
          "click",
          () => {

            declineFriendRequest(
              requestDoc.id
            );

          }
        );


      list.appendChild(
        requestDiv
      );

    }


  } catch (error) {

    console.error(
      "Load friend requests error:",
      error
    );

  }

}
// ======================
// ACCEPT FRIEND REQUEST
// ======================

async function acceptFriendRequest(
  requestId,
  request
) {

  if (!auth.currentUser) {
    return;
  }

  try {

    const currentUserId =
      auth.currentUser.uid;

    const senderId =
      request.senderId;


    // ======================
    // CREATE FRIEND LINKS
    // ======================

    await setDoc(
      doc(
        db,
        "users",
        currentUserId,
        "friends",
        senderId
      ),
      {
        userId: senderId,
        since: serverTimestamp()
      }
    );


    await setDoc(
      doc(
        db,
        "users",
        senderId,
        "friends",
        currentUserId
      ),
      {
        userId: currentUserId,
        since: serverTimestamp()
      }
    );


    // ======================
    // UPDATE FRIEND COUNTS
    // ======================

    await updateDoc(
      doc(
        db,
        "users",
        currentUserId
      ),
      {
        friendsCount:
          increment(1)
      }
    );


    await updateDoc(
      doc(
        db,
        "users",
        senderId
      ),
      {
        friendsCount:
          increment(1)
      }
    );


    // ======================
    // MARK REQUEST ACCEPTED
    // ======================

    await updateDoc(
      doc(
        db,
        "friendRequests",
        requestId
      ),
      {
        status:
          "accepted"
      }
    );


    // ======================
    // RELOAD REQUESTS
    // ======================

    loadFriendRequests();


    alert(
      "Friend request accepted!"
    );


  } catch (error) {

    console.error(
      "Accept friend request error:",
      error
    );

    alert(
      "Could not accept friend request."
    );

  }

}


// ======================
// DECLINE FRIEND REQUEST
// ======================

async function declineFriendRequest(
  requestId
) {

  try {

    await deleteDoc(
      doc(
        db,
        "friendRequests",
        requestId
      )
    );


    loadFriendRequests();


  } catch (error) {

    console.error(
      "Decline friend request error:",
      error
    );

    alert(
      "Could not decline friend request."
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


      // ======================
      // CHECK IF LOGGED IN
      // ======================

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


      // ======================
      // CURRENT USER
      // ======================

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


      // ======================
      // SET ONLINE
      // ======================

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


      // ======================
      // LOAD USER NAME
      // ======================

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


      // ======================
      // DISPLAY USERNAME
      // ======================

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

startUnreadMessageListeners();
      // ======================
      // LOAD FRIEND REQUESTS
      // ======================

      await loadFriendRequests();


      // ======================
      // LOAD GROUPS
      // ======================

      await loadGroups();


      // ======================
      // LOAD FRIEND SELECTOR
      // ======================

      await loadFriendSelector();
await loadMyProfilePopover();
      await
        loadMyProfilePicture();

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


  // ======================
  // STOP OLD LISTENERS
  // ======================

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
  // MESSAGES REFERENCE
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


  // ======================
  // MESSAGES LISTENER
  // ======================

  unsubscribeMessages =
    onSnapshot(
      q,
      (snapshot) => {

        const box =
          document.getElementById(
            "messages"
          );


        if (!box) {
          return;
        }


        // ======================
        // CLEAR OLD DISPLAY
        // ======================

        box.innerHTML = "";


        // ======================
        // DISPLAY MESSAGES
        // ======================

        snapshot.docs.forEach(
          (docSnap) => {

            const data =
              docSnap.data();


            const div =
              document.createElement(
                "div"
              );


            const isMine =
              data.senderId ===
              auth.currentUser.uid;


            div.className =
              isMine
                ? "message sent"
                : "message received";


            // =====================================
            // APPLY SAVED BUBBLE COLORS
            // =====================================

            const savedSentColor =
              localStorage.getItem(
                "friendszoneSentBubbleColor"
              ) || "#25D366";


            const savedReceivedColor =
              localStorage.getItem(
                "friendszoneReceivedBubbleColor"
              ) || "#ffffff";


            if (isMine) {

              div.style.setProperty(
                "background",
                savedSentColor,
                "important"
              );

            } else {

              div.style.setProperty(
                "background",
                savedReceivedColor,
                "important"
              );

            }


            // =====================================
            // APPLY SAVED MESSAGE EFFECT
            // =====================================

            const savedEffect =
              localStorage.getItem(
                "friendszoneMessageEffect"
              ) || "none";


            div.classList.add(
              "message-effect-" +
              savedEffect
            );


            // =====================================
            // APPLY SAVED BUBBLE STYLE
            // =====================================

            const savedBubbleStyle =
              localStorage.getItem(
                "friendszoneBubbleStyle"
              ) || "classic";


            div.classList.add(
              "bubble-" +
              savedBubbleStyle +
              "-active"
            );


            // =====================================
            // APPLY SAVED MESSAGE FONT
            // =====================================

            const savedFont =
              localStorage.getItem(
                "friendszoneMessageFont"
              ) || "Arial";


            div.style.setProperty(
              "font-family",
              savedFont,
              "important"
            );


            // ======================
            // SENDER NAME COLOR
            // ======================

            const savedNameColor =
              localStorage.getItem(
                "friendszoneNameColor"
              ) || "#2196F3";


            let nameStyle = "";


            if (
              savedNameColor ===
              "rainbow"
            ) {

              nameStyle = `
                color: transparent;
                background: linear-gradient(
                  90deg,
                  red,
                  orange,
                  green,
                  blue,
                  purple
                );
                -webkit-background-clip: text;
                background-clip: text;
              `;

            } else {

              nameStyle = `
                color: ${savedNameColor};
              `;

            }


            let html = `

              <b
                class="message-sender-name"
                style="${nameStyle}"
              >
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
                  isMine
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
                  isMine
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


            // =====================================
            // APPLY FONT TO MESSAGE CONTENT
            // =====================================

            const messageFont =
              localStorage.getItem(
                "friendszoneMessageFont"
              ) || "Arial";


            div.style.setProperty(
              "font-family",
              messageFont,
              "important"
            );


            div.querySelectorAll(
              "*"
            ).forEach(
              function (element) {

                element.style.setProperty(
                  "font-family",
                  messageFont,
                  "important"
                );

              }
            );


            // ======================
            // APPLY NAME COLOR
            // ======================

            const senderName =
              div.querySelector(
                ".message-sender-name"
              );


            const currentNameColor =
              localStorage.getItem(
                "friendszoneNameColor"
              ) || "#2196F3";


            if (senderName) {

              if (
                currentNameColor ===
                "rainbow"
              ) {

                senderName.style.color =
                  "transparent";


                senderName.style.background =
                  "linear-gradient(90deg, red, orange, green, blue, purple)";


                senderName.style.webkitBackgroundClip =
                  "text";


                senderName.style.backgroundClip =
                  "text";


                senderName.classList.add(
                  "friendszone-rainbow-name"
                );

              } else {

                senderName.style.color =
                  currentNameColor;

              }

            }


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


            // ======================
            // ADD MESSAGE TO SCREEN
            // ======================

            box.appendChild(
              div
            );

          }
        );
// ======================
        // SCROLL TO BOTTOM
        // ======================

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


        // ======================
        // GROUP PHOTO
        // ======================

        const photo =
          group.photoURL ||
          group.photo ||
          "images/default-profile.png";


        div.innerHTML = `

          <img
            src="${photo}"
            alt="Group Photo"
            class="group-list-photo"
            onerror="
              this.src='images/default-profile.png';
            "
          >

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

              title.style.cursor =
                "pointer";


              title.onclick = () => {

                openGroupAdminPopover(
                  groupDoc.id
                );

              };

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
// SHOW GROUP MEMBERS BUTTON
// ======================

function showGroupMemberButton() {

  let button =
    document.getElementById(
      "groupMembersButton"
    );

  if (!button) {

    button =
      document.createElement("button");

    button.id =
      "groupMembersButton";

    button.type =
      "button";

    button.innerHTML =
      "👥 Members";

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

    button.addEventListener(
      "click",
      (event) => {

        event.stopPropagation();

        openGroupMembersPopover();

      }
    );

  }

  button.style.display =
    "block";

}
// ======================
// GROUP MEMBERS POPOVER
// ======================

async function openGroupMembersPopover() {

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

    const oldPopover =
      document.getElementById(
        "groupMembersPopover"
      );

    if (oldPopover) {
      oldPopover.remove();
    }

    // ======================
    // CREATE POPOVER
    // ======================

    const popover =
      document.createElement("div");

    popover.id =
      "groupMembersPopover";

    popover.style.cssText = `
      position:fixed;
      top:50%;
      left:50%;
      transform:translate(-50%,-50%);
      width:90%;
      max-width:350px;
      max-height:80vh;
      overflow-y:auto;
      background:white;
      border-radius:16px;
      padding:18px;
      box-shadow:0 8px 30px rgba(0,0,0,0.35);
      z-index:20000;
    `;

    popover.innerHTML = `

      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        margin-bottom:15px;
      ">

        <h3>
          👥 Group Members
        </h3>

        <button
          id="closeGroupMembersPopover"
          type="button"
          style="
            border:none;
            background:#eee;
            width:32px;
            height:32px;
            border-radius:50%;
            cursor:pointer;
            font-size:16px;
          "
        >
          ✕
        </button>

      </div>

      <div
        id="groupMembersList"
      ></div>

      <button
        id="popoverAddMemberBtn"
        type="button"
        style="
          width:100%;
          margin-top:15px;
          padding:11px;
          border:none;
          border-radius:8px;
          background:#2196F3;
          color:white;
          font-weight:bold;
          cursor:pointer;
        "
      >
        ➕ Add Member
      </button>

    `;

    document.body.appendChild(
      popover
    );

    // ======================
    // CLOSE BUTTON
    // ======================

    const closeButton =
      document.getElementById(
        "closeGroupMembersPopover"
      );

    if (closeButton) {

      closeButton.addEventListener(
        "click",
        () => {

          popover.remove();

        }
      );

    }

    // ======================
    // LOAD MEMBERS
    // ======================

    await loadGroupMembersIntoPopover(
      group
    );

    // ======================
    // ADD MEMBER
    // ======================

    const addButton =
      document.getElementById(
        "popoverAddMemberBtn"
      );

    if (addButton) {

      addButton.addEventListener(
        "click",
        () => {

          openAddMemberDialog();

        }
      );

    }

  } catch (error) {

    console.error(
      "Group members popover error:",
      error
    );

    alert(
      "Failed to load members: " +
      error.message
    );

  }

}
// ======================
// LOAD GROUP MEMBERS
// ======================

async function loadGroupMembersIntoPopover(group) {

  const list =
    document.getElementById(
      "groupMembersList"
    );

  if (!list) {
    return;
  }

  list.innerHTML = "";

  const members =
    group.members || {};

  const memberIds =
    Object.keys(members);

  if (memberIds.length === 0) {

    list.innerHTML = `
      <p style="
        text-align:center;
        color:#777;
        padding:15px;
      ">
        No members found.
      </p>
    `;

    return;
  }

  // ======================
  // CHECK CURRENT USER
  // ======================

  const isAdmin =
    auth.currentUser &&
    group.admin ===
      auth.currentUser.uid;


  for (
    const uid of memberIds
  ) {

    try {

      const userSnap =
        await getDoc(
          doc(
            db,
            "users",
            uid
          )
        );

      if (!userSnap.exists()) {
        continue;
      }

      const user =
        userSnap.data();

      const item =
        document.createElement(
          "div"
        );

      item.style.cssText = `
        display:flex;
        align-items:center;
        padding:10px;
        margin-bottom:7px;
        background:#f5f5f5;
        border-radius:10px;
      `;

      const isMemberAdmin =
        group.admin === uid;

      const isOnline =
        user.online === true;

      item.innerHTML = `

        <img
          src="${
            escapeHTML(
              user.photoURL ||
              "images/default-profile.png"
            )
          }"
          style="
            width:45px;
            height:45px;
            border-radius:50%;
            object-fit:cover;
            margin-right:10px;
          "
        >

        <div style="
          flex:1;
          min-width:0;
        ">

          <div style="
            font-weight:bold;
            overflow:hidden;
            text-overflow:ellipsis;
          ">

            ${escapeHTML(
              user.name ||
              user.email ||
              "User"
            )}

            ${
              isMemberAdmin
                ? " 👑"
                : ""
            }

          </div>

          <div style="
            font-size:12px;
            color:${
              isOnline
                ? "#25D366"
                : "#888"
            };
            margin-top:3px;
          ">

            ${
              isOnline
                ? "🟢 Online"
                : "⚫ Offline"
            }

          </div>

        </div>

        ${
          isMemberAdmin
            ? `
              <span style="
                background:#ffd700;
                color:#333;
                padding:4px 7px;
                border-radius:10px;
                font-size:10px;
                font-weight:bold;
              ">
                ADMIN
              </span>
            `
            : ""
        }

        ${
          isAdmin &&
          !isMemberAdmin
            ? `
              <button
                class="remove-group-member-btn"
                data-uid="${uid}"
                data-name="${escapeHTML(
                  user.name ||
                  user.email ||
                  "User"
                )}"
                type="button"
                style="
                  margin-left:7px;
                  padding:6px 8px;
                  border:none;
                  border-radius:7px;
                  background:#e53935;
                  color:white;
                  cursor:pointer;
                  font-size:12px;
                "
              >
                🗑
              </button>
            `
            : ""
        }

      `;

      list.appendChild(item);

    } catch (error) {

      console.error(
        "Load member error:",
        error
      );

    }

  }


  // ======================
  // REMOVE BUTTONS
  // ======================

  if (isAdmin) {

    const removeButtons =
      list.querySelectorAll(
        ".remove-group-member-btn"
      );

    removeButtons.forEach(
      button => {

        button.addEventListener(
          "click",
          async () => {

            const uid =
              button.dataset.uid;

            const name =
              button.dataset.name;

            const confirmed =
              confirm(
                `Remove ${name} from this group?`
              );

            if (!confirmed) {
              return;
            }

            await removeGroupMember(
              uid,
              name
            );

          }
        );

      }
    );

  }

}
// ======================
// REMOVE GROUP MEMBER
// ======================

async function removeGroupMember(
  uid,
  name
) {

  if (
    !auth.currentUser ||
    !selectedGroupId
  ) {
    return;
  }

  try {

    const groupRef =
      doc(
        db,
        "groups",
        selectedGroupId
      );

    const groupSnap =
      await getDoc(
        groupRef
      );

    if (!groupSnap.exists()) {

      alert(
        "Group not found."
      );

      return;

    }

    const group =
      groupSnap.data();

    // ======================
    // ADMIN CHECK
    // ======================

    if (
      group.admin !==
      auth.currentUser.uid
    ) {

      alert(
        "Only the group admin can remove members."
      );

      return;

    }

    // ======================
    // DON'T REMOVE ADMIN
    // ======================

    if (
      uid === group.admin
    ) {

      alert(
        "The group admin cannot be removed."
      );

      return;

    }

    // ======================
    // COPY MEMBERS
    // ======================

    const members = {
      ...(group.members || {})
    };

    // Remove member

    delete members[uid];

    // ======================
    // SAVE TO FIREBASE
    // ======================

    await updateDoc(
      groupRef,
      {
        members: members
      }
    );

    console.log(
      `${name} removed from group`
    );

    // ======================
    // RELOAD POPOVER
    // ======================

    const updatedSnap =
      await getDoc(
        groupRef
      );

    if (
      updatedSnap.exists()
    ) {

      await loadGroupMembersIntoPopover(
        updatedSnap.data()
      );

    }

    alert(
      `${name} was removed from the group.`
    );

  } catch (error) {

    console.error(
      "Remove member error:",
      error
    );

    alert(
      "Failed to remove member: " +
      error.message
    );

  }

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


      // ======================
      // CHECK IMAGE
      // ======================

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

        // ======================
        // LOGIN CHECK
        // ======================

        if (!auth.currentUser) {

          alert(
            "Please log in first."
          );

          chatImage.value = "";

          return;

        }


        // ======================
        // CHAT CHECK
        // ======================

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


        // ======================
        // PROCESSING
        // ======================

        imageBtn.disabled =
          true;

        imageBtn.textContent =
          "⏳";


        // ======================
        // CREATE IMAGE
        // ======================

        const image =
          new Image();

        const reader =
          new FileReader();


        reader.onload =
          async function () {

            image.onload =
              async function () {

                // ======================
                // RESIZE
                // ======================

                const maxSize =
                  900;

                let width =
                  image.width;

                let height =
                  image.height;


                if (
                  width > maxSize ||
                  height > maxSize
                ) {

                  if (
                    width > height
                  ) {

                    height =
                      Math.round(
                        height *
                        maxSize /
                        width
                      );

                    width =
                      maxSize;

                  } else {

                    width =
                      Math.round(
                        width *
                        maxSize /
                        height
                      );

                    height =
                      maxSize;

                  }

                }


                // ======================
                // CANVAS
                // ======================

                const canvas =
                  document.createElement(
                    "canvas"
                  );

                canvas.width =
                  width;

                canvas.height =
                  height;


                const context =
                  canvas.getContext(
                    "2d"
                  );


                context.drawImage(
                  image,
                  0,
                  0,
                  width,
                  height
                );


                // ======================
                // COMPRESS
                // ======================

                const imageData =
                  canvas.toDataURL(
                    "image/jpeg",
                    0.70
                  );


                // ======================
                // MESSAGE DATA
                // ======================

                const messageData = {

                  senderId:
                    auth.currentUser.uid,

                  senderName:
                    currentUserName,

                  type:
                    "image",

                  imageURL:
                    imageData,

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

                };


                // ======================
                // GROUP IMAGE
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
                    messageData
                  );


                } else {

                  // ======================
                  // PRIVATE IMAGE
                  // ======================

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


                // ======================
                // RESET
                // ======================

                chatImage.value =
                  "";

                replyingTo =
                  null;


                imageBtn.disabled =
                  false;

                imageBtn.textContent =
                  "📷";


              };


            image.onerror =
              function () {

                throw new Error(
                  "Could not process image."
                );

              };


            image.src =
              reader.result;

          };


        reader.readAsDataURL(
          file
        );


      } catch (error) {

        console.error(
          "Send image error:",
          error
        );

        alert(
          "Failed to send image: " +
          error.message
        );


        imageBtn.disabled =
          false;

        imageBtn.textContent =
          "📷";

        chatImage.value =
          "";

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


// ======================
// VERCEL VOICE BACKEND
// ======================

const VOICE_UPLOAD_URL =
  "/api/upload-voice";


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


      // ======================
      // LOGIN CHECK
      // ======================

      if (!auth.currentUser) {

        alert(
          "Please log in first."
        );

        return;

      }


      try {

        // ======================
        // MICROPHONE
        // ======================

        const stream =
          await navigator
            .mediaDevices
            .getUserMedia({
              audio: true
            });


        // ======================
        // CREATE RECORDER
        // ======================

        mediaRecorder =
          new MediaRecorder(
            stream
          );


        audioChunks = [];


        // ======================
        // COLLECT AUDIO
        // ======================

        mediaRecorder.ondataavailable =
          (event) => {

            if (
              event.data &&
              event.data.size > 0
            ) {

              audioChunks.push(
                event.data
              );

            }

          };


        // ======================
        // RECORDING STOPPED
        // ======================

        mediaRecorder.onstop =
          async () => {

            try {

              // ======================
              // STOP MICROPHONE
              // ======================

              stream
                .getTracks()
                .forEach(
                  (track) => {

                    track.stop();

                  }
                );


              // ======================
              // CREATE AUDIO BLOB
              // ======================

              const audioBlob =
                new Blob(
                  audioChunks,
                  {
                    type:
                      "audio/webm"
                  }
                );


              console.log(
                "VOICE RECORDING CREATED:",
                audioBlob.size,
                "bytes"
              );


              if (
                audioBlob.size === 0
              ) {

                alert(
                  "The voice recording is empty."
                );

                return;

              }


              // ======================
              // CREATE FORM DATA
              // ======================

              const formData =
                new FormData();


              formData.append(
                "file",
                audioBlob,
                "voice-" +
                  Date.now() +
                  ".webm"
              );


              // ======================
              // UPLOADING
              // ======================

              recordBtn.textContent =
                "⏳";


              console.log(
                "UPLOADING VOICE..."
              );


              // ======================
              // SEND TO VERCEL
              // ======================

              const response =
                await fetch(
                  VOICE_UPLOAD_URL,
                  {
                    method: "POST",

                    body:
                      formData
                  }
                );


              // ======================
              // READ RESPONSE
              // ======================

              const result =
                await response.json();


              console.log(
                "VOICE BACKEND RESPONSE:",
                result
              );


              if (
                !response.ok ||
                !result.success ||
                !result.audioURL
              ) {

                throw new Error(
                  result.error ||
                  "Voice upload failed."
                );

              }


              // ======================
              // FILEPOST URL
              // ======================

              const audioURL =
                result.audioURL;


              console.log(
                "VOICE URL:",
                audioURL
              );


              // ======================
              // MESSAGE DATA
              // ======================

              const messageData = {

                senderId:
                  auth.currentUser.uid,

                senderName:
                  currentUserName,

                type:
                  "voice",

                audioURL:
                  audioURL,

                timestamp:
                  serverTimestamp(),

                read:
                  false

              };


              // ======================
              // SAVE TO GROUP
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
                  messageData
                );

              }


              // ======================
              // SAVE TO PRIVATE CHAT
              // ======================

              else {

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


              console.log(
                "VOICE MESSAGE SAVED"
              );


              // ======================
              // RESET
              // ======================

              audioChunks = [];

              mediaRecorder =
                null;

              recordBtn.textContent =
                "🎤";


            } catch (error) {

              console.error(
                "Voice upload error:",
                error
              );


              alert(
                "Failed to send voice message: " +
                error.message
              );


              recordBtn.textContent =
                "🎤";


              audioChunks = [];

              mediaRecorder =
                null;

            }

          };


        // ======================
        // START RECORDING
        // ======================

        mediaRecorder.start();


        recordBtn.textContent =
          "⏹";


        console.log(
          "VOICE RECORDING STARTED"
        );


      } catch (error) {

        console.error(
          "Microphone error:",
          error
        );


        alert(
          "Microphone permission denied or unavailable."
        );


        recordBtn.textContent =
          "🎤";

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
// VIEW PROFILE POPOVER
// ======================

const viewProfileBtn =
  document.getElementById(
    "viewProfileBtn"
  );

if (viewProfileBtn) {

  viewProfileBtn.addEventListener(
    "click",
    async () => {

      // Close the small profile menu
      if (profilePopoverElement) {

        profilePopoverElement.classList.remove(
          "show"
        );

      }

      await openMyProfilePopover();

    }
  );

}
// ======================
// OPEN MY PROFILE POPOVER
// ======================

async function openMyProfilePopover() {

  if (!auth.currentUser) {

    alert(
      "Please log in first."
    );

    return;

  }

  try {

    // ======================
    // GET CURRENT USER
    // ======================

    const userRef =
      doc(
        db,
        "users",
        auth.currentUser.uid
      );

    const userSnap =
      await getDoc(
        userRef
      );

    if (!userSnap.exists()) {

      alert(
        "Profile not found."
      );

      return;

    }

    const user =
      userSnap.data();


    // ======================
    // REMOVE OLD POPOVER
    // ======================

    const oldPopover =
      document.getElementById(
        "myProfilePopover"
      );

    if (oldPopover) {

      oldPopover.remove();

    }


    // ======================
    // PROFILE POPOVER
    // ======================

    const popover =
      document.createElement(
        "div"
      );

    popover.id =
      "myProfilePopover";

    popover.style.cssText = `
      position:fixed;
      top:50%;
      left:50%;
      transform:translate(-50%,-50%);
      width:90%;
      max-width:350px;
      background:white;
      border-radius:18px;
      padding:20px;
      box-shadow:0 8px 35px rgba(0,0,0,0.35);
      z-index:30000;
      text-align:center;
    `;


    // ======================
    // PROFILE DATA
    // ======================

    const photo =
      user.photoURL ||
      "images/default-profile.png";

    const name =
      user.name ||
      user.email ||
      "User";

    const email =
      user.email ||
      auth.currentUser.email ||
      "No email";

    const online =
      user.online === true;


    // ======================
    // PROFILE HTML
    // ======================

    popover.innerHTML = `

      <button
        id="closeMyProfilePopover"
        type="button"
        style="
          position:absolute;
          top:10px;
          right:10px;
          width:32px;
          height:32px;
          border:none;
          border-radius:50%;
          background:#eee;
          cursor:pointer;
          font-size:16px;
        "
      >
        ✕
      </button>


      <img
        src="${escapeHTML(photo)}"
        alt="Profile Picture"
        style="
          width:100px;
          height:100px;
          border-radius:50%;
          object-fit:cover;
          border:3px solid #2196F3;
          margin-bottom:12px;
        "
      >


      <h2 style="
        margin:5px 0;
        color:#222;
      ">

        ${escapeHTML(name)}

      </h2>


      <p style="
        margin:5px 0;
        color:${
          online
            ? "#25D366"
            : "#777"
        };
        font-weight:bold;
      ">

        ${
          online
            ? "🟢 Online"
            : "⚫ Offline"
        }

      </p>


      <div style="
        text-align:left;
        margin-top:18px;
        background:#f5f5f5;
        padding:12px;
        border-radius:10px;
      ">

        <p style="
          margin:6px 0;
        ">

          📧
          <strong>Email:</strong><br>

          <span style="
            word-break:break-word;
            color:#555;
          ">
            ${escapeHTML(email)}
          </span>

        </p>

      </div>


      <button
        id="closeProfileButton"
        type="button"
        style="
          width:100%;
          margin-top:15px;
          padding:11px;
          border:none;
          border-radius:8px;
          background:#2196F3;
          color:white;
          font-weight:bold;
          cursor:pointer;
        "
      >
        Close
      </button>

    `;


    // ======================
    // ADD TO PAGE
    // ======================

    document.body.appendChild(
      popover
    );


    // ======================
    // CLOSE BUTTON
    // ======================

    const closeButton =
      document.getElementById(
        "closeMyProfilePopover"
      );

    const closeBottomButton =
      document.getElementById(
        "closeProfileButton"
      );


    if (closeButton) {

      closeButton.addEventListener(
        "click",
        () => {

          popover.remove();

        }
      );

    }


    if (closeBottomButton) {

      closeBottomButton.addEventListener(
        "click",
        () => {

          popover.remove();

        }
      );

    }


  } catch (error) {

    console.error(
      "Profile popover error:",
      error
    );

    alert(
      "Failed to load profile: " +
      error.message
    );

  }

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
// ======================
// DARK MODE
// ======================

const darkModeBtn =
  document.getElementById(
    "darkModeBtn"
  );


// ======================
// LOAD SAVED THEME
// ======================

const savedTheme =
  localStorage.getItem(
    "friendsZoneTheme"
  );

if (
  savedTheme === "dark"
) {

  document.body.classList.add(
    "dark-mode"
  );

  if (darkModeBtn) {

    darkModeBtn.textContent =
      "☀️";

  }

}


// ======================
// DARK MODE BUTTON
// ======================

if (darkModeBtn) {

  darkModeBtn.addEventListener(
    "click",
    () => {

      document.body.classList.toggle(
        "dark-mode"
      );


      const isDark =
        document.body.classList.contains(
          "dark-mode"
        );


      // ======================
      // SAVE THEME
      // ======================

      localStorage.setItem(
        "friendsZoneTheme",
        isDark
          ? "dark"
          : "light"
      );


      // ======================
      // CHANGE ICON
      // ======================

      darkModeBtn.textContent =
        isDark
          ? "☀️"
          : "🌙";

    }
  );

}
// ======================
// GROUP ADMIN POPOVER
// ======================

function openGroupAdminPopover(groupId) {

  if (!groupId) {
    return;
  }

  const popover =
    document.getElementById(
      "groupAdminPopover"
    );

  if (!popover) {
    console.error(
      "Group admin popover not found."
    );
    return;
  }

  // Save selected group
  selectedGroupId = groupId;

  // Show popover
  popover.classList.add(
    "show"
  );


  // ======================
  // LOAD GROUP DATA
  // ======================

  getDoc(
    doc(
      db,
      "groups",
      groupId
    )
  )
  .then(
    (groupSnap) => {

      if (!groupSnap.exists()) {

        console.error(
          "Group not found."
        );

        popover.classList.remove(
          "show"
        );

        return;

      }


      const group =
        groupSnap.data();

      // ======================
      // GROUP NAME
      // ======================

      const groupName =
        document.getElementById(
          "adminGroupName"
        );

      if (groupName) {

        groupName.textContent =
          group.name ||
          "Unnamed Group";

      }


      // ======================
      // ADMIN
      // ======================

      const adminText =
        document.getElementById(
          "adminGroupAdmin"
        );

      if (adminText) {

        adminText.textContent =
          "👑 Admin: " +
          (
            group.admin ||
            "Unknown"
          );

      }


      // ======================
      // MEMBER COUNT
      // ======================

      const memberText =
        document.getElementById(
          "adminGroupMembers"
        );


      let memberCount = 0;


      if (group.members) {

        memberCount =
          Object.keys(
            group.members
          ).length;

      }


      if (memberText) {

        memberText.textContent =
          "👥 Members: " +
          memberCount;

      }

    }
  )
  .catch(
    (error) => {

      console.error(
        "Group admin panel error:",
        error
      );

    }
  );

}
// ======================
// GROUPS THREE-DOTS BUTTON
// ======================

const groupsMenuBtn =
  document.getElementById("groupsMenuBtn");

if (groupsMenuBtn) {

  groupsMenuBtn.addEventListener(
    "click",
    () => {

      // Make sure a group has been selected
      if (!selectedGroupId) {

        alert(
          "Please select a group first."
        );

        return;
      }

      // Open the existing group popover
      openGroupAdminPopover(
        selectedGroupId
      );

    }
  );

}
// ======================
// GROUP NOTIFICATIONS
// ======================

const groupNotificationsAction =
  document.getElementById(
    "groupNotificationsAction"
  );

if (groupNotificationsAction) {

  groupNotificationsAction.addEventListener(
    "click",
    () => {

      if (!selectedGroupId) {
        alert("Please open a group first.");
        return;
      }

      const key =
        "groupNotifications_" +
        selectedGroupId;

      const current =
        localStorage.getItem(key);

      const enabled =
        current !== "off";

      localStorage.setItem(
        key,
        enabled
          ? "off"
          : "on"
      );

      groupNotificationsAction.textContent =
        enabled
          ? "🔕 Notifications Off"
          : "🔔 Group Notifications";

    }
  );

}
// ======================
// GROUP MEMBERS POPOVER
// ======================

const groupMembersAction =
  document.getElementById(
    "groupMembersAction"
  );

const groupMembersPopover =
  document.getElementById(
    "groupMembersPopover"
  );

const closeGroupMembersPopover =
  document.getElementById(
    "closeGroupMembersPopover"
  );


// OPEN GROUP MEMBERS POPOVER

if (
  groupMembersAction &&
  groupMembersPopover
) {

  groupMembersAction.addEventListener(
    "click",
    () => {

      groupMembersPopover.classList.add(
        "show"
      );

      loadGroupMembers();

    }
  );

}


// CLOSE GROUP MEMBERS POPOVER

if (
  closeGroupMembersPopover &&
  groupMembersPopover
) {

  closeGroupMembersPopover.addEventListener(
    "click",
    () => {

      groupMembersPopover.classList.remove(
        "show"
      );

    }
  );

}
// ======================
// LOAD GROUP MEMBERS
// ======================

async function loadGroupMembers() {

  const membersList =
    document.getElementById(
      "groupMembersList"
    );

  const membersCount =
    document.getElementById(
      "membersPopoverCount"
    );

  if (
    !membersList ||
    !selectedGroupId
  ) {
    return;
  }

  membersList.innerHTML =
    "Loading members...";

  try {

    const groupRef =
      doc(
        db,
        "groups",
        selectedGroupId
      );

    const groupSnap =
      await getDoc(groupRef);

    if (!groupSnap.exists()) {

      membersList.innerHTML =
        "Group not found.";

      return;
    }

    const group =
      groupSnap.data();

const adminGroupPhoto =
  document.getElementById(
    "adminGroupPhoto"
  );

if (adminGroupPhoto) {

  adminGroupPhoto.src =
    group.photoURL ||
    group.photo ||
    "images/default-profile.png";

}
    const members =
      group.members || {};

    const memberIds =
      Object.keys(members);

    if (membersCount) {

      membersCount.textContent =
        "Members: " +
        memberIds.length;

    }

    membersList.innerHTML = "";

    if (memberIds.length === 0) {

      membersList.innerHTML =
        "No members found.";

      return;
    }

    for (
      const uid of memberIds
    ) {

      const userSnap =
        await getDoc(
          doc(
            db,
            "users",
            uid
          )
        );

      const member =
        userSnap.exists()
          ? userSnap.data()
          : {};

      const memberDiv =
        document.createElement(
          "div"
        );

      memberDiv.className =
        "group-member-item";

      memberDiv.innerHTML = `

        <img
          src="${
            escapeHTML(
              member.photoURL ||
              "images/default-profile.png"
            )
          }"
          alt="Profile"
        >

        <div class="group-member-details">

          <strong>
            ${escapeHTML(
              member.name ||
              member.email ||
              "User"
            )}
          </strong>

          <small>
            ${
              uid === group.admin
                ? "👑 Admin"
                : "👤 Member"
            }
          </small>

        </div>

      `;

      membersList.appendChild(
        memberDiv
      );

    }

  } catch (error) {

    console.error(
      "Load group members error:",
      error
    );

    membersList.innerHTML =
      "Failed to load members.";

  }

}
// ======================
// REMOVE GROUP
// ======================

const deleteGroupAction =
  document.getElementById(
    "deleteGroupAction"
  );

if (deleteGroupAction) {

  deleteGroupAction.addEventListener(
    "click",
    async () => {

      // Make sure a group is selected
      if (!selectedGroupId) {

        alert(
          "Please select a group first."
        );

        return;
      }

      // Make sure user is logged in
      if (!auth.currentUser) {

        alert(
          "Please log in first."
        );

        return;
      }

      // Only the admin can remove the group
      if (
        currentGroupAdmin !==
        auth.currentUser.uid
      ) {

        alert(
          "Only the group admin can remove this group."
        );

        return;
      }

      const confirmed =
        confirm(
          "Are you sure you want to remove this group? This cannot be undone."
        );

      if (!confirmed) {
        return;
      }

      try {

        await deleteDoc(
          doc(
            db,
            "groups",
            selectedGroupId
          )
        );

        alert(
          "Group removed successfully."
        );

        // Close popover
        const popover =
          document.getElementById(
            "groupAdminPopover"
          );

        if (popover) {

          popover.classList.remove(
            "show"
          );

        }

        // Close members popover too
        const membersPopover =
          document.getElementById(
            "groupMembersPopover"
          );

        if (membersPopover) {

          membersPopover.classList.remove(
            "show"
          );

        }

        // Clear selected group
        selectedGroupId = "";

        currentGroupAdmin = "";

        isGroupChat = false;

        // Clear messages
        const messages =
          document.getElementById(
            "messages"
          );

        if (messages) {
          messages.innerHTML = "";
        }

        // Reset header
        const title =
          document.querySelector(
            ".header h3"
          );

        if (title) {

          title.textContent =
            "FRIEND ZONE CHAT";

        }

        // Reload groups
        await loadGroups();

      } catch (error) {

        console.error(
          "Remove group error:",
          error
        );

        alert(
          "Failed to remove group: " +
          error.message
        );

      }

    }
  );
}
// ======================
// LEAVE GROUP
// ======================

const leaveGroupAction =
  document.getElementById(
    "leaveGroupAction"
  );

if (leaveGroupAction) {

  leaveGroupAction.addEventListener(
    "click",
    async () => {

      if (!selectedGroupId) {
        alert("Please select a group first.");
        return;
      }

      if (!auth.currentUser) {
        alert("Please log in first.");
        return;
      }

      // Admin should not leave using this button
      if (
        currentGroupAdmin ===
        auth.currentUser.uid
      ) {

        alert(
          "You are the group admin. You cannot leave the group from here. Transfer admin control first."
        );

        return;
      }

      const confirmed =
        confirm(
          "Are you sure you want to leave this group?"
        );

      if (!confirmed) {
        return;
      }

      try {

        const groupRef =
          doc(
            db,
            "groups",
            selectedGroupId
          );

        const groupSnap =
          await getDoc(groupRef);

        if (!groupSnap.exists()) {

          alert("Group no longer exists.");

          return;
        }

        const group =
          groupSnap.data();

        const members =
          {
            ...(group.members || {})
          };

        delete members[
          auth.currentUser.uid
        ];

        await updateDoc(
          groupRef,
          {
            members: members
          }
        );

        alert(
          "You left the group."
        );

        // Close group popover
        const groupPopover =
          document.getElementById(
            "groupAdminPopover"
          );

const closeGroupAdminPopover =
  document.getElementById(
    "closeGroupAdminPopover"
  );
        if (groupPopover) {

          groupPopover.classList.remove(
            "show"
          );

        }

        // Close members popover
        const membersPopover =
          document.getElementById(
            "groupMembersPopover"
          );

        if (membersPopover) {

          membersPopover.classList.remove(
            "show"
          );

        }

        // Reset selected group
        selectedGroupId = "";

        currentGroupAdmin = "";

        isGroupChat = false;

        // Clear messages
        const messages =
          document.getElementById(
            "messages"
          );

        if (messages) {
          messages.innerHTML = "";
        }

        // Reset header
        const title =
          document.querySelector(
            ".header h3"
          );

        if (title) {

          title.textContent =
            "FRIEND ZONE CHAT";

        }

        // Reload groups
        await loadGroups();

      } catch (error) {

        console.error(
          "Leave group error:",
          error
        );

        alert(
          "Failed to leave group: " +
          error.message
        );

      }

    }
  );

}
// ======================
// RENAME GROUP
// ======================

const renameGroupAction =
  document.getElementById(
    "renameGroupAction"
  );

const renameGroupPopover =
  document.getElementById(
    "renameGroupPopover"
  );

const renameGroupInput =
  document.getElementById(
    "renameGroupInput"
  );

const closeRenameGroupPopover =
  document.getElementById(
    "closeRenameGroupPopover"
  );

const cancelRenameGroupBtn =
  document.getElementById(
    "cancelRenameGroupBtn"
  );

const saveRenameGroupBtn =
  document.getElementById(
    "saveRenameGroupBtn"
  );


// ======================
// OPEN RENAME POPOVER
// ======================

if (
  renameGroupAction &&
  renameGroupPopover
) {

  renameGroupAction.addEventListener(
    "click",
    async () => {

      if (!selectedGroupId) {

        alert(
          "Please select a group first."
        );

        return;
      }

      if (!auth.currentUser) {

        alert(
          "Please log in first."
        );

        return;
      }


      // Only admin can rename

      if (
        currentGroupAdmin !==
        auth.currentUser.uid
      ) {

        alert(
          "Only the group admin can rename this group."
        );

        return;
      }


      try {

        const groupSnap =
          await getDoc(
            doc(
              db,
              "groups",
              selectedGroupId
            )
          );

        if (!groupSnap.exists()) {

          alert(
            "Group not found."
          );

          return;
        }


        const group =
          groupSnap.data();


        if (renameGroupInput) {

          renameGroupInput.value =
            group.name || "";

        }


        renameGroupPopover.classList.add(
          "show"
        );


        if (renameGroupInput) {

          setTimeout(
            () => {

              renameGroupInput.focus();

              renameGroupInput.select();

            },
            100
          );

        }

      } catch (error) {

        console.error(
          "Open rename group error:",
          error
        );

      }

    }
  );

}


// ======================
// CLOSE RENAME POPOVER
// ======================

function closeRenameGroup() {

  if (renameGroupPopover) {

    renameGroupPopover.classList.remove(
      "show"
    );

  }

  if (renameGroupInput) {

    renameGroupInput.value = "";

  }

}


if (closeRenameGroupPopover) {

  closeRenameGroupPopover.addEventListener(
    "click",
    closeRenameGroup
  );

}


if (cancelRenameGroupBtn) {

  cancelRenameGroupBtn.addEventListener(
    "click",
    closeRenameGroup
  );

}


// ======================
// SAVE NEW GROUP NAME
// ======================

if (saveRenameGroupBtn) {

  saveRenameGroupBtn.addEventListener(
    "click",
    async () => {

      if (!selectedGroupId) {

        alert(
          "Please select a group first."
        );

        return;
      }

      if (!auth.currentUser) {

        alert(
          "Please log in first."
        );

        return;
      }


      // Admin check

      if (
        currentGroupAdmin !==
        auth.currentUser.uid
      ) {

        alert(
          "Only the group admin can rename this group."
        );

        return;
      }


      const newName =
        renameGroupInput
          ? renameGroupInput.value.trim()
          : "";


      if (!newName) {

        alert(
          "Please enter a group name."
        );

        return;
      }


      try {

        saveRenameGroupBtn.disabled =
          true;

        saveRenameGroupBtn.textContent =
          "Saving...";


        await updateDoc(
          doc(
            db,
            "groups",
            selectedGroupId
          ),
          {
            name: newName
          }
        );


        // Update header

        const title =
          document.getElementById(
            "chatHeaderTitle"
          );

        if (title) {

          title.textContent =
            newName;

        }


        // Close rename popover

        closeRenameGroup();


        // Close admin popover

        if (
          groupAdminPopover
        ) {

          groupAdminPopover.classList.remove(
            "show"
          );

        }


        // Reload groups list

        await loadGroups();


        console.log(
          "Group renamed successfully."
        );


      } catch (error) {

        console.error(
          "Rename group error:",
          error
        );

        alert(
          "Failed to rename group: " +
          error.message
        );

      } finally {

        saveRenameGroupBtn.disabled =
          false;

        saveRenameGroupBtn.textContent =
          "Save";

      }

    }
  );

}


// ======================
// ENTER KEY TO SAVE
// ======================

if (renameGroupInput) {

  renameGroupInput.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Enter"
      ) {

        event.preventDefault();

        if (saveRenameGroupBtn) {

          saveRenameGroupBtn.click();

        }

      }

    }
  );

}
// ======================
// CHANGE GROUP PHOTO
// ======================

const changeGroupPhotoAction =
  document.getElementById(
    "changeGroupPhotoAction"
  );

const changeGroupPhotoPopover =
  document.getElementById(
    "changeGroupPhotoPopover"
  );

const closeChangeGroupPhotoPopover =
  document.getElementById(
    "closeChangeGroupPhotoPopover"
  );

const cancelChangeGroupPhotoBtn =
  document.getElementById(
    "cancelChangeGroupPhotoBtn"
  );

const chooseGroupPhotoBtn =
  document.getElementById(
    "chooseGroupPhotoBtn"
  );

const groupPhotoInput =
  document.getElementById(
    "groupPhotoInput"
  );

const groupPhotoPreview =
  document.getElementById(
    "groupPhotoPreview"
  );

const saveGroupPhotoBtn =
  document.getElementById(
    "saveGroupPhotoBtn"
  );

let selectedGroupPhotoFile = null;


// ======================
// OPEN POPOVER
// ======================

if (
  changeGroupPhotoAction &&
  changeGroupPhotoPopover
) {

  changeGroupPhotoAction.addEventListener(
    "click",
    async () => {

      if (!selectedGroupId) {

        alert(
          "Please select a group first."
        );

        return;
      }

      if (!auth.currentUser) {

        alert(
          "Please log in first."
        );

        return;
      }

      if (
        currentGroupAdmin !==
        auth.currentUser.uid
      ) {

        alert(
          "Only the group admin can change the group photo."
        );

        return;
      }

      selectedGroupPhotoFile = null;

      if (groupPhotoInput) {
        groupPhotoInput.value = "";
      }

      try {

        const groupSnap =
          await getDoc(
            doc(
              db,
              "groups",
              selectedGroupId
            )
          );

        if (groupSnap.exists()) {

          const group =
            groupSnap.data();

          groupPhotoPreview.src =
            group.photoURL ||
            group.photo ||
            "images/default-profile.png";

        } else {

          groupPhotoPreview.src =
            "images/default-profile.png";

        }

      } catch (error) {

        console.error(
          "Load group photo error:",
          error
        );

        groupPhotoPreview.src =
          "images/default-profile.png";

      }

      changeGroupPhotoPopover.classList.add(
        "show"
      );

    }
  );

}


// ======================
// CHOOSE PHOTO
// ======================

if (chooseGroupPhotoBtn) {

  chooseGroupPhotoBtn.addEventListener(
    "click",
    () => {

      if (groupPhotoInput) {

        groupPhotoInput.click();

      }

    }
  );

}


// ======================
// PREVIEW PHOTO
// ======================

if (groupPhotoInput) {

  groupPhotoInput.addEventListener(
    "change",
    () => {

      const file =
        groupPhotoInput.files[0];

      if (!file) {
        return;
      }


      // CHECK IMAGE

      if (
        !file.type.startsWith(
          "image/"
        )
      ) {

        alert(
          "Please choose an image."
        );

        groupPhotoInput.value = "";

        return;
      }


      selectedGroupPhotoFile =
        file;


      const reader =
        new FileReader();


      reader.onload =
        (event) => {

          if (groupPhotoPreview) {

            groupPhotoPreview.src =
              event.target.result;

          }

        };


      reader.readAsDataURL(file);

    }
  );

}


// ======================
// CLOSE POPOVER
// ======================

function closeChangeGroupPhoto() {

  if (
    changeGroupPhotoPopover
  ) {

    changeGroupPhotoPopover.classList.remove(
      "show"
    );

  }

  selectedGroupPhotoFile =
    null;

  if (groupPhotoInput) {

    groupPhotoInput.value = "";

  }

}


if (
  closeChangeGroupPhotoPopover
) {

  closeChangeGroupPhotoPopover.addEventListener(
    "click",
    (event) => {

      event.preventDefault();

      event.stopPropagation();

      closeChangeGroupPhoto();

    }
  );

}


if (
  cancelChangeGroupPhotoBtn
) {

  cancelChangeGroupPhotoBtn.addEventListener(
    "click",
    (event) => {

      event.preventDefault();

      event.stopPropagation();

      closeChangeGroupPhoto();

    }
  );

}


// ======================
// SAVE GROUP PHOTO
// ======================

if (saveGroupPhotoBtn) {

  saveGroupPhotoBtn.addEventListener(
    "click",
    async () => {

      if (!selectedGroupId) {

        alert(
          "Please select a group first."
        );

        return;
      }


      if (!auth.currentUser) {

        alert(
          "Please log in first."
        );

        return;
      }


      if (
        currentGroupAdmin !==
        auth.currentUser.uid
      ) {

        alert(
          "Only the group admin can change the group photo."
        );

        return;
      }


      if (!selectedGroupPhotoFile) {

        alert(
          "Please choose a photo first."
        );

        return;
      }


      try {

        saveGroupPhotoBtn.disabled =
          true;

        saveGroupPhotoBtn.textContent =
          "Saving...";


        // =================================
        // READ IMAGE
        // =================================

        const reader =
          new FileReader();


        reader.onload =
          async (event) => {

            try {

              const image =
                new Image();


              image.onload =
                async () => {

                  // =================================
                  // COMPRESS IMAGE
                  // =================================

                  const canvas =
                    document.createElement(
                      "canvas"
                    );


                  const maxSize =
                    500;


                  let width =
                    image.width;

                  let height =
                    image.height;


                  if (
                    width > maxSize ||
                    height > maxSize
                  ) {

                    if (
                      width > height
                    ) {

                      height =
                        Math.round(
                          height *
                          maxSize /
                          width
                        );

                      width =
                        maxSize;

                    } else {

                      width =
                        Math.round(
                          width *
                          maxSize /
                          height
                        );

                      height =
                        maxSize;

                    }

                  }


                  canvas.width =
                    width;

                  canvas.height =
                    height;


                  const context =
                    canvas.getContext(
                      "2d"
                    );


                  context.drawImage(
                    image,
                    0,
                    0,
                    width,
                    height
                  );


                  // =================================
                  // CREATE SMALL DATA URL
                  // =================================

                  const photoURL =
                    canvas.toDataURL(
                      "image/jpeg",
                      0.70
                    );


                  // =================================
                  // SAVE TO FIRESTORE
                  // =================================

                  await updateDoc(
                    doc(
                      db,
                      "groups",
                      selectedGroupId
                    ),
                    {
                      photoURL:
                        photoURL
                    }
                  );


                  // =================================
                  // UPDATE CURRENT ADMIN PHOTO
                  // =================================

                  const adminGroupPhoto =
                    document.getElementById(
                      "adminGroupPhoto"
                    );


                  if (
                    adminGroupPhoto
                  ) {

                    adminGroupPhoto.src =
                      photoURL;

                  }


                  // =================================
                  // UPDATE GROUP INFO PHOTO
                  // =================================

                  const groupInfoPhoto =
                    document.getElementById(
                      "groupInfoPhoto"
                    );


                  if (
                    groupInfoPhoto
                  ) {

                    groupInfoPhoto.src =
                      photoURL;

                  }


                  // =================================
                  // CLOSE PHOTO POPOVER
                  // =================================

                  closeChangeGroupPhoto();


                  // =================================
                  // CLOSE ADMIN POPOVER
                  // =================================

                  if (
                    groupAdminPopover
                  ) {

                    groupAdminPopover.classList.remove(
                      "show"
                    );

                  }


                  // =================================
                  // RELOAD GROUPS
                  // =================================

                  if (
                    typeof loadGroups ===
                    "function"
                  ) {

                    await loadGroups();

                  }


                  alert(
                    "Group photo updated successfully."
                  );

                };


              image.onerror =
                () => {

                  throw new Error(
                    "Could not read the selected image."
                  );

                };


              image.src =
                event.target.result;

            } catch (error) {

              console.error(
                "Image processing error:",
                error
              );

              alert(
                "Failed to process group photo: " +
                error.message
              );

            } finally {

              saveGroupPhotoBtn.disabled =
                false;

              saveGroupPhotoBtn.textContent =
                "Save";

            }

          };


        reader.onerror =
          () => {

            throw new Error(
              "Could not read the selected file."
            );

          };


        reader.readAsDataURL(
          selectedGroupPhotoFile
        );


      } catch (error) {

        console.error(
          "Change group photo error:",
          error
        );

        alert(
          "Failed to change group photo: " +
          error.message
        );


        saveGroupPhotoBtn.disabled =
          false;

        saveGroupPhotoBtn.textContent =
          "Save";

      }

    }
  );

}
// ======================
// GROUP ADMIN POPOVER
// ======================

const groupAdminPopover =
  document.getElementById(
    "groupAdminPopover"
  );

const closeGroupAdminPopover =
  document.getElementById(
    "closeGroupAdminPopover"
  );


// ======================
// CLOSE GROUP ADMIN POPOVER
// ======================

if (
  closeGroupAdminPopover &&
  groupAdminPopover
) {

  closeGroupAdminPopover.addEventListener(
    "click",
    (event) => {

      event.preventDefault();

      event.stopPropagation();

      groupAdminPopover.classList.remove(
        "show"
      );

    }
  );

}
// ======================
// GROUP INFO POPOVER
// ======================

const groupInfoAction =
  document.getElementById(
    "groupInfoAction"
  );

const groupInfoPopover =
  document.getElementById(
    "groupInfoPopover"
  );

const closeGroupInfoPopover =
  document.getElementById(
    "closeGroupInfoPopover"
  );


// ======================
// OPEN GROUP INFO
// ======================

if (
  groupInfoAction &&
  groupInfoPopover
) {

  groupInfoAction.addEventListener(
    "click",
    async () => {

      if (!selectedGroupId) {

        alert(
          "Please select a group first."
        );

        return;
      }

      try {

        const groupSnap =
          await getDoc(
            doc(
              db,
              "groups",
              selectedGroupId
            )
          );

        if (!groupSnap.exists()) {

          alert(
            "Group not found."
          );

          return;
        }

        const group =
          groupSnap.data();

        const members =
          group.members || {};

        const memberIds =
          Object.keys(members);


        // Group name

        const groupName =
          document.getElementById(
            "groupInfoGroupName"
          );

        if (groupName) {

          groupName.textContent =
            group.name ||
            "Unnamed Group";

        }


        // Title

        const infoTitle =
          document.getElementById(
            "groupInfoName"
          );

        if (infoTitle) {

          infoTitle.textContent =
            group.name ||
            "Group Info";

        }


        // Members

        const memberCount =
          document.getElementById(
            "groupInfoMembers"
          );

        if (memberCount) {

          memberCount.textContent =
            memberIds.length;

        }


        // Group ID

        const groupId =
          document.getElementById(
            "groupInfoId"
          );

        if (groupId) {

          groupId.textContent =
            selectedGroupId;

        }


        // ======================
        // GET ADMIN NAME
        // ======================

        const adminElement =
          document.getElementById(
            "groupInfoAdmin"
          );

        if (adminElement) {

          if (group.admin) {

            const adminSnap =
              await getDoc(
                doc(
                  db,
                  "users",
                  group.admin
                )
              );

            if (
              adminSnap.exists()
            ) {

              const admin =
                adminSnap.data();

              adminElement.textContent =
                admin.name ||
                admin.email ||
                "Unknown Admin";

            } else {

              adminElement.textContent =
                "Unknown Admin";

            }

          } else {

            adminElement.textContent =
              "Unknown Admin";

          }

        }


        // ======================
        // CREATED DATE
        // ======================

        const createdElement =
          document.getElementById(
            "groupInfoCreated"
          );

        if (createdElement) {

          if (
            group.createdAt &&
            group.createdAt.toDate
          ) {

            createdElement.textContent =
              group.createdAt
                .toDate()
                .toLocaleDateString(
                  [],
                  {
                    year:
                      "numeric",

                    month:
                      "short",

                    day:
                      "numeric"
                  }
                );

          } else {

            createdElement.textContent =
              "Unknown";

          }

        }


        // ======================
        // SHOW POPOVER
        // ======================

        groupInfoPopover.classList.add(
          "show"
        );

      } catch (error) {

        console.error(
          "Group info error:",
          error
        );

        alert(
          "Failed to load group information: " +
          error.message
        );

      }

    }
  );

}


// ======================
// CLOSE GROUP INFO
// ======================

if (
  closeGroupInfoPopover &&
  groupInfoPopover
) {

  closeGroupInfoPopover.addEventListener(
    "click",
    (event) => {

      event.preventDefault();

      event.stopPropagation();

      groupInfoPopover.classList.remove(
        "show"
      );

    }
  );

}
// ==================================================
// LOAD MY PROFILE POPOVER
// ==================================================

async function loadMyProfilePopover() {

  // ======================
  // CHECK LOGIN
  // ======================

  if (!auth.currentUser) {
    return;
  }


  try {

    const uid =
      auth.currentUser.uid;


    // ======================
    // GET USER DOCUMENT
    // ======================

    const userRef =
      doc(
        db,
        "users",
        uid
      );


    const userSnap =
      await getDoc(
        userRef
      );


    if (!userSnap.exists()) {

      console.error(
        "My profile document not found."
      );

      return;

    }


    const userData =
      userSnap.data();


    // ==================================================
    // PROFILE PHOTO
    // ==================================================

    const photo =
      document.getElementById(
        "myProfilePopoverPhoto"
      );


    if (photo) {

      photo.src =
        userData.photoURL ||
        "images/default-profile.png";

    }


    // ==================================================
    // NAME
    // ==================================================

    const name =
      document.getElementById(
        "myProfilePopoverName"
      );


    if (name) {

      name.textContent =
        userData.name ||
        userData.username ||
        userData.email ||
        "User";

    }


    // ==================================================
    // EMAIL
    // ==================================================

    const email =
      document.getElementById(
        "myProfilePopoverEmail"
      );


    if (email) {

      email.textContent =
        userData.email ||
        auth.currentUser.email ||
        "No email";

    }


    // ==================================================
    // ONLINE STATUS
    // ==================================================

    const status =
      document.getElementById(
        "myProfilePopoverStatus"
      );


    if (status) {

      status.textContent =
        userData.online
          ? "🟢 Online"
          : "⚫ Offline";

    }


    // ==================================================
    // LIKES
    // ==================================================

    const likes =
      document.getElementById(
        "myProfileLikes"
      );


    if (likes) {

      likes.textContent =
        userData.likesCount ||
        0;

    }


    // ==================================================
    // FRIENDS
    // ==================================================

    const friends =
      document.getElementById(
        "myProfileFriends"
      );


    if (friends) {

      friends.textContent =
        userData.friendsCount ||
        0;

    }


    // ==================================================
    // USERNAME
    // ==================================================

    const username =
      document.getElementById(
        "myProfileUsername"
      );


    if (username) {

      username.textContent =
        "Username: " +
        (
          userData.username ||
          userData.name ||
          "Not set"
        );

    }


    // ==================================================
    // AGE
    // ==================================================

    const age =
      document.getElementById(
        "myProfileAge"
      );


    let calculatedAge =
      "—";


    if (userData.dob) {

      const birthDate =
        new Date(
          userData.dob
        );

      const today =
        new Date();


      calculatedAge =
        today.getFullYear() -
        birthDate.getFullYear();


      const monthDifference =
        today.getMonth() -
        birthDate.getMonth();


      if (
        monthDifference < 0 ||
        (
          monthDifference === 0 &&
          today.getDate() <
          birthDate.getDate()
        )
      ) {

        calculatedAge--;

      }

    }


    if (age) {

      age.textContent =
        "Age: " +
        (
          calculatedAge === "—"
            ? "Not set"
            : calculatedAge
        );

    }


    // ==================================================
    // NATIONALITY
    // ==================================================

    const nationality =
      document.getElementById(
        "myProfileNationality"
      );


    if (nationality) {

      nationality.textContent =
        "Nationality: " +
        (
          userData.nationality ||
          "Not set"
        );

    }


    // ==================================================
    // GENDER
    // ==================================================

    const gender =
      document.getElementById(
        "myProfileGender"
      );


    if (gender) {

      gender.textContent =
        "Gender: " +
        (
          userData.gender ||
          "Not set"
        );

    }


    // ==================================================
    // PHONE
    // ==================================================

    const phone =
      document.getElementById(
        "myProfilePhone"
      );


    if (phone) {

      phone.textContent =
        "Phone: " +
        (
          userData.phone ||
          "Not set"
        );

    }


    // ==================================================
    // PROFILE PROGRESS
    // ==================================================

    let completed =
      0;

    let total =
      6;


    if (userData.name) {
      completed++;
    }

    if (
      userData.photoURL
    ) {
      completed++;
    }

    if (userData.dob) {
      completed++;
    }

    if (
      userData.nationality
    ) {
      completed++;
    }

    if (userData.gender) {
      completed++;
    }

    if (userData.phone) {
      completed++;
    }


    const progress =
      Math.round(
        (
          completed /
          total
        ) * 100
      );


    const progressBar =
      document.getElementById(
        "myProfileProgress"
      );


    const progressText =
      document.getElementById(
        "myProfileProgressText"
      );


    if (progressBar) {

      progressBar.style.width =
        progress + "%";

    }


    if (progressText) {

      progressText.textContent =
        progress +
        "% Complete";

    }


  } catch (error) {

    console.error(
      "Load my profile error:",
      error
    );

  }

}
// ==================================================
// EDIT MY PROFILE
// ==================================================

const editMyProfileBtn =
  document.getElementById(
    "editMyProfileBtn"
  );

const editProfilePanel =
  document.getElementById(
    "editProfilePanel"
  );

const cancelEditProfileBtn =
  document.getElementById(
    "cancelEditProfileBtn"
  );

const saveProfileBtn =
  document.getElementById(
    "saveProfileBtn"
  );


// ==================================================
// OPEN EDIT PROFILE
// ==================================================

if (editMyProfileBtn) {

  editMyProfileBtn.addEventListener(
    "click",
    async () => {

      if (!auth.currentUser) {
        return;
      }

      try {

        const userRef =
          doc(
            db,
            "users",
            auth.currentUser.uid
          );

        const userSnap =
          await getDoc(
            userRef
          );

        if (!userSnap.exists()) {
          return;
        }

        const userData =
          userSnap.data();


        // ======================
        // FILL FORM
        // ======================

        document.getElementById(
          "editProfileUsername"
        ).value =
          userData.username ||
          "";

        document.getElementById(
          "editProfileName"
        ).value =
          userData.name ||
          "";

        document.getElementById(
          "editProfileDob"
        ).value =
          userData.dob ||
          "";

        document.getElementById(
          "editProfileNationality"
        ).value =
          userData.nationality ||
          "";

        document.getElementById(
          "editProfileGender"
        ).value =
          userData.gender ||
          "";

        document.getElementById(
          "editProfilePhone"
        ).value =
          userData.phone ||
          "";


        // ======================
        // SHOW EDIT PANEL
        // ======================

        if (editProfilePanel) {

          editProfilePanel.style.display =
            "block";

        }

        editMyProfileBtn.style.display =
          "none";


      } catch (error) {

        console.error(
          "Open edit profile error:",
          error
        );

      }

    }
  );

}


// ==================================================
// CANCEL EDIT
// ==================================================

if (cancelEditProfileBtn) {

  cancelEditProfileBtn.addEventListener(
    "click",
    () => {

      if (editProfilePanel) {

        editProfilePanel.style.display =
          "none";

      }

      if (editMyProfileBtn) {

        editMyProfileBtn.style.display =
          "block";

      }

    }
  );

}


// ==================================================
// SAVE PROFILE
// ==================================================

if (saveProfileBtn) {

  saveProfileBtn.addEventListener(
    "click",
    async () => {

      if (!auth.currentUser) {

        alert(
          "Please log in first."
        );

        return;

      }


      try {

        const username =
          document.getElementById(
            "editProfileUsername"
          ).value.trim();

        const name =
          document.getElementById(
            "editProfileName"
          ).value.trim();

        const dob =
          document.getElementById(
            "editProfileDob"
          ).value;

        const nationality =
          document.getElementById(
            "editProfileNationality"
          ).value.trim();

        const gender =
          document.getElementById(
            "editProfileGender"
          ).value;

        const phone =
          document.getElementById(
            "editProfilePhone"
          ).value.trim();


        // ======================
        // UPDATE FIREBASE
        // ======================

        await updateDoc(
          doc(
            db,
            "users",
            auth.currentUser.uid
          ),
          {

            username:
              username,

            name:
              name,

            dob:
              dob,

            nationality:
              nationality,

            gender:
              gender,

            phone:
              phone

          }
        );


        // ======================
        // REFRESH PROFILE
        // ======================

        await loadMyProfilePopover();


        // ======================
        // CLOSE EDIT PANEL
        // ======================

        if (editProfilePanel) {

          editProfilePanel.style.display =
            "none";

        }

        if (editMyProfileBtn) {

          editMyProfileBtn.style.display =
            "block";

        }


        // ======================
        // UPDATE MAIN USERNAME
        // ======================

        const usernameDisplay =
          document.getElementById(
            "username"
          );

        if (usernameDisplay) {

          usernameDisplay.textContent =
            name ||
            username ||
            "User";

        }


        alert(
          "Profile updated successfully!"
        );


      } catch (error) {

        console.error(
          "Save profile error:",
          error
        );

        alert(
          "Could not update profile: " +
          error.message
        );

      }

    }
  );

}
        // ==================================================
// LOAD MY PROFILE PICTURE
// ==================================================

async function loadMyProfilePicture() {

  if (!auth.currentUser) {
    return;
  }

  try {

    const userRef = doc(
      db,
      "users",
      auth.currentUser.uid
    );

    const userSnap =
      await getDoc(userRef);

    if (!userSnap.exists()) {
      return;
    }

    const userData =
      userSnap.data();

    const photoURL =
      userData.photoURL ||
      "images/default-profile.png";


    // ======================
    // MAIN PROFILE PICTURE
    // ======================

    const profilePic =
      document.getElementById(
        "profilePic"
      );

    if (profilePic) {

      profilePic.src =
        photoURL;

    }


    // ======================
    // PROFILE POPOVER PHOTO
    // ======================

    const popoverPhoto =
      document.getElementById(
        "myProfilePopoverPhoto"
      );

    if (popoverPhoto) {

      popoverPhoto.src =
        photoURL;

    }

  } catch (error) {

    console.error(
      "Load profile picture error:",
      error
    );

  }

}
// ==================================================
// CHANGE PROFILE PHOTO FROM PHONE
// ==================================================

const changeMyProfilePhotoBtn =
  document.getElementById(
    "changeMyProfilePhotoBtn"
  );

const imageInput =
  document.getElementById(
    "imageInput"
  );


if (
  changeMyProfilePhotoBtn &&
  imageInput
) {

  changeMyProfilePhotoBtn.addEventListener(
    "click",
    () => {

      imageInput.click();

    }
  );


  imageInput.addEventListener(
    "change",
    async () => {

      if (!auth.currentUser) {

        alert(
          "Please log in first."
        );

        return;

      }


      const file =
        imageInput.files[0];


      if (!file) {
        return;
      }


      // ======================
      // CHECK IMAGE
      // ======================

      if (!file.type.startsWith("image/")) {

        alert(
          "Please choose an image."
        );

        imageInput.value = "";

        return;

      }


      try {

        changeMyProfilePhotoBtn.textContent =
          "⏳ Processing...";

        changeMyProfilePhotoBtn.disabled =
          true;


        // ======================
        // CREATE IMAGE
        // ======================

        const image =
          new Image();

        const reader =
          new FileReader();


        reader.onload =
          async function () {

            image.onload =
              async function () {

                // ======================
                // RESIZE IMAGE
                // ======================

                const maxSize = 500;

                let width =
                  image.width;

                let height =
                  image.height;


                if (
                  width > maxSize ||
                  height > maxSize
                ) {

                  if (
                    width > height
                  ) {

                    height =
                      Math.round(
                        height *
                        maxSize /
                        width
                      );

                    width =
                      maxSize;

                  } else {

                    width =
                      Math.round(
                        width *
                        maxSize /
                        height
                      );

                    height =
                      maxSize;

                  }

                }


                // ======================
                // CANVAS
                // ======================

                const canvas =
                  document.createElement(
                    "canvas"
                  );

                canvas.width =
                  width;

                canvas.height =
                  height;


                const context =
                  canvas.getContext(
                    "2d"
                  );


                context.drawImage(
                  image,
                  0,
                  0,
                  width,
                  height
                );


                // ======================
                // COMPRESS IMAGE
                // ======================

                const photoURL =
                  canvas.toDataURL(
                    "image/jpeg",
                    0.75
                  );


                // ======================
                // SAVE TO FIRESTORE
                // ======================

                await updateDoc(
                  doc(
                    db,
                    "users",
                    auth.currentUser.uid
                  ),
                  {
                    photoURL:
                      photoURL
                  }
                );


                // ======================
                // UPDATE MAIN PHOTO
                // ======================

                const profilePic =
                  document.getElementById(
                    "profilePic"
                  );


                if (profilePic) {

                  profilePic.src =
                    photoURL;

                }


                // ======================
                // UPDATE POPOVER PHOTO
                // ======================

                const popoverPhoto =
                  document.getElementById(
                    "myProfilePopoverPhoto"
                  );


                if (popoverPhoto) {

                  popoverPhoto.src =
                    photoURL;

                }


                // ======================
                // REFRESH PROFILE
                // ======================

                await loadMyProfilePopover();


                alert(
                  "Profile picture updated successfully!"
                );


                changeMyProfilePhotoBtn.textContent =
                  "📷 Change Photo";

                changeMyProfilePhotoBtn.disabled =
                  false;

                imageInput.value =
                  "";

              };


            image.onerror =
              function () {

                throw new Error(
                  "Could not process the image."
                );

              };


            image.src =
              reader.result;

          };


        reader.readAsDataURL(
          file
        );


      } catch (error) {

        console.error(
          "Profile photo error:",
          error
        );


        alert(
          "Could not update profile picture: " +
          error.message
        );


        changeMyProfilePhotoBtn.textContent =
          "📷 Change Photo";

        changeMyProfilePhotoBtn.disabled =
          false;

        imageInput.value =
          "";

      }

    }
  );

}
// ======================
// SIDEBAR MENU
// ======================

const sidebar =
  document.getElementById("sidebar");

const sidebarMenuBtn =
  document.getElementById("sidebarMenuBtn");

const sidebarOverlay =
  document.getElementById("sidebarOverlay");


// ======================
// OPEN SIDEBAR
// ======================

function openSidebar() {

  if (sidebar) {
    sidebar.classList.add("sidebar-open");
  }

  if (sidebarOverlay) {
    sidebarOverlay.classList.add("active");
  }

}


// ======================
// CLOSE SIDEBAR
// ======================

function closeSidebar() {

  if (sidebar) {
    sidebar.classList.remove("sidebar-open");
  }

  if (sidebarOverlay) {
    sidebarOverlay.classList.remove("active");
  }

}


// ======================
// MENU BUTTON
// ======================

if (sidebarMenuBtn) {

  sidebarMenuBtn.addEventListener(
    "click",
    () => {

      if (
        sidebar &&
        sidebar.classList.contains(
          "sidebar-open"
        )
      ) {

        closeSidebar();

      } else {

        openSidebar();

      }

    }
  );

}


// ======================
// CLICK OUTSIDE
// ======================

if (sidebarOverlay) {

  sidebarOverlay.addEventListener(
    "click",
    closeSidebar
  );

}
// =====================================
// RIGHT SIDEBAR FEATURES
// =====================================

const rightProfileBtn =
  document.getElementById("rightProfileBtn");

const rightSettingsBtn =
  document.getElementById("rightSettingsBtn");

const rightPrivacyBtn =
  document.getElementById("rightPrivacyBtn");

const rightNotificationsBtn =
  document.getElementById("rightNotificationsBtn");

const rightHelpBtn =
  document.getElementById("rightHelpBtn");

const rightDeleteAccountBtn =
  document.getElementById("rightDeleteAccountBtn");


// =====================================
// PROFILE
// =====================================

if (rightProfileBtn) {

  rightProfileBtn.addEventListener(
    "click",
    () => {

      /*
       * You already have your
       * profile-popover.
       *
       * We will connect it here.
       */

      const profilePopover =
        document.querySelector(
          ".profile-popover"
        );

      if (profilePopover) {

        profilePopover.classList.toggle(
          "show"
        );

      }

    }
  );

}
// =====================================
// SETTINGS POPOVER
// =====================================

const settingsPopover =
  document.getElementById(
    "settingsPopover"
  );

const settingsCloseBtn =
  document.getElementById(
    "settingsCloseBtn"
  );


if (rightSettingsBtn) {

  rightSettingsBtn.addEventListener(
    "click",
    () => {

      if (!settingsPopover) {
        return;
      }

      settingsPopover.classList.add(
        "show"
      );

    }
  );

}


if (settingsCloseBtn) {

  settingsCloseBtn.addEventListener(
    "click",
    () => {

      settingsPopover.classList.remove(
        "show"
      );

    }
  );

}
// =====================================
// PRIVACY
// =====================================

if (rightPrivacyBtn) {

  rightPrivacyBtn.addEventListener(
    "click",
    () => {

      alert("Privacy settings coming next.");

    }
  );

}
// =====================================
// 
// =====================================
// SETTINGS → NOTIFICATIONS
// =====================================

const settingsNotificationsBtn =
  document.getElementById(
    "settingsNotificationsBtn"
  );

const notificationsPopover =
  document.getElementById(
    "notificationsPopover"
  );


if (
  settingsNotificationsBtn &&
  notificationsPopover
) {

  settingsNotificationsBtn.addEventListener(
    "click",
    () => {

      notificationsPopover.classList.add(
        "show"
      );

    }
  );

}
// =====================================
// CLOSE NOTIFICATIONS
// =====================================

const notificationsCloseBtn =
  document.getElementById(
    "notificationsCloseBtn"
  );

if (notificationsCloseBtn) {

  notificationsCloseBtn.addEventListener(
    "click",
    () => {

      const notificationsPopover =
        document.getElementById(
          "notificationsPopover"
        );

      if (notificationsPopover) {

        notificationsPopover.classList.remove(
          "show"
        );

      }

    }
  );

}
// =====================================
// HELP
// =====================================

if (rightHelpBtn) {

  rightHelpBtn.addEventListener(
    "click",
    () => {

      alert("Help & Support coming next.");

    }
  );

}


// =====================================
// DELETE ACCOUNT
// =====================================

if (rightDeleteAccountBtn) {

  rightDeleteAccountBtn.addEventListener(
    "click",
    () => {

      const confirmed =
        confirm(
          "⚠️ Are you sure you want to delete your account?"
        );

      if (!confirmed) {
        return;
      }

      alert(
        "Account deletion will be connected next."
      );

    }
  );

}
// =====================================
// DELETE ACCOUNT POPOVER
// =====================================

if (rightDeleteAccountBtn) {

  rightDeleteAccountBtn.addEventListener(
    "click",
    () => {

      const deletePopover =
        document.getElementById(
          "deleteAccountPopover"
        );

      if (deletePopover) {

        deletePopover.classList.add(
          "show"
        );

      }

    }
  );

}
// =====================================
// CLOSE DELETE ACCOUNT POPOVER
// =====================================

const deleteAccountCloseBtn =
  document.getElementById(
    "deleteAccountCloseBtn"
  );

const cancelDeleteAccountBtn =
  document.getElementById(
    "cancelDeleteAccountBtn"
  );


function closeDeleteAccountPopover() {

  const deletePopover =
    document.getElementById(
      "deleteAccountPopover"
    );

  if (deletePopover) {

    deletePopover.classList.remove(
      "show"
    );

  }

}


if (deleteAccountCloseBtn) {

  deleteAccountCloseBtn.addEventListener(
    "click",
    closeDeleteAccountPopover
  );

}


if (cancelDeleteAccountBtn) {

  cancelDeleteAccountBtn.addEventListener(
    "click",
    closeDeleteAccountPopover
  );

}
// =====================================
// SETTINGS → PRIVACY
// =====================================

const settingsPrivacyBtn =
  document.getElementById(
    "settingsPrivacyBtn"
  );

const privacyPopover =
  document.getElementById(
    "privacyPopover"
  );


if (
  settingsPrivacyBtn &&
  privacyPopover
) {

  settingsPrivacyBtn.addEventListener(
    "click",
    () => {

      privacyPopover.classList.add(
        "show"
      );

    }
  );

}


// =====================================
// CLOSE PRIVACY
// =====================================

const privacyCloseBtn =
  document.getElementById(
    "privacyCloseBtn"
  );


if (privacyCloseBtn) {

  privacyCloseBtn.addEventListener(
    "click",
    () => {

      const privacyPopover =
        document.getElementById(
          "privacyPopover"
        );

      if (privacyPopover) {

        privacyPopover.classList.remove(
          "show"
        );

      }

    }
  );

}
// =====================================
// SETTINGS → ACCOUNT
// =====================================

const settingsAccountBtn =
  document.getElementById(
    "settingsAccountBtn"
  );

const accountPopover =
  document.getElementById(
    "accountPopover"
  );

const accountCloseBtn =
  document.getElementById(
    "accountCloseBtn"
  );


if (
  settingsAccountBtn &&
  accountPopover
) {

  settingsAccountBtn.addEventListener(
    "click",
    () => {

      // Close Settings
      const settingsPopover =
        document.getElementById(
          "settingsPopover"
        );

      if (settingsPopover) {

        settingsPopover.classList.remove(
          "show"
        );

      }

      // Open Account
      accountPopover.classList.add(
        "show"
      );

    }
  );

}


// =====================================
// CLOSE ACCOUNT POPOVER
// =====================================

if (
  accountCloseBtn &&
  accountPopover
) {

  accountCloseBtn.addEventListener(
    "click",
    () => {

      accountPopover.classList.remove(
        "show"
      );

    }
  );

}
// =====================================
// SETTINGS → APPEARANCE
// =====================================

const settingsAppearanceBtn =
  document.getElementById(
    "settingsAppearanceBtn"
  );

const appearancePopover =
  document.getElementById(
    "appearancePopover"
  );

const appearanceCloseBtn =
  document.getElementById(
    "appearanceCloseBtn"
  );


if (
  settingsAppearanceBtn &&
  appearancePopover
) {

  settingsAppearanceBtn.addEventListener(
    "click",
    () => {

      // Close Settings
      const settingsPopover =
        document.getElementById(
          "settingsPopover"
        );

      if (settingsPopover) {

        settingsPopover.classList.remove(
          "show"
        );

      }

      // Open Appearance
      appearancePopover.classList.add(
        "show"
      );

    }
  );

}


// =====================================
// CLOSE APPEARANCE
// =====================================

if (
  appearanceCloseBtn &&
  appearancePopover
) {

  appearanceCloseBtn.addEventListener(
    "click",
    () => {

      appearancePopover.classList.remove(
        "show"
      );

    }
  );

}
// =====================================
// APPEARANCE → DARK MODE
// =====================================

const appearanceDarkModeBtn =
  document.getElementById(
    "appearanceDarkModeBtn"
  );


if (appearanceDarkModeBtn) {

  appearanceDarkModeBtn.addEventListener(
    "click",
    () => {

      // Use your existing dark mode button
      const darkModeBtn =
        document.getElementById(
          "darkModeBtn"
        );

      if (darkModeBtn) {

        darkModeBtn.click();

      }

      // Keep Appearance open
      // so the user can choose another option

    }
  );

}
// =====================================
// APPEARANCE → LIGHT MODE
// =====================================

const appearanceLightModeBtn =
  document.getElementById(
    "appearanceLightModeBtn"
  );


if (appearanceLightModeBtn) {

  appearanceLightModeBtn.addEventListener(
    "click",
    () => {

      // Check if dark mode is currently active
      if (
        document.body.classList.contains(
          "dark-mode"
        )
      ) {

        const darkModeBtn =
          document.getElementById(
            "darkModeBtn"
          );

        if (darkModeBtn) {

          darkModeBtn.click();

        }

      }

    }
  );

}
// =====================================
// APPEARANCE → SYSTEM DEFAULT
// =====================================

const appearanceSystemBtn =
  document.getElementById(
    "appearanceSystemBtn"
  );


if (appearanceSystemBtn) {

  appearanceSystemBtn.addEventListener(
    "click",
    () => {

      const prefersDark =
        window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;


      if (prefersDark) {

        // Turn dark mode ON
        if (
          !document.body.classList.contains(
            "dark-mode"
          )
        ) {

          const darkModeBtn =
            document.getElementById(
              "darkModeBtn"
            );

          if (darkModeBtn) {

            darkModeBtn.click();

          }

        }

      } else {

        // Turn dark mode OFF
        if (
          document.body.classList.contains(
            "dark-mode"
          )
        ) {

          const darkModeBtn =
            document.getElementById(
              "darkModeBtn"
            );

          if (darkModeBtn) {

            darkModeBtn.click();

          }

        }

      }

    }
  );

}
// =====================================
// APPEARANCE → TEXT SIZE
// =====================================

const appearanceTextSizeBtn =
  document.getElementById(
    "appearanceTextSizeBtn"
  );

const textSizePopover =
  document.getElementById(
    "textSizePopover"
  );

const textSizeCloseBtn =
  document.getElementById(
    "textSizeCloseBtn"
  );


// =====================================
// OPEN TEXT SIZE
// =====================================

if (
  appearanceTextSizeBtn &&
  textSizePopover
) {

  appearanceTextSizeBtn.addEventListener(
    "click",
    () => {

      // Close Appearance
      if (appearancePopover) {

        appearancePopover.classList.remove(
          "show"
        );

      }

      // Open Text Size
      textSizePopover.classList.add(
        "show"
      );

    }
  );

}


// =====================================
// CLOSE TEXT SIZE
// =====================================

if (
  textSizeCloseBtn &&
  textSizePopover
) {

  textSizeCloseBtn.addEventListener(
    "click",
    () => {

      textSizePopover.classList.remove(
        "show"
      );

    }
  );

}
// =====================================
// TEXT SIZE OPTIONS
// =====================================

const textSmallBtn =
  document.getElementById(
    "textSmallBtn"
  );

const textNormalBtn =
  document.getElementById(
    "textNormalBtn"
  );

const textLargeBtn =
  document.getElementById(
    "textLargeBtn"
  );


// =====================================
// CHANGE TEXT SIZE
// =====================================

function setTextSize(size) {

  document.body.classList.remove(
    "text-size-small",
    "text-size-normal",
    "text-size-large"
  );

  document.body.classList.add(
    "text-size-" + size
  );

}


// =====================================
// SMALL
// =====================================

if (textSmallBtn) {

  textSmallBtn.addEventListener(
    "click",
    () => {

      setTextSize("small");

    }
  );

}


// =====================================
// NORMAL
// =====================================

if (textNormalBtn) {

  textNormalBtn.addEventListener(
    "click",
    () => {

      setTextSize("normal");

    }
  );

}


// =====================================
// LARGE
// =====================================

if (textLargeBtn) {

  textLargeBtn.addEventListener(
    "click",
    () => {

      setTextSize("large");

    }
  );

}
// =====================================
// APPEARANCE → ANIMATIONS
// =====================================

const appearanceAnimationBtn =
  document.getElementById(
    "appearanceAnimationBtn"
  );

const animationPopover =
  document.getElementById(
    "animationPopover"
  );

const animationCloseBtn =
  document.getElementById(
    "animationCloseBtn"
  );


// =====================================
// OPEN ANIMATIONS
// =====================================

if (
  appearanceAnimationBtn &&
  animationPopover
) {

  appearanceAnimationBtn.addEventListener(
    "click",
    () => {

      // Close Appearance
      if (appearancePopover) {

        appearancePopover.classList.remove(
          "show"
        );

      }

      // Open Animations
      animationPopover.classList.add(
        "show"
      );

    }
  );

}


// =====================================
// CLOSE ANIMATIONS
// =====================================

if (
  animationCloseBtn &&
  animationPopover
) {

  animationCloseBtn.addEventListener(
    "click",
    () => {

      animationPopover.classList.remove(
        "show"
      );

    }
  );

}
// =====================================
// ANIMATIONS ON / OFF
// =====================================

const animationsOnBtn =
  document.getElementById(
    "animationsOnBtn"
  );

const animationsOffBtn =
  document.getElementById(
    "animationsOffBtn"
  );


// =====================================
// ANIMATIONS ON
// =====================================

if (animationsOnBtn) {

  animationsOnBtn.addEventListener(
    "click",
    () => {

      document.body.classList.remove(
        "animations-off"
      );

    }
  );

}


// =====================================
// ANIMATIONS OFF
// =====================================

if (animationsOffBtn) {

  animationsOffBtn.addEventListener(
    "click",
    () => {

      document.body.classList.add(
        "animations-off"
      );

    }
  );

}
// =====================================
// PRIVACY → ONLINE STATUS
// SAFE VERSION
// =====================================

(function () {

  const onlineBtn =
    document.getElementById(
      "onlineStatusPrivacyBtn"
    );

  const onlinePopover =
    document.getElementById(
      "onlineStatusPopover"
    );

  const closeBtn =
    document.getElementById(
      "onlineStatusCloseBtn"
    );

  const privacy =
    document.getElementById(
      "privacyPopover"
    );


  // OPEN ONLINE STATUS

  if (
    onlineBtn &&
    onlinePopover
  ) {

    onlineBtn.addEventListener(
      "click",
      function () {

        if (privacy) {

          privacy.classList.remove(
            "show"
          );

        }

        onlinePopover.classList.add(
          "show"
        );

      }
    );

  }


  // CLOSE ONLINE STATUS

  if (
    closeBtn &&
    onlinePopover
  ) {

    closeBtn.addEventListener(
      "click",
      function () {

        onlinePopover.classList.remove(
          "show"
        );

      }
    );

  }

})();
// =====================================
// ONLINE STATUS OPTIONS
// =====================================

(function () {

  const everyoneBtn =
    document.getElementById(
      "onlineEveryoneBtn"
    );

  const friendsBtn =
    document.getElementById(
      "onlineFriendsBtn"
    );

  const nobodyBtn =
    document.getElementById(
      "onlineNobodyBtn"
    );


  function selectOnlineStatus(
    selectedBtn
  ) {

    const buttons = [
      everyoneBtn,
      friendsBtn,
      nobodyBtn
    ];


    buttons.forEach(
      function (button) {

        if (!button) {
          return;
        }

        button.classList.remove(
          "selected"
        );

        const check =
          button.querySelector(
            ".privacy-check"
          );

        if (check) {
          check.remove();
        }

      }
    );


    if (selectedBtn) {

      selectedBtn.classList.add(
        "selected"
      );


      const check =
        document.createElement(
          "span"
        );

      check.className =
        "privacy-check";

      check.textContent =
        "✓";

      selectedBtn.appendChild(
        check
      );

    }

  }


  if (everyoneBtn) {

    everyoneBtn.addEventListener(
      "click",
      function () {

        selectOnlineStatus(
          everyoneBtn
        );

      }
    );

  }


  if (friendsBtn) {

    friendsBtn.addEventListener(
      "click",
      function () {

        selectOnlineStatus(
          friendsBtn
        );

      }
    );

  }


  if (nobodyBtn) {

    nobodyBtn.addEventListener(
      "click",
      function () {

        selectOnlineStatus(
          nobodyBtn
        );

      }
    );

  }

})();
// =====================================
// SAVE ONLINE STATUS PRIVACY
// =====================================

(function () {

  async function saveOnlinePrivacy(
    setting
  ) {

    if (!auth.currentUser) {

      alert("Please log in first.");

      return;

    }


    try {

      await updateDoc(

        doc(
          db,
          "users",
          auth.currentUser.uid
        ),

        {
          onlineStatusPrivacy:
            setting
        }

      );


      console.log(
        "Online status privacy saved:",
        setting
      );

    } catch (error) {

      console.error(
        "Privacy save error:",
        error
      );

      alert(
        "Could not save privacy setting."
      );

    }

  }


  const everyone =
    document.getElementById(
      "onlineEveryoneBtn"
    );

  const friends =
    document.getElementById(
      "onlineFriendsBtn"
    );

  const nobody =
    document.getElementById(
      "onlineNobodyBtn"
    );


  if (everyone) {

    everyone.addEventListener(
      "click",
      function () {

        saveOnlinePrivacy(
          "everyone"
        );

      }
    );

  }


  if (friends) {

    friends.addEventListener(
      "click",
      function () {

        saveOnlinePrivacy(
          "friends"
        );

      }
    );

  }


  if (nobody) {

    nobody.addEventListener(
      "click",
      function () {

        saveOnlinePrivacy(
          "nobody"
        );

      }
    );

  }

})();
// =====================================
// LOAD ONLINE STATUS PRIVACY
// =====================================

(function () {

  async function loadOnlinePrivacy() {

    if (!auth.currentUser) {
      return;
    }


    try {

      const userRef =
        doc(
          db,
          "users",
          auth.currentUser.uid
        );


      const userSnap =
        await getDoc(userRef);


      if (!userSnap.exists()) {
        return;
      }


      const data =
        userSnap.data();


      const setting =
        data.onlineStatusPrivacy ||
        "everyone";


      const buttons = {

        everyone:
          document.getElementById(
            "onlineEveryoneBtn"
          ),

        friends:
          document.getElementById(
            "onlineFriendsBtn"
          ),

        nobody:
          document.getElementById(
            "onlineNobodyBtn"
          )

      };


      Object.values(buttons).forEach(
        function (button) {

          if (!button) {
            return;
          }

          button.classList.remove(
            "selected"
          );

          const check =
            button.querySelector(
              ".privacy-check"
            );

          if (check) {
            check.remove();
          }

        }
      );


      const selected =
        buttons[setting];


      if (selected) {

        selected.classList.add(
          "selected"
        );


        const check =
          document.createElement(
            "span"
          );

        check.className =
          "privacy-check";

        check.textContent =
          "✓";

        selected.appendChild(
          check
        );

      }


    } catch (error) {

      console.error(
        "Load privacy setting error:",
        error
      );

    }

  }


  const onlineStatusPrivacyBtn =
    document.getElementById(
      "onlineStatusPrivacyBtn"
    );


  if (onlineStatusPrivacyBtn) {

    onlineStatusPrivacyBtn.addEventListener(
      "click",
      function () {

        loadOnlinePrivacy();

      }
    );

  }

})();
// =====================================
// ACCOUNT → PROFILE VISIBILITY
// =====================================

(function () {

  const profileVisibilityBtn =
    document.getElementById(
      "profileVisibilityBtn"
    );

  const profileVisibilityPopover =
    document.getElementById(
      "profileVisibilityPopover"
    );

  const profileVisibilityCloseBtn =
    document.getElementById(
      "profileVisibilityCloseBtn"
    );


  // OPEN

  if (
    profileVisibilityBtn &&
    profileVisibilityPopover
  ) {

    profileVisibilityBtn.addEventListener(
      "click",
      function () {

        const accountPopover =
          document.getElementById(
            "accountPopover"
          );

        if (accountPopover) {

          accountPopover.classList.remove(
            "show"
          );

        }

        profileVisibilityPopover.classList.add(
          "show"
        );

      }
    );

  }


  // CLOSE

  if (
    profileVisibilityCloseBtn &&
    profileVisibilityPopover
  ) {

    profileVisibilityCloseBtn.addEventListener(
      "click",
      function () {

        profileVisibilityPopover.classList.remove(
          "show"
        );

      }
    );

  }

})();
// =====================================
// PROFILE VISIBILITY OPTIONS
// =====================================

(function () {

  const everyoneBtn =
    document.getElementById(
      "profileEveryoneBtn"
    );

  const friendsBtn =
    document.getElementById(
      "profileFriendsBtn"
    );

  const nobodyBtn =
    document.getElementById(
      "profileNobodyBtn"
    );


  function selectProfileVisibility(
    selectedBtn
  ) {

    const buttons = [
      everyoneBtn,
      friendsBtn,
      nobodyBtn
    ];


    buttons.forEach(
      function (button) {

        if (!button) {
          return;
        }

        button.classList.remove(
          "selected"
        );


        const check =
          button.querySelector(
            ".privacy-check"
          );

        if (check) {
          check.remove();
        }

      }
    );


    if (selectedBtn) {

      selectedBtn.classList.add(
        "selected"
      );


      const check =
        document.createElement(
          "span"
        );

      check.className =
        "privacy-check";

      check.textContent =
        "✓";

      selectedBtn.appendChild(
        check
      );

    }

  }


  if (everyoneBtn) {

    everyoneBtn.addEventListener(
      "click",
      function () {

        selectProfileVisibility(
          everyoneBtn
        );

      }
    );

  }


  if (friendsBtn) {

    friendsBtn.addEventListener(
      "click",
      function () {

        selectProfileVisibility(
          friendsBtn
        );

      }
    );

  }


  if (nobodyBtn) {

    nobodyBtn.addEventListener(
      "click",
      function () {

        selectProfileVisibility(
          nobodyBtn
        );

      }
    );

  }

})();
// =====================================
// SAVE PROFILE VISIBILITY
// =====================================

(function () {

  async function saveProfileVisibility(
    setting
  ) {

    if (!auth.currentUser) {

      alert("Please log in first.");

      return;

    }


    try {

      await updateDoc(

        doc(
          db,
          "users",
          auth.currentUser.uid
        ),

        {
          profileVisibility:
            setting
        }

      );


      console.log(
        "Profile visibility saved:",
        setting
      );

    } catch (error) {

      console.error(
        "Profile visibility save error:",
        error
      );

      alert(
        "Could not save profile visibility."
      );

    }

  }


  const everyone =
    document.getElementById(
      "profileEveryoneBtn"
    );

  const friends =
    document.getElementById(
      "profileFriendsBtn"
    );

  const nobody =
    document.getElementById(
      "profileNobodyBtn"
    );


  if (everyone) {

    everyone.addEventListener(
      "click",
      function () {

        saveProfileVisibility(
          "everyone"
        );

      }
    );

  }


  if (friends) {

    friends.addEventListener(
      "click",
      function () {

        saveProfileVisibility(
          "friends"
        );

      }
    );

  }


  if (nobody) {

    nobody.addEventListener(
      "click",
      function () {

        saveProfileVisibility(
          "nobody"
        );

      }
    );

  }

})();
// =====================================
// LOAD PROFILE VISIBILITY
// =====================================

(function () {

  async function loadProfileVisibility() {

    if (!auth.currentUser) {
      return;
    }


    try {

      const userRef =
        doc(
          db,
          "users",
          auth.currentUser.uid
        );


      const userSnap =
        await getDoc(userRef);


      if (!userSnap.exists()) {
        return;
      }


      const data =
        userSnap.data();


      const setting =
        data.profileVisibility ||
        "everyone";


      const buttons = {

        everyone:
          document.getElementById(
            "profileEveryoneBtn"
          ),

        friends:
          document.getElementById(
            "profileFriendsBtn"
          ),

        nobody:
          document.getElementById(
            "profileNobodyBtn"
          )

      };


      // Remove old selections

      Object.values(buttons).forEach(
        function (button) {

          if (!button) {
            return;
          }


          button.classList.remove(
            "selected"
          );


          const check =
            button.querySelector(
              ".privacy-check"
            );


          if (check) {
            check.remove();
          }

        }
      );


      // Select saved option

      const selected =
        buttons[setting];


      if (selected) {

        selected.classList.add(
          "selected"
        );


        const check =
          document.createElement(
            "span"
          );


        check.className =
          "privacy-check";


        check.textContent =
          "✓";


        selected.appendChild(
          check
        );

      }


    } catch (error) {

      console.error(
        "Load profile visibility error:",
        error
      );

    }

  }


  const profileVisibilityBtn =
    document.getElementById(
      "profileVisibilityBtn"
    );


  if (profileVisibilityBtn) {

    profileVisibilityBtn.addEventListener(
      "click",
      function () {

        loadProfileVisibility();

      }
    );

  }

})();
// =====================================
// PRIVACY → MESSAGE REQUESTS
// SAFE VERSION
// =====================================

(function () {

  const messageBtn =
    document.getElementById(
      "messagePrivacyBtn"
    );

  const messagePopover =
    document.getElementById(
      "messagePrivacyPopover"
    );

  const closeBtn =
    document.getElementById(
      "messagePrivacyCloseBtn"
    );


  // OPEN MESSAGE REQUESTS

  if (
    messageBtn &&
    messagePopover
  ) {

    messageBtn.addEventListener(
      "click",
      function () {

        const privacy =
          document.getElementById(
            "privacyPopover"
          );

        if (privacy) {

          privacy.classList.remove(
            "show"
          );

        }

        messagePopover.classList.add(
          "show"
        );

      }
    );

  }


  // CLOSE MESSAGE REQUESTS

  if (
    closeBtn &&
    messagePopover
  ) {

    closeBtn.addEventListener(
      "click",
      function () {

        messagePopover.classList.remove(
          "show"
        );

      }
    );

  }

})();
// =====================================
// MESSAGE REQUEST PRIVACY OPTIONS
// =====================================

(function () {

  const everyoneBtn =
    document.getElementById(
      "messageEveryoneBtn"
    );

  const friendsBtn =
    document.getElementById(
      "messageFriendsBtn"
    );

  const nobodyBtn =
    document.getElementById(
      "messageNobodyBtn"
    );


  function selectMessagePrivacy(
    selectedBtn
  ) {

    const buttons = [
      everyoneBtn,
      friendsBtn,
      nobodyBtn
    ];


    buttons.forEach(
      function (button) {

        if (!button) {
          return;
        }


        button.classList.remove(
          "selected"
        );


        const check =
          button.querySelector(
            ".privacy-check"
          );


        if (check) {
          check.remove();
        }

      }
    );


    if (selectedBtn) {

      selectedBtn.classList.add(
        "selected"
      );


      const check =
        document.createElement(
          "span"
        );


      check.className =
        "privacy-check";


      check.textContent =
        "✓";


      selectedBtn.appendChild(
        check
      );

    }

  }


  if (everyoneBtn) {

    everyoneBtn.addEventListener(
      "click",
      function () {

        selectMessagePrivacy(
          everyoneBtn
        );

      }
    );

  }


  if (friendsBtn) {

    friendsBtn.addEventListener(
      "click",
      function () {

        selectMessagePrivacy(
          friendsBtn
        );

      }
    );

  }


  if (nobodyBtn) {

    nobodyBtn.addEventListener(
      "click",
      function () {

        selectMessagePrivacy(
          nobodyBtn
        );

      }
    );

  }

})();
// =====================================
// SAVE MESSAGE REQUEST PRIVACY
// =====================================

(function () {

  async function saveMessagePrivacy(
    setting
  ) {

    if (!auth.currentUser) {

      alert("Please log in first.");

      return;

    }


    try {

      await updateDoc(

        doc(
          db,
          "users",
          auth.currentUser.uid
        ),

        {
          messageRequestPrivacy:
            setting
        }

      );


      console.log(
        "Message request privacy saved:",
        setting
      );

    } catch (error) {

      console.error(
        "Message request privacy error:",
        error
      );

      alert(
        "Could not save message request setting."
      );

    }

  }


  const everyone =
    document.getElementById(
      "messageEveryoneBtn"
    );

  const friends =
    document.getElementById(
      "messageFriendsBtn"
    );

  const nobody =
    document.getElementById(
      "messageNobodyBtn"
    );


  if (everyone) {

    everyone.addEventListener(
      "click",
      function () {

        saveMessagePrivacy(
          "everyone"
        );

      }
    );

  }


  if (friends) {

    friends.addEventListener(
      "click",
      function () {

        saveMessagePrivacy(
          "friends"
        );

      }
    );

  }


  if (nobody) {

    nobody.addEventListener(
      "click",
      function () {

        saveMessagePrivacy(
          "nobody"
        );

      }
    );

  }

})();
// =====================================
// LOAD MESSAGE REQUEST PRIVACY
// =====================================

(function () {

  async function loadMessagePrivacy() {

    if (!auth.currentUser) {
      return;
    }


    try {

      const userRef =
        doc(
          db,
          "users",
          auth.currentUser.uid
        );


      const userSnap =
        await getDoc(userRef);


      if (!userSnap.exists()) {
        return;
      }


      const data =
        userSnap.data();


      const setting =
        data.messageRequestPrivacy ||
        "everyone";


      const buttons = {

        everyone:
          document.getElementById(
            "messageEveryoneBtn"
          ),

        friends:
          document.getElementById(
            "messageFriendsBtn"
          ),

        nobody:
          document.getElementById(
            "messageNobodyBtn"
          )

      };


      // Remove existing selections

      Object.values(buttons).forEach(
        function (button) {

          if (!button) {
            return;
          }


          button.classList.remove(
            "selected"
          );


          const check =
            button.querySelector(
              ".privacy-check"
            );


          if (check) {
            check.remove();
          }

        }
      );


      // Select saved option

      const selected =
        buttons[setting];


      if (selected) {

        selected.classList.add(
          "selected"
        );


        const check =
          document.createElement(
            "span"
          );


        check.className =
          "privacy-check";


        check.textContent =
          "✓";


        selected.appendChild(
          check
        );

      }


    } catch (error) {

      console.error(
        "Load message privacy error:",
        error
      );

    }

  }


  const messagePrivacyBtn =
    document.getElementById(
      "messagePrivacyBtn"
    );


  if (messagePrivacyBtn) {

    messagePrivacyBtn.addEventListener(
      "click",
      function () {

        loadMessagePrivacy();

      }
    );

  }

})();
// =====================================
// PRIVACY → BLOCKED USERS
// SAFE VERSION
// =====================================

(function () {

  const blockedBtn =
    document.getElementById(
      "blockedUsersPrivacyBtn"
    );

  const blockedPopover =
    document.getElementById(
      "blockedUsersPopover"
    );

  const closeBtn =
    document.getElementById(
      "blockedUsersCloseBtn"
    );


  // OPEN BLOCKED USERS

  if (
    blockedBtn &&
    blockedPopover
  ) {

    blockedBtn.addEventListener(
      "click",
      function () {

        const privacy =
          document.getElementById(
            "privacyPopover"
          );

        if (privacy) {

          privacy.classList.remove(
            "show"
          );

        }

        blockedPopover.classList.add(
          "show"
        );

      }
    );

  }


  // CLOSE BLOCKED USERS

  if (
    closeBtn &&
    blockedPopover
  ) {

    closeBtn.addEventListener(
      "click",
      function () {

        blockedPopover.classList.remove(
          "show"
        );

      }
    );

  }

})();
// =====================================
// CHAT CUSTOMIZATION PANEL
// =====================================

const chatCustomizationBtn =
  document.getElementById(
    "chatCustomizationBtn"
  );

const chatCustomizationPanel =
  document.getElementById(
    "chatCustomizationPanel"
  );

const chatCustomizationCloseBtn =
  document.getElementById(
    "chatCustomizationCloseBtn"
  );


// =====================================
// OPEN CHAT CUSTOMIZATION
// =====================================

if (
  chatCustomizationBtn &&
  chatCustomizationPanel
) {

  chatCustomizationBtn.addEventListener(
    "click",
    function () {

      chatCustomizationPanel.classList.add(
        "show"
      );

    }
  );

}


// =====================================
// CLOSE CHAT CUSTOMIZATION
// =====================================

if (
  chatCustomizationCloseBtn &&
  chatCustomizationPanel
) {

  chatCustomizationCloseBtn.addEventListener(
    "click",
    function () {

      chatCustomizationPanel.classList.remove(
        "show"
      );

    }
  );

}
// =====================================
// CHAT THEME PANEL
// =====================================

const chatThemeOption =
  document.getElementById(
    "chatThemeOption"
  );

const chatThemePanel =
  document.getElementById(
    "chatThemePanel"
  );

const chatThemeCloseBtn =
  document.getElementById(
    "chatThemeCloseBtn"
  );


// OPEN

if (
  chatThemeOption &&
  chatThemePanel
) {

  chatThemeOption.addEventListener(
    "click",
    function () {

      chatThemePanel.classList.add(
        "show"
      );

    }
  );

}


// CLOSE

if (
  chatThemeCloseBtn &&
  chatThemePanel
) {

  chatThemeCloseBtn.addEventListener(
    "click",
    function () {

      chatThemePanel.classList.remove(
        "show"
      );

    }
  );

}
// =====================================
// CHAT THEME SYSTEM
// =====================================

const chatThemeButtons =
  document.querySelectorAll(
    ".chat-theme-option"
  );


// =====================================
// APPLY THEME
// =====================================

function applyChatTheme(theme) {

  // Remove previous themes

  document.body.classList.remove(
    "chat-theme-classic",
    "chat-theme-ocean",
    "chat-theme-galaxy",
    "chat-theme-sunset",
    "chat-theme-nature",
    "chat-theme-purple",
    "chat-theme-fire",
    "chat-theme-glass"
  );


  // Add selected theme

  document.body.classList.add(
    "chat-theme-" + theme
  );


  // Save theme

  localStorage.setItem(
    "friendszoneChatTheme",
    theme
  );

}


// =====================================
// SELECT THEME
// =====================================

chatThemeButtons.forEach(
  function (button) {

    button.addEventListener(
      "click",
      function () {

        const theme =
          button.dataset.theme;

        if (!theme) return;

        applyChatTheme(theme);

      }
    );

  }
);


// =====================================
// LOAD SAVED THEME
// =====================================

const savedChatTheme =
  localStorage.getItem(
    "friendszoneChatTheme"
  );


if (savedChatTheme) {

  applyChatTheme(
    savedChatTheme
  );

} else {

  applyChatTheme(
    "classic"
  );
}
// =====================================
// MESSAGE FONT PANEL
// =====================================

const messageFontOption =
  document.getElementById(
    "messageFontOption"
  );

const messageFontPanel =
  document.getElementById(
    "messageFontPanel"
  );

const messageFontCloseBtn =
  document.getElementById(
    "messageFontCloseBtn"
  );


// OPEN

if (
  messageFontOption &&
  messageFontPanel
) {

  messageFontOption.addEventListener(
    "click",
    function () {

      messageFontPanel.classList.add(
        "show"
      );

    }
  );

}


// CLOSE

if (
  messageFontCloseBtn &&
  messageFontPanel
) {

  messageFontCloseBtn.addEventListener(
    "click",
    function () {

      messageFontPanel.classList.remove(
        "show"
      );

    }
  );

}
// =====================================
// MESSAGE FONT SYSTEM
// =====================================

const messageFontButtons =
  document.querySelectorAll(
    ".message-font-option"
  );


// =====================================
// APPLY FONT TO ALL CHAT MESSAGES
// =====================================

function applyFriendsZoneMessageFont(font) {

  if (!font) {
    return;
  }


  // Save the choice

  localStorage.setItem(
    "friendszoneMessageFont",
    font
  );


  // Change existing messages

  const messages =
    document.querySelectorAll(
      "#messages .message"
    );


  messages.forEach(
    function (message) {

      message.style.setProperty(
        "font-family",
        font,
        "important"
      );


      // Also change everything
      // inside the message

      const children =
        message.querySelectorAll(
          "*"
        );


      children.forEach(
        function (child) {

          child.style.setProperty(
            "font-family",
            font,
            "important"
          );

        }
      );

    }
  );

}


// =====================================
// FONT BUTTONS
// =====================================

messageFontButtons.forEach(
  function (button) {

    button.addEventListener(
      "click",
      function () {

        const font =
          button.dataset.font;

        applyFriendsZoneMessageFont(
          font
        );

      }
    );

  }
);


// =====================================
// LOAD SAVED FONT
// =====================================

const savedFriendsZoneFont =
  localStorage.getItem(
    "friendszoneMessageFont"
  ) || "Arial";


applyFriendsZoneMessageFont(
  savedFriendsZoneFont
);

// =====================================
// SAVE SELECTED FONT
// =====================================

messageFontButtons.forEach(
  function (button) {

    button.addEventListener(
      "click",
      function () {

        const font =
          button.dataset.font;

        if (!font) {
          return;
        }


        localStorage.setItem(
          "friendszoneMessageFont",
          font
        );


        // Apply immediately to
        // messages already displayed

        const messages =
          document.querySelectorAll(
            "#messages .message"
          );


        messages.forEach(
          function (message) {

            message.style.fontFamily =
              font;

          }
        );

      }
    );

  }
);

// =====================================
// APPLY MESSAGE FONT
// =====================================

function applyMessageFont(font) {

  // Save the selected font
  localStorage.setItem(
    "friendszoneMessageFont",
    font
  );


  // Apply font to message areas
  document.documentElement.style.setProperty(
    "--friendszone-message-font",
    font
  );


  // Apply directly to common message elements
  const messages =
    document.querySelectorAll(
      ".message, .message-bubble, .chat-message, .sent, .received"
    );

  messages.forEach(
    function (message) {

      message.style.fontFamily =
        font;

    }
  );

}


// =====================================
// SELECT FONT
// =====================================

messageFontButtons.forEach(
  function (button) {

    button.addEventListener(
      "click",
      function () {

        const font =
          button.dataset.font;

        if (!font) return;

        applyMessageFont(font);

      }
    );

  }
);


// =====================================
// LOAD SAVED FONT
// =====================================

const savedMessageFont =
  localStorage.getItem(
    "friendszoneMessageFont"
  );


if (savedMessageFont) {

  applyMessageFont(
    savedMessageFont
  );

} else {

  applyMessageFont(
    "Arial"
  );

}
// =====================================
// NAME COLOR PANEL
// =====================================

const nameColorOption =
  document.getElementById(
    "nameColorOption"
  );

const nameColorPanel =
  document.getElementById(
    "nameColorPanel"
  );

const nameColorCloseBtn =
  document.getElementById(
    "nameColorCloseBtn"
  );


// OPEN

if (
  nameColorOption &&
  nameColorPanel
) {

  nameColorOption.addEventListener(
    "click",
    function () {

      nameColorPanel.classList.add(
        "show"
      );

    }
  );

}


// CLOSE

if (
  nameColorCloseBtn &&
  nameColorPanel
) {

  nameColorCloseBtn.addEventListener(
    "click",
    function () {

      nameColorPanel.classList.remove(
        "show"
      );

    }
  );

}
// =====================================
// NAME COLOR SYSTEM
// =====================================

const nameColorButtons =
  document.querySelectorAll(
    ".name-color-option"
  );


// =====================================
// APPLY NAME COLOR
// =====================================

function applyNameColor(color) {

  // Save selected color
  localStorage.setItem(
    "friendszoneNameColor",
    color
  );


  // Set CSS variable
  document.documentElement.style.setProperty(
    "--friendszone-name-color",
    color === "rainbow"
      ? "transparent"
      : color
  );


  // Apply to existing names
  const names =
    document.querySelectorAll(
      "#messages .message > b"
    );


  names.forEach(
    function (name) {

      if (color === "rainbow") {

        name.classList.add(
          "friendszone-rainbow-name"
        );

        name.style.color =
          "transparent";

        name.style.background =
          "linear-gradient(90deg, red, orange, green, blue, purple)";

        name.style.webkitBackgroundClip =
          "text";

        name.style.backgroundClip =
          "text";

      } else {

        name.classList.remove(
          "friendszone-rainbow-name"
        );

        name.style.background =
          "";

        name.style.webkitBackgroundClip =
          "";

        name.style.backgroundClip =
          "";

        name.style.color =
          color;

      }

    }
  );

}


// =====================================
// SELECT COLOR
// =====================================

nameColorButtons.forEach(
  function (button) {

    button.addEventListener(
      "click",
      function () {

        const color =
          button.dataset.nameColor;

        if (!color) return;

        applyNameColor(color);

      }
    );

  }
);


// =====================================
// LOAD SAVED COLOR
// =====================================

const savedNameColor =
  localStorage.getItem(
    "friendszoneNameColor"
  );


if (savedNameColor) {

  applyNameColor(
    savedNameColor
  );

} else {

  applyNameColor(
    "#2196F3"
  );

}
// =====================================
// MESSAGE BUBBLE PANEL
// =====================================

const bubbleStyleOption =
  document.getElementById(
    "bubbleStyleOption"
  );

const bubbleStylePanel =
  document.getElementById(
    "bubbleStylePanel"
  );

const bubbleStyleCloseBtn =
  document.getElementById(
    "bubbleStyleCloseBtn"
  );


// OPEN

if (
  bubbleStyleOption &&
  bubbleStylePanel
) {

  bubbleStyleOption.addEventListener(
    "click",
    function () {

      bubbleStylePanel.classList.add(
        "show"
      );

    }
  );

}


// CLOSE

if (
  bubbleStyleCloseBtn &&
  bubbleStylePanel
) {

  bubbleStyleCloseBtn.addEventListener(
    "click",
    function () {

      bubbleStylePanel.classList.remove(
        "show"
      );

    }
  );

}
// =====================================
// MESSAGE BUBBLE STYLE SYSTEM
// =====================================

const bubbleStyleButtons =
  document.querySelectorAll(
    ".bubble-style-option"
  );


// =====================================
// APPLY BUBBLE STYLE
// =====================================

function applyBubbleStyle(style) {

  if (!style) {
    return;
  }


  // Save choice

  localStorage.setItem(
    "friendszoneBubbleStyle",
    style
  );


  // Existing messages

  const messages =
    document.querySelectorAll(
      "#messages .message"
    );


  messages.forEach(
    function (message) {

      message.classList.remove(
        "bubble-classic-active",
        "bubble-soft-active",
        "bubble-square-active",
        "bubble-glass-active",
        "bubble-modern-active"
      );


      message.classList.add(
        "bubble-" +
        style +
        "-active"
      );

    }
  );

}


// =====================================
// BUTTONS
// =====================================

bubbleStyleButtons.forEach(
  function (button) {

    button.addEventListener(
      "click",
      function () {

        const style =
          button.dataset.bubbleStyle;

        applyBubbleStyle(style);

      }
    );

  }
);


// =====================================
// LOAD SAVED STYLE
// =====================================

const savedBubbleStyle =
  localStorage.getItem(
    "friendszoneBubbleStyle"
  ) || "classic";


applyBubbleStyle(
  savedBubbleStyle
);
// =====================================
// MESSAGE EFFECTS PANEL
// =====================================

const messageEffectsOption =
  document.getElementById(
    "messageEffectsOption"
  );

const messageEffectsPanel =
  document.getElementById(
    "messageEffectsPanel"
  );

const messageEffectsCloseBtn =
  document.getElementById(
    "messageEffectsCloseBtn"
  );


// OPEN

if (
  messageEffectsOption &&
  messageEffectsPanel
) {

  messageEffectsOption.addEventListener(
    "click",
    function () {

      messageEffectsPanel.classList.add(
        "show"
      );

    }
  );

}


// CLOSE

if (
  messageEffectsCloseBtn &&
  messageEffectsPanel
) {

  messageEffectsCloseBtn.addEventListener(
    "click",
    function () {

      messageEffectsPanel.classList.remove(
        "show"
      );

    }
  );
}
// =====================================
// MESSAGE EFFECT SYSTEM
// =====================================

const messageEffectButtons =
  document.querySelectorAll(
    ".message-effects-option"
  );


// =====================================
// APPLY EFFECT TO EXISTING MESSAGES
// =====================================

function applyMessageEffect(effect) {

  if (!effect) {
    return;
  }


  // Save selection

  localStorage.setItem(
    "friendszoneMessageEffect",
    effect
  );


  // Existing messages

  const messages =
    document.querySelectorAll(
      "#messages .message"
    );


  messages.forEach(
    function (message) {

      message.classList.remove(
        "message-effect-none",
        "message-effect-fade",
        "message-effect-slide",
        "message-effect-pop",
        "message-effect-bounce"
      );


      message.classList.add(
        "message-effect-" +
        effect
      );

    }
  );

}


// =====================================
// EFFECT BUTTONS
// =====================================

messageEffectButtons.forEach(
  function (button) {

    button.addEventListener(
      "click",
      function () {

        const effect =
          button.dataset.messageEffect;

        applyMessageEffect(
          effect
        );

      }
    );

  }
);


// =====================================
// LOAD SAVED EFFECT
// =====================================

const savedMessageEffect =
  localStorage.getItem(
    "friendszoneMessageEffect"
  ) || "none";


applyMessageEffect(
  savedMessageEffect
);
// =====================================
// CHAT BACKGROUND PANEL
// =====================================

const chatBackgroundOption =
  document.getElementById(
    "chatBackgroundOption"
  );

const chatBackgroundPanel =
  document.getElementById(
    "chatBackgroundPanel"
  );

const chatBackgroundCloseBtn =
  document.getElementById(
    "chatBackgroundCloseBtn"
  );


// OPEN

if (
  chatBackgroundOption &&
  chatBackgroundPanel
) {

  chatBackgroundOption.addEventListener(
    "click",
    function () {

      chatBackgroundPanel.classList.add(
        "show"
      );

    }
  );

}


// CLOSE

if (
  chatBackgroundCloseBtn &&
  chatBackgroundPanel
) {

  chatBackgroundCloseBtn.addEventListener(
    "click",
    function () {

      chatBackgroundPanel.classList.remove(
        "show"
      );

    }
  );

}
// =====================================
// CHAT BACKGROUND SYSTEM
// =====================================

const chatBackgroundButtons =
  document.querySelectorAll(
    ".chat-background-option"
  );


// =====================================
// APPLY CHAT BACKGROUND
// =====================================

function applyChatBackground(background) {

  if (!background) {
    return;
  }


  // Save choice

  localStorage.setItem(
    "friendszoneChatBackground",
    background
  );


  // Find chat area

  const chatArea =
    document.querySelector(
      ".chat-area"
    ) ||
    document.querySelector(
      "#chatArea"
    ) ||
    document.querySelector(
      ".chat-container"
    );


  if (!chatArea) {

    console.warn(
      "Chat area not found."
    );

    return;

  }


  // Remove previous classes

  chatArea.classList.remove(
    "chat-bg-default",
    "chat-bg-gradient",
    "chat-bg-ocean",
    "chat-bg-space",
    "chat-bg-nature",
    "chat-bg-pink",
    "chat-bg-clean"
  );


  // Add selected class

  chatArea.classList.add(
    "chat-bg-" +
    background
  );

}


// =====================================
// BACKGROUND BUTTONS
// =====================================

chatBackgroundButtons.forEach(
  function (button) {

    button.addEventListener(
      "click",
      function () {

        const background =
          button.dataset.chatBackground;

        applyChatBackground(
          background
        );

      }
    );

  }
);


// =====================================
// LOAD SAVED BACKGROUND
// =====================================

const savedChatBackground =
  localStorage.getItem(
    "friendszoneChatBackground"
  ) || "default";


applyChatBackground(
  savedChatBackground
);
// =====================================
// BUBBLE COLORS PANEL
// =====================================

const bubbleColorsOption =
  document.getElementById(
    "bubbleColorsOption"
  );

const bubbleColorsPanel =
  document.getElementById(
    "bubbleColorsPanel"
  );

const bubbleColorsCloseBtn =
  document.getElementById(
    "bubbleColorsCloseBtn"
  );


if (
  bubbleColorsOption &&
  bubbleColorsPanel
) {

  bubbleColorsOption.addEventListener(
    "click",
    function () {

      bubbleColorsPanel.classList.add(
        "show"
      );

    }
  );

}


if (
  bubbleColorsCloseBtn &&
  bubbleColorsPanel
) {

  bubbleColorsCloseBtn.addEventListener(
    "click",
    function () {

      bubbleColorsPanel.classList.remove(
        "show"
      );

    }
  );

}
// =====================================
// RESET CHAT CUSTOMIZATION
// =====================================

const resetChatCustomization =
  document.getElementById(
    "resetChatCustomization"
  );


if (resetChatCustomization) {

  resetChatCustomization.addEventListener(
    "click",
    function () {

      const confirmReset =
        confirm(
          "Reset all chat customization settings?"
        );


      if (!confirmReset) {
        return;
      }


      // =================================
      // REMOVE SAVED SETTINGS
      // =================================

      localStorage.removeItem(
        "friendszoneMessageFont"
      );

      localStorage.removeItem(
        "friendszoneBubbleStyle"
      );

      localStorage.removeItem(
        "friendszoneMessageEffect"
      );

      localStorage.removeItem(
        "friendszoneChatBackground"
      );

      localStorage.removeItem(
        "friendszoneSentBubbleColor"
      );

      localStorage.removeItem(
        "friendszoneReceivedBubbleColor"
      );


      // =================================
      // DEFAULT VALUES
      // =================================

      const defaultFont =
        "Arial";

      const defaultBubble =
        "classic";

      const defaultEffect =
        "none";

      const defaultBackground =
        "default";

      const defaultSentColor =
        "#25D366";

      const defaultReceivedColor =
        "#ffffff";


      // =================================
      // APPLY DEFAULT FONT
      // =================================

      applyFriendsZoneMessageFont(
        defaultFont
      );


      // =================================
      // APPLY DEFAULT BUBBLE
      // =================================

      applyBubbleStyle(
        defaultBubble
      );


      // =================================
      // APPLY DEFAULT EFFECT
      // =================================

      applyMessageEffect(
        defaultEffect
      );


      // =================================
      // APPLY DEFAULT BACKGROUND
      // =================================

      applyChatBackground(
        defaultBackground
      );


      // =================================
      // APPLY DEFAULT COLORS
      // =================================

      applySentBubbleColor(
        defaultSentColor
      );


      applyReceivedBubbleColor(
        defaultReceivedColor
      );


      // =================================
      // CLOSE CUSTOMIZATION PANEL
      // =================================

      const panel =
        document.getElementById(
          "chatCustomizationPanel"
        );


      if (panel) {

        panel.classList.remove(
          "show"
        );

      }


      alert(
        "Chat customization has been reset."
      );

    }
  );

}