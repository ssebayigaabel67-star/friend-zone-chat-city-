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
  setDoc,
  where,
  deleteDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
  deleteField
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";


// ==========================================
// FIREBASE CONFIG
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyAxVyuHiNb-NEeXLfMfaq0RS9ERfahORt4",
  authDomain: "friend-zone-chat-city.firebaseapp.com",
  projectId: "friend-zone-chat-city",
  storageBucket: "friend-zone-chat-city.firebasestorage.app",
  messagingSenderId: "1077723243409",
  appId: "1:1077723243409:web:f030fdcd210f0326d93030",
  measurementId: "G-3RD3QLSF3F"
};


// ==========================================
// INITIALIZE FIREBASE
// ==========================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);


// ==========================================
// ELEMENTS
// ==========================================

const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const onlineUsersEl = document.getElementById("onlineUsers");
const onlineCount = document.getElementById("onlineCount");
const onlineCountText = document.getElementById("onlineCountText");
const onlinePopover = document.getElementById("onlinePopover");
const closeOnlinePopover = document.getElementById("closeOnlinePopover");
const backBtn = document.getElementById("backBtn");

const imageInput = document.getElementById("imageInput");
const imageBtn = document.getElementById("imageBtn");

const micBtn = document.getElementById("micBtn");
const recordingIndicator = document.getElementById("recordingIndicator");
const recordingTimerEl = document.getElementById("recordingTimer");
const cancelRecordingBtn = document.getElementById("cancelRecordingBtn");
const sendRecordingBtn = document.getElementById("sendRecordingBtn");

const replyPreview = document.getElementById("replyPreview");
const replyPreviewName = document.getElementById("replyPreviewName");
const replyPreviewText = document.getElementById("replyPreviewText");
const cancelReplyBtn = document.getElementById("cancelReplyBtn");

const pinnedBanner = document.getElementById("pinnedBanner");
const pinnedBannerText = document.getElementById("pinnedBannerText");
const unpinBtn = document.getElementById("unpinBtn");

const reactionPicker = document.getElementById("reactionPicker");

const profileModalOverlay = document.getElementById("profileModalOverlay");
const profileModalAvatar = document.getElementById("profileModalAvatar");
const profileModalName = document.getElementById("profileModalName");
const profileModalUsername = document.getElementById("profileModalUsername");
const profileModalStatus = document.getElementById("profileModalStatus");
const profileModalStatusText = document.getElementById("profileModalStatusText");
const profileModalInfo = document.getElementById("profileModalInfo");
const profileModalActions = document.getElementById("profileModalActions");
const profileModalNote = document.getElementById("profileModalNote");
const closeProfileModal = document.getElementById("closeProfileModal");

// Change this to match how your own homepage.html opens a private
// conversation (e.g. a different query param, or a dedicated chat.html).
const PRIVATE_CHAT_URL = "homepage.html";


// ==============================
// 🤖 FRIENDSZONE AI
// ==============================

const FRIENDSZONE_AI = {
  id: "friendszone_ai",
  name: "FriendsZone AI",
  username: "friendszoneai",
  photoURL: "ai_profile_picture.jpg"
};

function isCallingAI(text) {
  if (!text) return false;
  const message = text.trim().toLowerCase();
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
// STATE
// ==========================================

let currentUser = null;

let currentUserProfile = {
  name: "User",
  username: "",
  photoURL: ""
};

let replyingTo = null;

// uid -> user data, kept fresh from the online-users listener
const onlineUsersMap = new Map();

// username (lowercase, no @) -> uid, built from online users + messages seen,
// used to resolve @mentions. This only reliably covers users who have been
// online or have posted since this page loaded.
const usernameToUid = new Map();

// Room-wide moderation / pin state, loaded from liveRoom/meta.
// NOTE: this document is not created automatically. To use moderation and
// pinning, create a document at liveRoom/meta with at least:
//   { ownerId: "<uid of the room owner>" }
// and make sure your Firestore security rules only allow the owner/admins
// to write mutedUsers / bannedUsers / admins / pinnedMessage — the checks
// below are for UI purposes only and are NOT a substitute for real rules.
let roomMeta = {
  ownerId: null,
  admins: [],
  mutedUsers: {},
  bannedUsers: [],
  pinnedMessage: null
};

const metaRef = doc(db, "liveRoom", "meta");

// Voice recording state
let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let recordingStartedAt = 0;
let recordingTimerHandle = null;

// currently playing voice message <audio>, so only one plays at a time
let activeAudioEl = null;


// ==========================================
// ROLE / MODERATION HELPERS
// ==========================================

function isOwner(uid) {
  return !!uid && roomMeta.ownerId === uid;
}

function isAdmin(uid) {
  return !!uid && Array.isArray(roomMeta.admins) && roomMeta.admins.includes(uid);
}

function isModerator(uid) {
  return isOwner(uid) || isAdmin(uid);
}

function muteExpiry(uid) {
  const value = roomMeta.mutedUsers ? roomMeta.mutedUsers[uid] : null;
  return value === undefined ? null : value;
}

function isMuted(uid) {
  const expiry = muteExpiry(uid);
  if (expiry === null || expiry === undefined) return false;
  if (expiry === 0) return true; // muted indefinitely
  return Date.now() < expiry;
}

function isBanned(uid) {
  return Array.isArray(roomMeta.bannedUsers) && roomMeta.bannedUsers.includes(uid);
}


// ==========================================
// UTIL
// ==========================================

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Turns raw text into escaped HTML with @mentions highlighted.
// Returns { html, mentionedUids, mentionsMe }
function renderTextWithMentions(text) {
  const escaped = escapeHtml(text);
  const mentionedUids = [];
  let mentionsMe = false;

  const html = escaped.replace(/@([a-zA-Z0-9_]{2,32})/g, (match, uname) => {
    const uid = usernameToUid.get(uname.toLowerCase());
    if (!uid) return match;

    mentionedUids.push(uid);

    const isMe = currentUser && uid === currentUser.uid;
    if (isMe) mentionsMe = true;

    return `<span class="mention${isMe ? " mention-me" : ""}">@${uname}</span>`;
  });

  return { html, mentionedUids, mentionsMe };
}


// ==========================================
// AUTH + LOAD PROFILE + ONLINE STATUS
// ==========================================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please sign in first.");
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  console.log("Live Room user:", user.uid);

  const userRef = doc(db, "users", user.uid);

  try {
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();

      currentUserProfile.name = userData.name || userData.username || user.displayName || "User";
      currentUserProfile.username = userData.username || "";
      currentUserProfile.photoURL = userData.photoURL || userData.profilePicture || userData.photo || "";

      console.log("Live Room profile loaded:", currentUserProfile);
    } else {
      currentUserProfile.name = user.displayName || "User";
      currentUserProfile.username = "";
      currentUserProfile.photoURL = user.photoURL || "";
    }

    if (currentUserProfile.username) {
      usernameToUid.set(currentUserProfile.username.toLowerCase(), user.uid);
    }

    await updateDoc(userRef, {
      online: true,
      lastSeen: serverTimestamp()
    });

    console.log("User marked online in Live Room");
  } catch (error) {
    console.error("Could not load profile/update online status:", error);
  }
});


// ==========================================
// ROOM META (owner/admins, mutes, bans, pin)
// ==========================================

onSnapshot(
  metaRef,
  (snap) => {
    const data = snap.exists() ? snap.data() : {};

    roomMeta = {
      ownerId: data.ownerId || null,
      admins: data.admins || [],
      mutedUsers: data.mutedUsers || {},
      bannedUsers: data.bannedUsers || [],
      pinnedMessage: data.pinnedMessage || null
    };

    renderPinnedBanner();

    // If the signed-in user has been banned, boot them out.
    if (currentUser && isBanned(currentUser.uid)) {
      alert("You have been removed from this room.");
      window.location.href = "index.html";
    }
  },
  (error) => {
    console.error("Room meta error:", error);
  }
);

function renderPinnedBanner() {
  if (!roomMeta.pinnedMessage) {
    pinnedBanner.classList.remove("show");
    return;
  }

  const pin = roomMeta.pinnedMessage;
  const label = pin.text || (pin.imageURL ? "📸 Image" : pin.audioURL ? "🎤 Voice message" : "Message");
  pinnedBannerText.textContent = `${pin.senderName || "Someone"}: ${label}`;
  pinnedBanner.classList.add("show");
}

pinnedBanner.addEventListener("click", (event) => {
  if (event.target === unpinBtn) return;
  const pin = roomMeta.pinnedMessage;
  if (!pin || !pin.id) return;

  const target = document.querySelector(`[data-message-id="${pin.id}"]`);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});

unpinBtn.addEventListener("click", async (event) => {
  event.stopPropagation();
  try {
    await updateDoc(metaRef, { pinnedMessage: deleteField() });
  } catch (error) {
    console.error("Unpin error:", error);
    alert("Could not unpin the message.");
  }
});

async function pinMessage(messageId, data) {
  try {
    await setDoc(
      metaRef,
      {
        pinnedMessage: {
          id: messageId,
          text: data.text || "",
          imageURL: data.imageURL || null,
          audioURL: data.audioURL || null,
          senderName: data.senderName || data.username || "User",
          pinnedBy: currentUser ? currentUser.uid : null,
          pinnedAt: Date.now()
        }
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Pin error:", error);
    alert("Could not pin the message.");
  }
}


// ==========================================
// ONLINE POPOVER
// ==========================================

if (onlineCount) {
  onlineCount.addEventListener("click", () => {
    onlinePopover.classList.toggle("show");
  });
}

if (closeOnlinePopover) {
  closeOnlinePopover.addEventListener("click", () => {
    onlinePopover.classList.remove("show");
  });
}

document.addEventListener("click", (event) => {
  if (
    onlinePopover &&
    onlineCount &&
    !onlinePopover.contains(event.target) &&
    !onlineCount.contains(event.target)
  ) {
    onlinePopover.classList.remove("show");
  }

  if (reactionPicker && !reactionPicker.contains(event.target) && !event.target.closest(".add-reaction-btn")) {
    reactionPicker.classList.remove("show");
  }
});


// ==========================================
// LOAD ONLINE USERS
// ==========================================

const onlineUsersQuery = query(
  collection(db, "users"),
  where("online", "==", true)
);

onSnapshot(
  onlineUsersQuery,
  (snapshot) => {
    onlineUsersEl.innerHTML = "";
    onlineCountText.textContent = `${snapshot.size} online`;

    onlineUsersMap.clear();

    if (snapshot.empty) {
      onlineUsersEl.innerHTML = `<p class="empty-text">No one is online yet.</p>`;
      return;
    }

    snapshot.forEach((userDoc) => {
      const user = userDoc.data();
      const uid = userDoc.id;

      onlineUsersMap.set(uid, user);
      if (user.username) {
        usernameToUid.set(user.username.toLowerCase(), uid);
      }

      const userElement = document.createElement("div");
      userElement.className = "online-user";

      const photo = document.createElement("img");
      photo.className = "online-user-photo";
      photo.src = user.photoURL || user.profilePicture || user.photo || "https://via.placeholder.com/48";
      photo.alt = user.name || user.username || "User";

      const info = document.createElement("div");
      info.className = "online-user-info";

      const name = document.createElement("span");
      name.className = "online-user-name";
      name.textContent = user.name || user.username || "User";
      info.appendChild(name);

      if (user.username) {
        const uname = document.createElement("span");
        uname.className = "online-user-username";
        uname.textContent = "@" + user.username;
        info.appendChild(uname);
      }

      const status = document.createElement("span");
      status.className = "online-user-status";
      status.innerHTML = `<span class="online-status-dot"></span> Online`;
      info.appendChild(status);

      const badges = document.createElement("div");
      badges.className = "online-user-badges";

      if (isOwner(uid)) {
        badges.innerHTML += `<span class="role-badge owner">Owner</span>`;
      } else if (isAdmin(uid)) {
        badges.innerHTML += `<span class="role-badge admin">Admin</span>`;
      }

      if (isMuted(uid)) {
        badges.innerHTML += `<span class="muted-badge">Muted</span>`;
      }

      userElement.appendChild(photo);
      userElement.appendChild(info);
      userElement.appendChild(badges);

      userElement.addEventListener("click", () => {
        openProfilePopup({
          uid,
          name: user.name || user.username || "User",
          username: user.username || "",
          photoURL: photo.src,
          online: true
        });
      });

      onlineUsersEl.appendChild(userElement);
    });
  },
  (error) => {
    console.error("Online users error:", error);
  }
);


// ==========================================
// PROFILE POPUP
// ==========================================

// profileRequestToken guards against a slow Firestore read finishing after
// the user has already opened a different profile (or closed the popup).
let profileRequestToken = 0;

async function openProfilePopup(user) {
  const uid = user.uid;
  const myToken = ++profileRequestToken;

  // ---- show what we already know immediately ----
  profileModalAvatar.src = user.photoURL || "https://via.placeholder.com/84";
  profileModalAvatar.alt = user.name || "User";
  profileModalName.textContent = user.name || "User";
  profileModalUsername.textContent = user.username ? "@" + user.username : "";

  let online = user.online !== undefined ? user.online : onlineUsersMap.has(uid);
  profileModalStatus.classList.toggle("offline", !online);
  profileModalStatusText.textContent = online ? "Online" : "Offline";

  profileModalInfo.innerHTML = `<div class="profile-modal-info-empty">Loading details…</div>`;
  profileModalActions.innerHTML = "";
  profileModalNote.style.display = "none";

  profileModalOverlay.classList.add("show");

  // ---- fetch the full user document for details like email/age/country ----
  let fullUser = { ...user };

  try {
    const snap = await getDoc(doc(db, "users", uid));

    // Ignore this result if the popup has since been reopened for someone else.
    if (myToken !== profileRequestToken) return;

    if (snap.exists()) {
      const data = snap.data();
      fullUser = {
        uid,
        name: data.name || data.username || user.name || "User",
        username: data.username || user.username || "",
        photoURL: data.photoURL || data.profilePicture || data.photo || user.photoURL || "",
        email: data.email || "",
        age: data.age || data.birthYear ? data.age : "",
        country: data.country || data.location || "",
        online: data.online !== undefined ? data.online : online
      };

      profileModalAvatar.src = fullUser.photoURL || "https://via.placeholder.com/84";
      profileModalName.textContent = fullUser.name;
      profileModalUsername.textContent = fullUser.username ? "@" + fullUser.username : "";

      online = fullUser.online;
      profileModalStatus.classList.toggle("offline", !online);
      profileModalStatusText.textContent = online ? "Online" : "Offline";
    }
  } catch (error) {
    console.error("Could not load full profile:", error);
  }

  if (myToken !== profileRequestToken) return;

  // ---- info rows: email / age / country ----
  const rows = [];
  if (fullUser.email) rows.push({ label: "Email", value: fullUser.email });
  if (fullUser.age) rows.push({ label: "Age", value: fullUser.age });
  if (fullUser.country) rows.push({ label: "Country", value: fullUser.country });

  profileModalInfo.innerHTML = rows.length
    ? rows
        .map(
          (row) =>
            `<div class="profile-modal-info-row">
               <span class="profile-modal-info-label">${escapeHtml(row.label)}</span>
               <span class="profile-modal-info-value">${escapeHtml(String(row.value))}</span>
             </div>`
        )
        .join("")
    : `<div class="profile-modal-info-empty">No extra profile details available.</div>`;

  // ---- actions ----
  const isSelf = currentUser && uid === currentUser.uid;

  if (!isSelf) {
    const chatBtn = document.createElement("button");
    chatBtn.type = "button";
    chatBtn.className = "profile-action-btn chat";
    chatBtn.textContent = "💬 Chat";
    chatBtn.addEventListener("click", () => {
      // Adjust PRIVATE_CHAT_URL / query params above to match your
      // homepage.html's private-chat routing.
      window.location.href = `${PRIVATE_CHAT_URL}?chat=${encodeURIComponent(uid)}&name=${encodeURIComponent(fullUser.name || "")}`;
    });
    profileModalActions.appendChild(chatBtn);
  }

  if (!isSelf && fullUser.username) {
    const mentionBtn = document.createElement("button");
    mentionBtn.type = "button";
    mentionBtn.className = "profile-action-btn primary";
    mentionBtn.textContent = "@ Mention";
    mentionBtn.addEventListener("click", () => {
      const prefix = messageInput.value && !messageInput.value.endsWith(" ") ? " " : "";
      messageInput.value += `${prefix}@${fullUser.username} `;
      closeProfilePopup();
      messageInput.focus();
    });
    profileModalActions.appendChild(mentionBtn);
  }

  const currentUid = currentUser ? currentUser.uid : null;
  const canModerate = isModerator(currentUid) && !isSelf && !isOwner(uid);

  if (canModerate) {
    const muted = isMuted(uid);

    const muteBtn = document.createElement("button");
    muteBtn.type = "button";
    muteBtn.className = "profile-action-btn mute";
    muteBtn.textContent = muted ? "🔊 Unmute" : "🔇 Mute (15m)";
    muteBtn.addEventListener("click", () => {
      if (muted) {
        unmuteUser(uid);
      } else {
        muteUser(uid, 15);
      }
      closeProfilePopup();
    });
    profileModalActions.appendChild(muteBtn);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "profile-action-btn remove";
    removeBtn.textContent = "🛡️ Remove";
    removeBtn.addEventListener("click", () => {
      const confirmed = confirm(`Remove ${fullUser.name || "this user"} from the room?`);
      if (confirmed) {
        removeUser(uid);
        closeProfilePopup();
      }
    });
    profileModalActions.appendChild(removeBtn);

    profileModalNote.style.display = "block";
  }
}

function closeProfilePopup() {
  profileModalOverlay.classList.remove("show");
}

closeProfileModal.addEventListener("click", closeProfilePopup);

profileModalOverlay.addEventListener("click", (event) => {
  if (event.target === profileModalOverlay) closeProfilePopup();
});


// ==========================================
// MODERATION ACTIONS
// ==========================================

async function muteUser(uid, minutes) {
  const expiry = Date.now() + minutes * 60 * 1000;
  try {
    await setDoc(metaRef, { mutedUsers: { [uid]: expiry } }, { merge: true });
  } catch (error) {
    console.error("Mute error:", error);
    alert("Could not mute this user.");
  }
}

async function unmuteUser(uid) {
  try {
    await updateDoc(metaRef, { [`mutedUsers.${uid}`]: deleteField() });
  } catch (error) {
    console.error("Unmute error:", error);
    alert("Could not unmute this user.");
  }
}

async function removeUser(uid) {
  try {
    await setDoc(metaRef, { bannedUsers: arrayUnion(uid) }, { merge: true });

    // Best-effort — only works if your Firestore rules let moderators
    // update other users' "online" field.
    try {
      await updateDoc(doc(db, "users", uid), { online: false });
    } catch (innerError) {
      console.warn("Could not force-offline the removed user (rules may block this):", innerError);
    }
  } catch (error) {
    console.error("Remove user error:", error);
    alert("Could not remove this user.");
  }
}


// ==========================================
// REACTIONS
// ==========================================

let reactionPickerTargetId = null;

function openReactionPicker(anchorEl, messageId) {
  reactionPickerTargetId = messageId;

  const rect = anchorEl.getBoundingClientRect();
  reactionPicker.style.top = `${window.scrollY + rect.top - 46}px`;
  reactionPicker.style.left = `${Math.max(8, window.scrollX + rect.left - 120)}px`;
  reactionPicker.classList.add("show");
}

reactionPicker.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-emoji]");
  if (!btn || !reactionPickerTargetId) return;

  await toggleReaction(reactionPickerTargetId, btn.dataset.emoji);
  reactionPicker.classList.remove("show");
});

async function toggleReaction(messageId, emoji) {
  if (!currentUser) return;

  const msgRef = doc(db, "liveRoom", "messages", "messages", messageId);

  try {
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const current = (data.reactions && data.reactions[emoji]) || [];
    const alreadyReacted = current.includes(currentUser.uid);

    await updateDoc(msgRef, {
      [`reactions.${emoji}`]: alreadyReacted ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
    });
  } catch (error) {
    console.error("Reaction error:", error);
  }
}


// ==========================================
// START / CANCEL REPLY
// ==========================================

function startReply(messageData, messageId) {
  replyingTo = {
    id: messageId,
    senderId: messageData.senderId || "",
    senderName: messageData.senderName || messageData.username || "User",
    text: messageData.text || (messageData.imageURL ? "📸 Image" : messageData.audioURL ? "🎤 Voice message" : "")
  };

  replyPreviewName.textContent = "Replying to " + replyingTo.senderName;
  replyPreviewText.textContent = replyingTo.text;
  replyPreview.style.display = "flex";
  messageInput.focus();
}

function cancelReply() {
  replyingTo = null;
  replyPreview.style.display = "none";
  replyPreviewName.textContent = "Replying to";
  replyPreviewText.textContent = "";
}

if (cancelReplyBtn) {
  cancelReplyBtn.addEventListener("click", cancelReply);
}


// ==========================================
// COMPRESS IMAGE
// ==========================================

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxWidth = 800;
        const maxHeight = 800;

        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };

      img.onerror = reject;
      img.src = event.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage() {
  if (!currentUser) {
    alert("Please wait for your account to load.");
    return;
  }

  if (isMuted(currentUser.uid)) {
    alert("You've been muted in this room and can't send messages right now.");
    return;
  }

  const text = messageInput.value.trim();
  if (!text) return;

  try {
    const { mentionedUids } = renderTextWithMentions(text);

    await addDoc(
      collection(db, "liveRoom", "messages", "messages"),
      {
        senderId: currentUser.uid,
        senderName: currentUserProfile.name,
        username: currentUserProfile.username,
        photoURL: currentUserProfile.photoURL,
        text: text,
        mentions: mentionedUids,
        reactions: {},
        timestamp: serverTimestamp(),
        replyTo: replyingTo
          ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text }
          : null
      }
    );

    if (isCallingAI(text)) {
      const aiQuestion = text
        .replace(/^@ai[\s,:!?-]*/i, "")
        .replace(/^hi ai[\s,:!?-]*/i, "")
        .replace(/^hey ai[\s,:!?-]*/i, "")
        .replace(/^ai[\s,:!?-]*/i, "")
        .trim();

      const finalQuestion = aiQuestion || "Say hello to the user and ask how you can help.";

      const response = await fetch("/api/ask-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await currentUser.getIdToken()}`
        },
        body: JSON.stringify({ question: finalQuestion })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error("FriendsZone AI error:", data);
        throw new Error(data.error || "FriendsZone AI could not respond.");
      }
    }

    messageInput.value = "";
    cancelReply();
    messageInput.focus();
  } catch (error) {
    console.error("Send message error:", error);
    alert(error?.message || "Could not send the message.");
  }
}


// ==========================================
// SEND IMAGE
// ==========================================

async function sendImage(file) {
  if (!currentUser) {
    alert("Please wait for your account to load.");
    return;
  }

  if (isMuted(currentUser.uid)) {
    alert("You've been muted in this room and can't send messages right now.");
    return;
  }

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select an image.");
    return;
  }

  try {
    console.log("Compressing image...");
    const imageData = await compressImage(file);

    if (imageData.length > 700000) {
      alert("This image is too large. Please choose a smaller image.");
      return;
    }

    await addDoc(
      collection(db, "liveRoom", "messages", "messages"),
      {
        senderId: currentUser.uid,
        senderName: currentUserProfile.name,
        username: currentUserProfile.username,
        photoURL: currentUserProfile.photoURL,
        imageURL: imageData,
        text: "",
        reactions: {},
        timestamp: serverTimestamp(),
        replyTo: replyingTo
          ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text }
          : null
      }
    );

    cancelReply();
    console.log("Image sent successfully");
  } catch (error) {
    console.error("Send image error:", error);
    alert("Could not send the image.");
  }
}

if (imageBtn) {
  imageBtn.addEventListener("click", () => imageInput.click());
}

if (imageInput) {
  imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    if (!file) return;
    await sendImage(file);
    imageInput.value = "";
  });
}


// ==========================================
// VOICE MESSAGES
// ==========================================

async function startRecording() {
  if (!currentUser) {
    alert("Please wait for your account to load.");
    return;
  }

  if (isMuted(currentUser.uid)) {
    alert("You've been muted in this room and can't send messages right now.");
    return;
  }

  if (!navigator.mediaDevices || !window.MediaRecorder) {
    alert("Voice messages aren't supported in this browser.");
    return;
  }

  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    console.error("Microphone error:", error);
    alert("Could not access your microphone.");
    return;
  }

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(recordingStream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) recordedChunks.push(event.data);
  };

  mediaRecorder.start();
  recordingStartedAt = Date.now();

  micBtn.classList.add("recording");
  recordingIndicator.classList.add("show");
  recordingTimerEl.textContent = "0:00";

  recordingTimerHandle = setInterval(() => {
    const elapsed = (Date.now() - recordingStartedAt) / 1000;
    recordingTimerEl.textContent = formatDuration(elapsed);

    // Safety cap so voice notes can't grow unbounded.
    if (elapsed >= 120) {
      stopRecording(true);
    }
  }, 250);
}

function stopRecordingTracks() {
  if (recordingStream) {
    recordingStream.getTracks().forEach((track) => track.stop());
    recordingStream = null;
  }
  clearInterval(recordingTimerHandle);
  micBtn.classList.remove("recording");
  recordingIndicator.classList.remove("show");
}

function stopRecording(shouldSend) {
  if (!mediaRecorder) return;

  const durationSeconds = (Date.now() - recordingStartedAt) / 1000;

  mediaRecorder.onstop = async () => {
    stopRecordingTracks();

    if (!shouldSend) {
      recordedChunks = [];
      mediaRecorder = null;
      return;
    }

    if (recordedChunks.length === 0) {
      mediaRecorder = null;
      return;
    }

    const blob = new Blob(recordedChunks, { type: "audio/webm" });
    recordedChunks = [];
    mediaRecorder = null;

    await sendVoiceMessage(blob, durationSeconds);
  };

  mediaRecorder.stop();
}

async function sendVoiceMessage(blob, durationSeconds) {
  try {
    const path = `liveRoomAudio/${currentUser.uid}/${Date.now()}.webm`;
    const audioRef = storageRef(storage, path);

    await uploadBytes(audioRef, blob);
    const audioURL = await getDownloadURL(audioRef);

    await addDoc(
      collection(db, "liveRoom", "messages", "messages"),
      {
        senderId: currentUser.uid,
        senderName: currentUserProfile.name,
        username: currentUserProfile.username,
        photoURL: currentUserProfile.photoURL,
        audioURL: audioURL,
        audioDuration: durationSeconds,
        text: "",
        reactions: {},
        timestamp: serverTimestamp(),
        replyTo: replyingTo
          ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text }
          : null
      }
    );

    cancelReply();
    console.log("Voice message sent");
  } catch (error) {
    console.error("Send voice message error:", error);
    alert("Could not send the voice message.");
  }
}

if (micBtn) {
  micBtn.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      stopRecording(true);
    } else {
      startRecording();
    }
  });
}

if (cancelRecordingBtn) {
  cancelRecordingBtn.addEventListener("click", () => stopRecording(false));
}

if (sendRecordingBtn) {
  sendRecordingBtn.addEventListener("click", () => stopRecording(true));
}


// ==========================================
// SEND BUTTON / ENTER TO SEND
// ==========================================

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});


// ==========================================
// LOAD LIVE MESSAGES
// ==========================================

const messagesQuery = query(
  collection(db, "liveRoom", "messages", "messages"),
  orderBy("timestamp", "asc")
);

onSnapshot(
  messagesQuery,
  (snapshot) => {
    messages.innerHTML = "";

    snapshot.forEach((messageDoc) => {
      const data = messageDoc.data();
      const messageId = messageDoc.id;

      // Track sender identity for @mention lookups.
      if (data.username) {
        usernameToUid.set(data.username.toLowerCase(), data.senderId);
      }

      // ======================================
      // MESSAGE CONTAINER
      // ======================================

      const message = document.createElement("div");
      message.className = "public-message";
      message.dataset.messageId = messageId;

      // ======================================
      // PROFILE IMAGE
      // ======================================

      const avatar = document.createElement("img");
      avatar.className = "public-message-avatar";
      avatar.src = data.photoURL || data.profilePicture || data.photo || "https://via.placeholder.com/36";
      avatar.alt = data.senderName || data.username || "User";
      avatar.addEventListener("click", () => {
        openProfilePopup({
          uid: data.senderId,
          name: data.senderName || data.username || "User",
          username: data.username || "",
          photoURL: avatar.src,
          online: onlineUsersMap.has(data.senderId)
        });
      });

      // ======================================
      // CONTENT
      // ======================================

      const content = document.createElement("div");
      content.className = "public-message-content";

      // ---- name ----
      const name = document.createElement("div");
      name.className = "public-message-name";
      name.textContent = data.senderName || data.username || "User";
      name.addEventListener("click", () => avatar.dispatchEvent(new Event("click")));
      content.appendChild(name);

      // ---- username ----
      if (data.username && data.username !== data.senderName) {
        const username = document.createElement("div");
        username.style.fontSize = "10px";
        username.style.color = "#888";
        username.style.marginBottom = "3px";
        username.textContent = "@" + data.username;
        content.appendChild(username);
      }

      // ---- replied message ----
      if (data.replyTo) {
        const repliedMessage = document.createElement("div");
        repliedMessage.className = "message-reply";

        const repliedName = document.createElement("strong");
        repliedName.textContent = data.replyTo.senderName || "User";

        const repliedText = document.createElement("span");
        repliedText.textContent = data.replyTo.text || "📸 Image";

        repliedMessage.appendChild(repliedName);
        repliedMessage.appendChild(repliedText);
        content.appendChild(repliedMessage);
      }

      // ---- message text (with @mention highlighting) ----
      let mentionsMe = false;

      if (data.text) {
        const text = document.createElement("div");
        text.className = "public-message-text";

        const rendered = renderTextWithMentions(data.text);
        text.innerHTML = rendered.html;
        mentionsMe = rendered.mentionsMe;

        content.appendChild(text);
      }

      // ---- image message ----
      if (data.imageURL) {
        const wrapper = document.createElement("div");
        wrapper.className = "public-message-text";
        wrapper.style.padding = "4px";

        const image = document.createElement("img");
        image.src = data.imageURL;
        image.alt = "Shared image";
        image.style.maxWidth = "260px";
        image.style.maxHeight = "300px";
        image.style.width = "auto";
        image.style.height = "auto";
        image.style.display = "block";
        image.style.borderRadius = "12px";
        image.style.objectFit = "cover";
        image.style.cursor = "pointer";
        image.addEventListener("click", () => window.open(data.imageURL, "_blank"));

        wrapper.appendChild(image);
        content.appendChild(wrapper);
      }

      // ---- voice message ----
      if (data.audioURL) {
        const wrapper = document.createElement("div");
        wrapper.className = "public-message-text voice-message";

        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "voice-play-btn";
        playBtn.textContent = "▶";

        const wave = document.createElement("div");
        wave.className = "voice-wave";
        for (let i = 0; i < 22; i++) {
          const bar = document.createElement("span");
          const h = 6 + Math.round(Math.random() * 14);
          bar.style.height = h + "px";
          wave.appendChild(bar);
        }

        const duration = document.createElement("span");
        duration.className = "voice-duration";
        duration.textContent = formatDuration(data.audioDuration);

        const audioEl = new Audio(data.audioURL);

        playBtn.addEventListener("click", () => {
          if (activeAudioEl && activeAudioEl !== audioEl) {
            activeAudioEl.pause();
          }

          if (audioEl.paused) {
            audioEl.play();
            activeAudioEl = audioEl;
            playBtn.textContent = "⏸";
            wave.classList.add("playing");
          } else {
            audioEl.pause();
            playBtn.textContent = "▶";
            wave.classList.remove("playing");
          }
        });

        audioEl.addEventListener("ended", () => {
          playBtn.textContent = "▶";
          wave.classList.remove("playing");
        });

        wrapper.appendChild(playBtn);
        wrapper.appendChild(wave);
        wrapper.appendChild(duration);
        content.appendChild(wrapper);
      }

      if (mentionsMe) {
        message.classList.add("mentioned-me");
      }

      // ---- time ----
      const time = document.createElement("div");
      time.className = "public-message-time";

      if (data.timestamp) {
        const date = data.timestamp.toDate();
        time.textContent = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }

      content.appendChild(time);

      // ---- reactions ----
      const reactionsBar = document.createElement("div");
      reactionsBar.className = "message-reactions";

      const reactions = data.reactions || {};
      Object.keys(reactions).forEach((emoji) => {
        const uids = reactions[emoji] || [];
        if (uids.length === 0) return;

        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "reaction-chip" + (currentUser && uids.includes(currentUser.uid) ? " mine" : "");
        chip.innerHTML = `${emoji} <span class="count">${uids.length}</span>`;
        chip.addEventListener("click", () => toggleReaction(messageId, emoji));
        reactionsBar.appendChild(chip);
      });

      const addReactionBtn = document.createElement("button");
      addReactionBtn.type = "button";
      addReactionBtn.className = "add-reaction-btn";
      addReactionBtn.textContent = "😊";
      addReactionBtn.title = "React";
      addReactionBtn.addEventListener("click", () => openReactionPicker(addReactionBtn, messageId));
      reactionsBar.appendChild(addReactionBtn);

      content.appendChild(reactionsBar);

      // ---- reply button ----
      const replyBtn = document.createElement("button");
      replyBtn.type = "button";
      replyBtn.textContent = "↩️ Reply";
      replyBtn.style.border = "none";
      replyBtn.style.background = "transparent";
      replyBtn.style.color = "#555";
      replyBtn.style.fontSize = "10px";
      replyBtn.style.padding = "3px 8px 3px 0";
      replyBtn.style.cursor = "pointer";
      replyBtn.addEventListener("click", () => startReply(data, messageId));
      content.appendChild(replyBtn);

      // ---- pin button (owner/admin only) ----
      if (currentUser && isModerator(currentUser.uid)) {
        const pinBtn = document.createElement("button");
        pinBtn.type = "button";
        pinBtn.className = "pin-msg-btn";
        const isCurrentlyPinned = roomMeta.pinnedMessage && roomMeta.pinnedMessage.id === messageId;
        pinBtn.textContent = isCurrentlyPinned ? "📌 Unpin" : "📌 Pin";
        pinBtn.style.border = "none";
        pinBtn.style.fontSize = "10px";
        pinBtn.style.padding = "3px 8px";
        pinBtn.style.borderRadius = "10px";
        pinBtn.style.cursor = "pointer";
        pinBtn.style.marginRight = "4px";
        pinBtn.addEventListener("click", async () => {
          if (isCurrentlyPinned) {
            await updateDoc(metaRef, { pinnedMessage: deleteField() });
          } else {
            await pinMessage(messageId, data);
          }
        });
        content.appendChild(pinBtn);
      }

      // ---- delete button (own messages) ----
      if (currentUser && data.senderId === currentUser.uid) {
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.textContent = "Delete";
        deleteBtn.style.border = "none";
        deleteBtn.style.background = "transparent";
        deleteBtn.style.color = "#d32f2f";
        deleteBtn.style.fontSize = "10px";
        deleteBtn.style.padding = "3px 0";
        deleteBtn.style.cursor = "pointer";

        deleteBtn.addEventListener("click", async () => {
          const confirmed = confirm("Delete this message?");
          if (!confirmed) return;

          try {
            await deleteDoc(doc(db, "liveRoom", "messages", "messages", messageId));
            console.log("Message deleted:", messageId);
          } catch (error) {
            console.error("Delete message error:", error);
            alert("Could not delete the message.");
          }
        });

        content.appendChild(deleteBtn);
      }

      message.appendChild(avatar);
      message.appendChild(content);
      messages.appendChild(message);
    });

    messages.scrollTop = messages.scrollHeight;
  },
  (error) => {
    console.error("Message loading error:", error);
  }
);


// ==========================================
// BACK BUTTON
// ==========================================

backBtn.addEventListener("click", () => {
  window.history.back();
});
