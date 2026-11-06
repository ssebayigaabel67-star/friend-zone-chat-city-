// ==========================================================
// FRIENDS ZONE — SHARED FEATURES
// Used by BOTH Home.js (homepage) and live-room.js (live room)
//
//   1. Message bar / screen-height fix
//   2. Reliable online / offline status
//   3. Titles (small badges next to names)
//   4. Report dialog
//   5. Profile banners
//   6. Themes (background for the whole page)
// ==========================================================

export const ADMIN_UID = "Ur72jn1ON4Z7zVdJAvgM2orOpnl2";

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function injectCSS(id, css) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function safeGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

function toast(message) {
  const t = document.createElement("div");
  t.className = "fz-toast";
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

// ==========================================================
// 1. MESSAGE BAR / SCREEN HEIGHT FIX
// ----------------------------------------------------------
// 100vh on phones includes the browser's address bar, so the
// bottom message bar slid under the screen. We measure the
// REAL visible height and use it instead.
// ==========================================================

function setAppHeight() {
  const h = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;
  document.documentElement.style.setProperty(
    "--fz-app-h",
    Math.round(h) + "px"
  );
}

setAppHeight();
window.addEventListener("resize", setAppHeight);
window.addEventListener("orientationchange", () => setTimeout(setAppHeight, 200));
window.addEventListener("pageshow", setAppHeight);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    setAppHeight();
    // keep the page from being scrolled away when the keyboard opens
    window.scrollTo(0, 0);
  });
}

const LAYOUT_CSS = `
html, body {
  height: var(--fz-app-h, 100dvh) !important;
  max-height: var(--fz-app-h, 100dvh) !important;
  overflow: hidden !important;
}
.live-container {
  height: var(--fz-app-h, 100dvh) !important;
}
.container {
  height: calc(var(--fz-app-h, 100dvh) - 60px) !important;
}
@media (max-width: 600px) {
  .container {
    height: calc(var(--fz-app-h, 100dvh) - 55px) !important;
  }
}
.sidebar {
  height: calc(var(--fz-app-h, 100dvh) - 60px) !important;
}
@media (max-width: 600px) {
  .sidebar {
    height: calc(var(--fz-app-h, 100dvh) - 55px) !important;
  }
}
/* The message bar must ALWAYS stay visible at the bottom */
.bottom,
.message-bar {
  flex: 0 0 auto !important;
  flex-shrink: 0 !important;
  position: sticky !important;
  bottom: 0 !important;
  z-index: 30 !important;
}
#messages,
.messages {
  min-height: 0 !important;
}
`;

// ==========================================================
// 2. ONLINE / OFFLINE STATUS
// ----------------------------------------------------------
// Problem before: "online" was set once and "offline" only
// when the page closed — phones often never run that code.
// Now every open page sends a heartbeat each minute, and a
// person only counts as online if the heartbeat is recent.
// ==========================================================

export const ONLINE_WINDOW_MS = 150000; // 2.5 minutes

export function isOnlineNow(data) {
  if (!data || data.online !== true) return false;

  const lastSeen = data.lastSeen;
  if (!lastSeen) return true; // timestamp still being written

  let ms = 0;
  if (typeof lastSeen.toMillis === "function") {
    ms = lastSeen.toMillis();
  } else if (typeof lastSeen.seconds === "number") {
    ms = lastSeen.seconds * 1000;
  } else {
    ms = Number(lastSeen);
  }

  if (!ms) return true;
  return Date.now() - ms < ONLINE_WINDOW_MS;
}

export function startPresence({ db, auth, doc, updateDoc, serverTimestamp }) {
  if (window.__fzPresenceStarted) return;
  window.__fzPresenceStarted = true;

  function write(online) {
    const user = auth.currentUser;
    if (!user) return;
    updateDoc(doc(db, "users", user.uid), {
      online: online,
      lastSeen: serverTimestamp()
    }).catch(() => {});
  }

  function beat() {
    if (document.visibilityState === "visible") write(true);
  }

  setInterval(beat, 60000);

  document.addEventListener("visibilitychange", () => {
    write(document.visibilityState === "visible");
  });

  window.addEventListener("pagehide", () => write(false));
  window.addEventListener("pageshow", beat);
  window.addEventListener("focus", beat);
  window.addEventListener("online", beat);

  beat();
}

// ==========================================================
// 3. TITLES
// ----------------------------------------------------------
// Titles live in a separate "titles" collection ({title,color})
// so ONLY the owner can give them (see the Firestore rules).
// ==========================================================

const titleCache = new Map();   // uid -> { kind, title, color }
const pointsCache = new Map();  // uid -> { points, at }
const pointsPending = new Set();
let pointsFb = null;

// (kept for older "text" titles)
export const TITLE_COLORS = [
  { name: "Gold", value: "#d4a017" },
  { name: "Red", value: "#e53935" },
  { name: "Green", value: "#2e9e5b" },
  { name: "Blue", value: "#1e88e5" },
  { name: "Purple", value: "#8e44ad" },
  { name: "Black", value: "#222222" }
];

// White-diamond tiers, based on a person's all-time points.
// Change the numbers here if you want different levels.
export const DIAMOND_TIERS = [
  { min: 5000, count: 3, glow: 3, name: "Legend" },
  { min: 1500, count: 2, glow: 2, name: "Elite" },
  { min: 500,  count: 1, glow: 2, name: "Pro" },
  { min: 150,  count: 1, glow: 1, name: "Rising" },
  { min: 0,    count: 1, glow: 0, name: "Member" }
];

export function diamondTier(points) {
  const p = Number(points) || 0;
  return DIAMOND_TIERS.find((t) => p >= t.min) || DIAMOND_TIERS[DIAMOND_TIERS.length - 1];
}

const CROWN_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M2.5 8.5l4.6 4.1L12 4l4.9 8.6 4.6-4.1-1.8 10H4.3z" fill="#f7c531" stroke="#b8860b" stroke-width="1.2" stroke-linejoin="round"/>' +
  '<rect x="4.3" y="19.6" width="15.4" height="2.2" rx="1.1" fill="#e0a800" stroke="#b8860b" stroke-width="1"/>' +
  '<circle cx="12" cy="4" r="1.5" fill="#ff4d6d"/>' +
  '<circle cx="2.5" cy="8.5" r="1.3" fill="#4dd2ff"/>' +
  '<circle cx="21.5" cy="8.5" r="1.3" fill="#4dd2ff"/>' +
  '</svg>';

const STAFF_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z" fill="#5b6bff" stroke="#2f3bb8" stroke-width="1.2" stroke-linejoin="round"/>' +
  '<path d="M12 7l1.5 3.2 3.5.4-2.6 2.4.7 3.5L12 14.7l-3.1 1.8.7-3.5L7 10.6l3.5-.4z" fill="#fff"/>' +
  '</svg>';

const DIAMOND_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M6.2 3h11.6l4.2 6L12 21.5 2 9z" fill="#ffffff" stroke="#8fb8ff" stroke-width="1.2" stroke-linejoin="round"/>' +
  '<path d="M2 9h20M9.2 3L7.5 9 12 21.5 16.5 9 14.8 3" fill="none" stroke="#a9c7ff" stroke-width="1"/>' +
  '</svg>';

/**
 * kind: "owner" (rotating crown) | "staff" (shield) | "diamond" (white diamond by points)
 */
export function renderBadge(kind, opts) {
  const o = opts || {};
  const size = o.big ? " big" : "";

  if (kind === "owner") {
    return `<span class="fz-badge crown${size}" title="Owner" aria-label="Owner">${CROWN_SVG}${o.big ? '<span class="fz-badge-label">Owner</span>' : ""}</span>`;
  }
  if (kind === "staff") {
    return `<span class="fz-badge staff${size}" title="Staff" aria-label="Staff">${STAFF_SVG}${o.big ? '<span class="fz-badge-label">Staff</span>' : ""}</span>`;
  }

  const points = Number(o.points) || 0;
  const tier = diamondTier(points);
  return `<span class="fz-badge diamond g${tier.glow}${size}" title="${esc(tier.name)} • ${points} pts" aria-label="${esc(tier.name)}">${DIAMOND_SVG.repeat(tier.count)}${o.big ? `<span class="fz-badge-label">Diamond ${esc(tier.name)}</span>` : ""}</span>`;
}

function ensurePoints(uid) {
  if (!pointsFb || !uid) return;
  const cached = pointsCache.get(uid);
  if (cached && Date.now() - cached.at < 300000) return;
  if (pointsPending.has(uid)) return;

  pointsPending.add(uid);
  pointsFb
    .getDoc(pointsFb.doc(pointsFb.db, "users", uid))
    .then((snap) => {
      const pts = snap.exists() ? Number(snap.data().rankPoints) || 0 : 0;
      pointsCache.set(uid, { points: pts, at: Date.now() });
    })
    .catch(() => {
      pointsCache.set(uid, { points: 0, at: Date.now() });
    })
    .finally(() => {
      pointsPending.delete(uid);
      scheduleSlotRefresh();
    });
}

let slotRefreshTimer = null;
function scheduleSlotRefresh() {
  clearTimeout(slotRefreshTimer);
  slotRefreshTimer = setTimeout(() => refreshTitleSlots(), 60);
}

export function titleBadgeHTML(uid, opts) {
  if (!uid) return "";
  const o = opts || {};

  if (uid === ADMIN_UID) return withLabel(renderBadge("owner", o), "Owner", "owner", o);

  const t = titleCache.get(uid);
  if (t && t.kind === "staff") return withLabel(renderBadge("staff", o), "Staff", "staff", o);

  // older text titles still work
  if (t && t.title) {
    return `<span class="fz-title" style="--c:${esc(t.color || "#d4a017")}">${esc(t.title)}</span>`;
  }

  // everyone else: white diamond that grows with points
  ensurePoints(uid);
  const cached = pointsCache.get(uid);
  if (!cached) return "";
  const tier = diamondTier(cached.points);
  return withLabel(
    renderBadge("diamond", { points: cached.points, big: o.big }),
    "Diamond · " + tier.name,
    "diamond",
    o
  );
}

// In profile popovers the badge also shows its NAME next to the icon
function withLabel(badgeHtml, text, kind, o) {
  if (!o || !o.big) return badgeHtml;
  return `<span class="fz-badge-wrap">${badgeHtml}<span class="fz-badge-label ${kind}">${esc(text)}</span></span>`;
}

export function refreshTitleSlots(root) {
  (root || document)
    .querySelectorAll(".fz-title-slot[data-uid]")
    .forEach((el) => {
      el.innerHTML = titleBadgeHTML(el.dataset.uid, {
        big: el.classList.contains("big")
      });
    });
}

export function watchTitles({ db, collection, onSnapshot, doc, getDoc }) {
  if (doc && getDoc) pointsFb = { db, doc, getDoc };

  if (window.__fzTitlesWatched) return;
  window.__fzTitlesWatched = true;

  onSnapshot(
    collection(db, "titles"),
    (snap) => {
      titleCache.clear();
      snap.forEach((d) => {
        const v = d.data() || {};
        if (v.kind === "staff") {
          titleCache.set(d.id, { kind: "staff" });
        } else if (v.title) {
          titleCache.set(d.id, {
            kind: "custom",
            title: String(v.title).slice(0, 20),
            color: v.color || "#d4a017"
          });
        }
      });
      refreshTitleSlots();
    },
    (error) => console.warn("Titles could not be loaded:", error)
  );
}

// ==========================================================
// 4. REPORT DIALOG
// ==========================================================

const REPORT_REASONS = [
  "Spam or advertising",
  "Harassment or bullying",
  "Hate speech",
  "Inappropriate or sexual content",
  "Scam or fake account",
  "Threats or violence",
  "Under-age user",
  "Other"
];

export function openReportDialog({
  fb, target, context, messageId, messageText
}) {
  const me = fb.auth.currentUser;
  if (!me) {
    alert("Please log in first.");
    return;
  }
  if (!target || !target.uid) return;
  if (target.uid === me.uid) {
    toast("You can't report yourself.");
    return;
  }

  const old = document.getElementById("fzReportOverlay");
  if (old) old.remove();

  const overlay = document.createElement("div");
  overlay.id = "fzReportOverlay";
  overlay.className = "fz-overlay show";
  overlay.innerHTML = `
    <div class="fz-card" role="dialog" aria-modal="true">
      <h3>🚩 Report ${esc(target.name || "user")}</h3>
      <p class="fz-sub">Tell us what is wrong. The owner will review it.</p>
      <label>Reason</label>
      <select id="fzReportReason">
        ${REPORT_REASONS.map((r) => `<option>${esc(r)}</option>`).join("")}
      </select>
      <label>Details (optional)</label>
      <textarea id="fzReportDetails" maxlength="500"
        placeholder="What happened?"></textarea>
      ${messageText ? `<div class="fz-quote">“${esc(String(messageText).slice(0, 160))}”</div>` : ""}
      <button id="fzReportSend" class="fz-btn danger" type="button">Send report</button>
      <button id="fzReportCancel" class="fz-btn ghost" type="button">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#fzReportCancel").addEventListener("click", close);

  const sendBtn = overlay.querySelector("#fzReportSend");
  sendBtn.addEventListener("click", async () => {
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";
    try {
      await fb.addDoc(fb.collection(fb.db, "reports"), {
        reporterId: me.uid,
        reporterName: me.displayName || me.email || "User",
        targetId: target.uid,
        targetName: target.name || "",
        reason: overlay.querySelector("#fzReportReason").value,
        details: overlay.querySelector("#fzReportDetails").value.trim().slice(0, 500),
        context: context || "unknown",
        messageId: messageId || "",
        messageText: messageText ? String(messageText).slice(0, 300) : "",
        status: "open",
        createdAt: fb.serverTimestamp()
      });
      close();
      toast("✅ Report sent. Thank you.");
    } catch (error) {
      console.error("Report error:", error);
      sendBtn.disabled = false;
      sendBtn.textContent = "Send report";
      alert("Could not send the report. Please try again.");
    }
  });
}

// ==========================================================
// 5. BANNERS + PROFILE DECORATION
// ----------------------------------------------------------
// Banner = a wide picture behind the profile photo.
// Stored (small, compressed) in banners/{uid}.
// ==========================================================

const bannerCache = new Map();

async function loadBanner(fb, uid) {
  if (bannerCache.has(uid)) return bannerCache.get(uid);
  try {
    const snap = await fb.getDoc(fb.doc(fb.db, "banners", uid));
    const data = snap.exists() ? snap.data().data || "" : "";
    bannerCache.set(uid, data);
    return data;
  } catch (e) {
    return "";
  }
}

const BANNER_W = 800;
const BANNER_H = 570; // tall, like the real banner area in the popup

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the picture."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file is not a picture."));
      img.onload = () => resolve(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * mode "fill" = picture fills the banner (edges may be cropped)
 * mode "fit"  = the WHOLE picture is shown (soft background behind it)
 */
function renderBannerImage(img, mode) {
  const canvas = document.createElement("canvas");
  canvas.width = BANNER_W;
  canvas.height = BANNER_H;
  const ctx = canvas.getContext("2d");

  const cover = Math.max(BANNER_W / img.width, BANNER_H / img.height);
  const cw = img.width * cover;
  const ch = img.height * cover;

  if (mode === "fit") {
    // soft blurred copy of the picture as the background
    try { ctx.filter = "blur(22px)"; } catch (e) {}
    ctx.drawImage(img, (BANNER_W - cw) / 2, (BANNER_H - ch) / 2, cw, ch);
    try { ctx.filter = "none"; } catch (e) {}
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, BANNER_W, BANNER_H);

    // whole picture, centred
    const contain = Math.min(BANNER_W / img.width, BANNER_H / img.height);
    const w = img.width * contain;
    const h = img.height * contain;
    ctx.drawImage(img, (BANNER_W - w) / 2, (BANNER_H - h) / 2, w, h);
  } else {
    ctx.drawImage(img, (BANNER_W - cw) / 2, (BANNER_H - ch) / 2, cw, ch);
  }

  return canvas.toDataURL("image/jpeg", 0.74);
}

function openBannerEditor(fb, uid, img, onDone) {
  const old = document.getElementById("fzBannerOverlay");
  if (old) old.remove();

  let mode = "fill";
  const overlay = document.createElement("div");
  overlay.id = "fzBannerOverlay";
  overlay.className = "fz-overlay show";
  overlay.innerHTML = `
    <div class="fz-card" role="dialog" aria-modal="true">
      <h3>🖼️ Your banner</h3>
      <p class="fz-sub">Choose how your picture sits in the banner.</p>
      <img id="fzBannerPreview" alt="Banner preview"
           style="width:100%;border-radius:12px;display:block;background:#222;aspect-ratio:${BANNER_W}/${BANNER_H};object-fit:cover;">
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button type="button" class="fz-btn ghost" data-mode="fill" style="flex:1">Fill banner</button>
        <button type="button" class="fz-btn ghost" data-mode="fit" style="flex:1">Fit whole picture</button>
      </div>
      <button id="fzBannerSave" class="fz-btn danger" style="background:#176b57" type="button">Save banner</button>
      <button id="fzBannerCancel" class="fz-btn ghost" type="button">Cancel</button>
    </div>`;
  document.body.appendChild(overlay);

  const preview = overlay.querySelector("#fzBannerPreview");
  const modeBtns = overlay.querySelectorAll("[data-mode]");

  function refresh() {
    preview.src = renderBannerImage(img, mode);
    modeBtns.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.style.outline = on ? "3px solid #7b5cff" : "none";
    });
  }
  refresh();

  modeBtns.forEach((b) => {
    b.addEventListener("click", () => {
      mode = b.dataset.mode;
      refresh();
    });
  });

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelector("#fzBannerCancel").addEventListener("click", close);

  const saveBtn = overlay.querySelector("#fzBannerSave");
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    try {
      const data = renderBannerImage(img, mode);
      await fb.setDoc(fb.doc(fb.db, "banners", uid), {
        data: data,
        updatedAt: fb.serverTimestamp()
      });
      bannerCache.set(uid, data);
      close();
      toast("✅ Banner updated.");
      if (onDone) onDone(data);
    } catch (error) {
      console.error("Banner error:", error);
      saveBtn.disabled = false;
      saveBtn.textContent = "Save banner";
      alert("Could not save the banner: " + error.message);
    }
  });
}

function pickBanner(fb, uid, onDone) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const img = await readImageFile(file);
      openBannerEditor(fb, uid, img, onDone);
    } catch (error) {
      alert(error.message);
    }
  });
  input.click();
}

/**
 * Adds banner + title + Report / Change-banner button to a profile popup.
 *   root     - the popup box element
 *   avatarEl - the profile picture <img>
 *   nameEl   - the name element
 *   uid      - whose profile this is
 *   fb       - { auth, db, doc, getDoc, setDoc, addDoc, collection, serverTimestamp }
 *   context  - "home" or "live"
 */
export async function decorateProfile({
  root, avatarEl, nameEl, uid, fb, context, displayName
}) {
  if (!root || !uid) return;

  root.querySelectorAll(".fz-banner, .fz-title-row, .fz-profile-actions")
    .forEach((el) => el.remove());

  const cs = window.getComputedStyle(root);
  if (cs.position === "static") root.style.position = "relative";
  root.classList.add("fz-profile-root");

  // ---- banner ----
  const banner = document.createElement("div");
  banner.className = "fz-banner";
  root.insertBefore(banner, root.firstChild);

  if (avatarEl) avatarEl.classList.add("fz-avatar-over");

  // The banner stretches from the very top down to the rank card
  function fitBanner() {
    const rank = root.querySelector("#userPopoverRank, #profileModalRank");
    const h = rank ? rank.offsetTop - 4 : 200;
    banner.style.height = Math.max(190, h) + "px";
  }
  fitBanner();
  setTimeout(fitBanner, 250);
  setTimeout(fitBanner, 900);

  function showBanner(data) {
    // blurred copy fills the space, the real picture fits fully on top
    banner.innerHTML =
      '<div class="fz-banner-bg"></div><div class="fz-banner-img"></div>';
    banner.querySelector(".fz-banner-bg").style.backgroundImage = `url("${data}")`;
    banner.querySelector(".fz-banner-img").style.backgroundImage = `url("${data}")`;
    banner.classList.add("has-image");
    root.classList.add("fz-has-banner");
  }

  loadBanner(fb, uid).then((data) => {
    if (data) showBanner(data);
  });

  // ---- title ----
  if (nameEl) {
    const row = document.createElement("div");
    row.className = "fz-title-row";
    row.innerHTML = `<span class="fz-title-slot big" data-uid="${esc(uid)}">${titleBadgeHTML(uid, { big: true })}</span>`;
    nameEl.insertAdjacentElement("afterend", row);
  }

  // ---- actions ----
  const me = fb.auth.currentUser;
  const actions = document.createElement("div");
  actions.className = "fz-profile-actions";

  if (me && me.uid === uid) {
    const bannerBtn = document.createElement("button");
    bannerBtn.type = "button";
    bannerBtn.className = "fz-btn ghost";
    bannerBtn.textContent = "🖼️ Change banner";
    bannerBtn.addEventListener("click", () => {
      pickBanner(fb, uid, (data) => showBanner(data));
    });
    actions.appendChild(bannerBtn);
  } else if (me) {
    const reportBtn = document.createElement("button");
    reportBtn.type = "button";
    reportBtn.className = "fz-btn report";
    reportBtn.textContent = "🚩 Report";
    reportBtn.addEventListener("click", () => {
      openReportDialog({
        fb,
        target: {
          uid,
          name: displayName || (nameEl ? nameEl.textContent : "")
        },
        context
      });
    });
    actions.appendChild(reportBtn);
  }

  root.appendChild(actions);
}

// ==========================================================
// 6. THEMES
// ----------------------------------------------------------
// One choice changes the background of BOTH the homepage and
// the live room (saved in this browser, shared by both pages).
// ==========================================================

function emojiPattern(emojis, tile, opacity, size) {
  const items = emojis
    .map((e, i) => {
      const x = 20 + ((i * 97) % (tile - 40));
      const y = 30 + ((i * 61) % (tile - 40));
      return `<text x="${x}" y="${y}" font-size="${size}" opacity="${opacity}">${e}</text>`;
    })
    .join("");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tile}' height='${tile}'>${items}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const FZ_THEMES = [
  {
    id: "halloween", name: "Halloween", emoji: "🎃", dark: true,
    color: "#150a04",
    image: [
      emojiPattern(["🦇", "🎃", "🕷️", "🦇", "👻"], 260, 0.22, 26),
      "radial-gradient(circle at 28% 24%, rgba(255,170,60,.65) 0 9%, rgba(255,140,30,.18) 10% 18%, transparent 19%)",
      "linear-gradient(180deg, #1b0c05 0%, #3a1a07 55%, #0e0603 100%)"
    ],
    size: ["260px 260px", "100% 100%", "100% 100%"],
    repeat: ["repeat", "no-repeat", "no-repeat"]
  },
  {
    id: "midnight", name: "Midnight Stars", emoji: "🌙", dark: true,
    color: "#070b1f",
    image: [
      emojiPattern(["⭐", "✨", "·", "⭐", "✨"], 240, 0.28, 16),
      "linear-gradient(180deg, #070b1f 0%, #14204a 100%)"
    ],
    size: ["240px 240px", "100% 100%"],
    repeat: ["repeat", "no-repeat"]
  },
  {
    id: "galaxy", name: "Galaxy", emoji: "🪐", dark: true,
    color: "#100a24",
    image: [
      emojiPattern(["🪐", "⭐", "✨", "☄️"], 300, 0.22, 22),
      "radial-gradient(circle at 80% 15%, rgba(190,80,255,.45), transparent 40%)",
      "radial-gradient(circle at 15% 85%, rgba(60,120,255,.4), transparent 45%)",
      "linear-gradient(180deg, #0c0720, #1e1040)"
    ],
    size: ["300px 300px", "100% 100%", "100% 100%", "100% 100%"],
    repeat: ["repeat", "no-repeat", "no-repeat", "no-repeat"]
  },
  {
    id: "neon", name: "Neon City", emoji: "🌆", dark: true,
    color: "#0b0b1a",
    image: [
      "linear-gradient(rgba(0,255,230,.10) 1px, transparent 1px)",
      "linear-gradient(90deg, rgba(255,0,200,.10) 1px, transparent 1px)",
      "linear-gradient(180deg, #0b0b1a, #240a3a 70%, #3b0a4a)"
    ],
    size: ["40px 40px", "40px 40px", "100% 100%"],
    repeat: ["repeat", "repeat", "no-repeat"]
  },
  {
    id: "ocean", name: "Ocean", emoji: "🌊", dark: false,
    color: "#bfe9ff",
    image: [
      emojiPattern(["🐠", "🫧", "🐚", "🐟", "🫧"], 260, 0.35, 24),
      "linear-gradient(180deg, #d8f3ff 0%, #8fd3f4 60%, #4aa8d8 100%)"
    ],
    size: ["260px 260px", "100% 100%"],
    repeat: ["repeat", "no-repeat"]
  },
  {
    id: "sunset", name: "Sunset", emoji: "🌅", dark: false,
    color: "#ffb48a",
    image: ["linear-gradient(180deg, #ffd1a1 0%, #ff8e72 50%, #b94b8a 100%)"],
    size: ["100% 100%"],
    repeat: ["no-repeat"]
  },
  {
    id: "aurora", name: "Aurora", emoji: "🌌", dark: true,
    color: "#04141c",
    image: [
      "radial-gradient(ellipse at 20% 20%, rgba(0,255,170,.35), transparent 50%)",
      "radial-gradient(ellipse at 80% 35%, rgba(120,90,255,.35), transparent 55%)",
      "linear-gradient(180deg, #04141c, #0a2a33)"
    ],
    size: ["100% 100%", "100% 100%", "100% 100%"],
    repeat: ["no-repeat", "no-repeat", "no-repeat"]
  },
  {
    id: "forest", name: "Forest", emoji: "🌲", dark: false,
    color: "#cfe9c8",
    image: [
      emojiPattern(["🍃", "🌿", "🍀", "🍃"], 240, 0.4, 24),
      "linear-gradient(180deg, #e3f4d7 0%, #a5d49a 100%)"
    ],
    size: ["240px 240px", "100% 100%"],
    repeat: ["repeat", "no-repeat"]
  },
  {
    id: "sakura", name: "Cherry Blossom", emoji: "🌸", dark: false,
    color: "#ffe3ee",
    image: [
      emojiPattern(["🌸", "🌸", "💮", "🌸"], 240, 0.4, 24),
      "linear-gradient(180deg, #fff0f6 0%, #ffc2d9 100%)"
    ],
    size: ["240px 240px", "100% 100%"],
    repeat: ["repeat", "no-repeat"]
  },
  {
    id: "candy", name: "Candy", emoji: "🍭", dark: false,
    color: "#ffe6fb",
    image: [
      emojiPattern(["🍭", "🍬", "🧁", "🍩"], 260, 0.4, 24),
      "linear-gradient(135deg, #ffe0f7 0%, #d9e8ff 100%)"
    ],
    size: ["260px 260px", "100% 100%"],
    repeat: ["repeat", "no-repeat"]
  },
  {
    id: "love", name: "Love", emoji: "💖", dark: true,
    color: "#2a0a1c",
    image: [
      emojiPattern(["💖", "💗", "❤️", "💕"], 240, 0.22, 22),
      "linear-gradient(180deg, #2a0a1c, #5a1238)"
    ],
    size: ["240px 240px", "100% 100%"],
    repeat: ["repeat", "no-repeat"]
  },
  {
    id: "carbon", name: "Carbon Dark", emoji: "🖤", dark: true,
    color: "#101010",
    image: ["linear-gradient(180deg, #181818, #0a0a0a)"],
    size: ["100% 100%"],
    repeat: ["no-repeat"]
  }
];

function themeBackgroundCSS(theme) {
  return `
    background-color: ${theme.color} !important;
    background-image: ${theme.image.join(", ")} !important;
    background-size: ${theme.size.join(", ")} !important;
    background-repeat: ${theme.repeat.join(", ")} !important;
    background-position: center !important;
    background-attachment: fixed !important;
  `;
}

export function getSavedTheme() {
  return safeGet("fz_theme") || "default";
}

export function applyFzTheme(id) {
  const theme = FZ_THEMES.find((t) => t.id === id);
  const root = document.documentElement;

  if (!theme) {
    root.removeAttribute("data-fz-theme");
    root.removeAttribute("data-fz-dark");
    const style = document.getElementById("fz-theme-style");
    if (style) style.textContent = "";
    return;
  }

  root.setAttribute("data-fz-theme", theme.id);
  if (theme.dark) root.setAttribute("data-fz-dark", "1");
  else root.removeAttribute("data-fz-dark");

  injectCSS("fz-theme-style", `
    html[data-fz-theme] body { ${themeBackgroundCSS(theme)} }

    /* let the theme show through the page */
    html[data-fz-theme] .live-container,
    html[data-fz-theme] .chat-section,
    html[data-fz-theme] .messages,
    html[data-fz-theme] .chat-area,
    html[data-fz-theme] .chat-container,
    html[data-fz-theme] #messages {
      background: transparent !important;
    }

    html[data-fz-dark] .typing-indicator,
    html[data-fz-dark] #typingStatus,
    html[data-fz-dark] .welcome-message,
    html[data-fz-dark] .date-divider,
    html[data-fz-dark] .day-separator {
      color: #f1f1f1 !important;
    }
    html[data-fz-dark] .public-message-name { text-shadow: 0 0 6px rgba(0,0,0,.6); }
  `);
}

export function chooseTheme(id) {
  safeSet("fz_theme", id);
  applyFzTheme(id);
}

export function openThemePicker() {
  const old = document.getElementById("fzThemeOverlay");
  if (old) old.remove();

  const current = getSavedTheme();
  const overlay = document.createElement("div");
  overlay.id = "fzThemeOverlay";
  overlay.className = "fz-overlay show";

  const tiles = [{ id: "default", name: "Default", emoji: "✨" }, ...FZ_THEMES]
    .map((t) => {
      const full = FZ_THEMES.find((x) => x.id === t.id);
      const style = full
        ? `background-color:${full.color};background-image:${full.image.join(",")};background-size:${full.size.join(",")};background-repeat:${full.repeat.join(",")};background-position:center;`
        : "background:linear-gradient(135deg,#ffffff,#e9e9f5);";
      const textColor = full && full.dark ? "#fff" : "#222";
      return `
        <button type="button" class="fz-theme-tile${t.id === current ? " active" : ""}"
                data-id="${esc(t.id)}" style="${style}color:${textColor}">
          <span class="e">${t.emoji}</span>
          <span class="n">${esc(t.name)}</span>
        </button>`;
    })
    .join("");

  overlay.innerHTML = `
    <div class="fz-card wide" role="dialog" aria-modal="true">
      <h3>🎨 Choose a theme</h3>
      <p class="fz-sub">It changes the background of the homepage and the live room.</p>
      <div class="fz-theme-grid">${tiles}</div>
      <button id="fzThemeClose" class="fz-btn ghost" type="button">Close</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#fzThemeClose").addEventListener("click", close);

  overlay.querySelectorAll(".fz-theme-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      chooseTheme(tile.dataset.id);
      overlay.querySelectorAll(".fz-theme-tile")
        .forEach((x) => x.classList.toggle("active", x === tile));
      toast("Theme changed");
    });
  });
}

// ==========================================================
// STYLES FOR EVERYTHING ABOVE
// ==========================================================

const UI_CSS = `
.fz-title {
  display: inline-block;
  vertical-align: middle;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--c, #d4a017);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  letter-spacing: .3px;
  font-style: normal;
  text-shadow: none;
  white-space: nowrap;
}
.fz-title-row { margin: 2px 0 4px; min-height: 0; text-align: center; }
.fz-title-row .fz-title { margin-left: 0; font-size: 11px; padding: 2px 10px; }

/* ---------- badges (icons, no words) ---------- */
.fz-badge {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 2px; height: 16px; margin-left: 6px; vertical-align: middle;
}
.fz-badge svg { height: 16px; width: 16px; display: block; }
.fz-badge.big {
  height: auto; margin-left: 0; gap: 6px;
  padding: 4px 14px 4px 9px; border-radius: 999px;
  background: rgba(18,18,32,.84);
  box-shadow: 0 2px 10px rgba(0,0,0,.28);
}
.fz-badge.big svg { height: 22px; width: 22px; }
.fz-badge-label {
  font-size: 13px; font-weight: 700; letter-spacing: .3px;
  color: #fff; line-height: 1; font-family: Arial, sans-serif;
}
.fz-badge.crown .fz-badge-label { color: #ffd666; }
.fz-badge.staff .fz-badge-label { color: #b9c1ff; }
.fz-badge.diamond .fz-badge-label { color: #e3f1ff; }
.fz-title-slot.big { display: inline-block; }
.fz-badge-wrap {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 4px 14px 4px 10px; border-radius: 999px;
  background: rgba(10,10,25,.62);
  box-shadow: 0 2px 10px rgba(0,0,0,.25);
}
.fz-badge-label { font-size: 13px; font-weight: 800; letter-spacing: .4px; }
.fz-badge-label.owner { color: #ffd54a; text-shadow: 0 0 8px rgba(255,195,0,.5); }
.fz-badge-label.staff { color: #a9b6ff; }
.fz-badge-label.diamond { color: #eaf3ff; }

/* owner: rotating golden crown */
.fz-badge.crown { perspective: 140px; }
.fz-badge.crown svg {
  filter: drop-shadow(0 0 4px rgba(255,195,0,.95));
  animation: fz-spin 3.2s linear infinite;
  transform-style: preserve-3d;
}
@keyframes fz-spin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }

/* staff: glowing shield with a star */
.fz-badge.staff svg {
  filter: drop-shadow(0 0 4px rgba(91,107,255,.9));
  animation: fz-pulse 2.2s ease-in-out infinite;
}
@keyframes fz-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}

/* white diamond: glow grows with points */
.fz-badge.diamond svg { filter: drop-shadow(0 0 1px rgba(110,150,230,.8)); }
.fz-badge.diamond.g1 svg { filter: drop-shadow(0 0 3px rgba(130,175,255,.95)); }
.fz-badge.diamond.g2 svg {
  filter: drop-shadow(0 0 5px rgba(120,175,255,1));
  animation: fz-twinkle 2.4s ease-in-out infinite;
}
.fz-badge.diamond.g3 svg {
  filter: drop-shadow(0 0 7px rgba(150,200,255,1));
  animation: fz-twinkle 1.6s ease-in-out infinite;
}
@keyframes fz-twinkle {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .78; transform: scale(1.14); }
}

.fz-banner {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 200px;
  z-index: -1;
  border-radius: 20px 20px 0 0;
  background: linear-gradient(135deg, #7b5cff, #ff5ca8 60%, #ffb347);
  background-size: cover;
  background-position: center;
  pointer-events: none;
  /* fades softly into the popover instead of a hard edge */
  overflow: hidden;
  -webkit-mask-image: linear-gradient(180deg, #000 84%, transparent 100%);
  mask-image: linear-gradient(180deg, #000 84%, transparent 100%);
}
.fz-banner.has-image { background: none; }
.fz-banner-bg {
  position: absolute; inset: -18px;
  background-size: cover; background-position: center;
  filter: blur(18px) brightness(.72);
}
.fz-banner-img {
  position: absolute; inset: 0;
  background-size: contain; background-repeat: no-repeat; background-position: center;
}
.fz-banner.has-image::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,.05) 0%, rgba(0,0,0,.18) 55%, rgba(0,0,0,.5) 100%);
  border-radius: inherit;
}
/* readable text on top of a banner picture */
.fz-has-banner #userPopoverName,
.fz-has-banner #userPopoverEmail,
.fz-has-banner #profileModalName,
.fz-has-banner #profileModalUsername {
  color: #fff !important;
  -webkit-text-fill-color: #fff !important;
  text-shadow: 0 2px 8px rgba(0,0,0,.8);
}
.fz-profile-root { isolation: isolate; }
.fz-avatar-over {
  margin-top: 46px !important;
  border: 3px solid #fff;
  box-shadow: 0 4px 14px rgba(0,0,0,.3);
}
.fz-profile-actions { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }

.fz-btn {
  border: none; cursor: pointer;
  padding: 10px 16px; border-radius: 12px;
  font-size: 14px; font-weight: 700;
}
.fz-btn.danger { background: #d93025; color: #fff; width: 100%; margin-top: 12px; }
.fz-btn.report { background: rgba(217,48,37,.12); color: #d93025; }
.fz-btn.ghost { background: rgba(120,120,140,.15); color: inherit; }
.fz-btn:disabled { opacity: .6; }

.fz-overlay {
  display: none; position: fixed; inset: 0; z-index: 2000000;
  background: rgba(0,0,0,.55);
  align-items: center; justify-content: center; padding: 14px;
}
.fz-overlay.show { display: flex; }
.fz-card {
  width: 100%; max-width: 360px; max-height: 88vh; overflow-y: auto;
  background: #fff; color: #222; border-radius: 20px;
  padding: 20px 18px; box-shadow: 0 15px 50px rgba(0,0,0,.4);
  font-family: Arial, sans-serif;
}
.fz-card.wide { max-width: 440px; }
.fz-card h3 { margin: 0 0 4px; font-size: 18px; }
.fz-card .fz-sub { margin: 0 0 12px; font-size: 13px; color: #666; }
.fz-card label { display: block; margin: 10px 0 4px; font-size: 12px; font-weight: 700; color: #555; }
.fz-card select, .fz-card textarea {
  width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 10px;
  font-size: 14px; font-family: inherit; box-sizing: border-box; background: #fff; color: #222;
}
.fz-card textarea { min-height: 80px; resize: vertical; }
.fz-card .fz-btn.ghost { width: 100%; margin-top: 8px; }
.fz-quote {
  margin-top: 10px; padding: 8px 10px; border-left: 3px solid #d93025;
  background: rgba(0,0,0,.05); font-size: 13px; border-radius: 6px;
}

.fz-theme-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 6px 0 8px; }
.fz-theme-tile {
  height: 86px; border-radius: 14px; border: 3px solid transparent;
  cursor: pointer; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  font-weight: 700; text-shadow: 0 1px 6px rgba(0,0,0,.35);
}
.fz-theme-tile .e { font-size: 24px; }
.fz-theme-tile .n { font-size: 11px; }
.fz-theme-tile.active { border-color: #7b5cff; box-shadow: 0 0 0 2px #fff inset; }

.fz-toast {
  position: fixed; left: 50%; bottom: 90px; transform: translate(-50%, 20px);
  background: rgba(20,20,20,.92); color: #fff; padding: 10px 16px;
  border-radius: 999px; font-size: 14px; z-index: 2100000;
  opacity: 0; transition: .25s; font-family: Arial, sans-serif;
}
.fz-toast.show { opacity: 1; transform: translate(-50%, 0); }

body.dark-mode .fz-card { background: #1e1e1e; color: #fff; }
body.dark-mode .fz-card .fz-sub, body.dark-mode .fz-card label { color: #bbb; }
body.dark-mode .fz-card select, body.dark-mode .fz-card textarea {
  background: #2a2a2a; color: #fff; border-color: #444;
}
`;

const NO_LAYOUT = document.documentElement.hasAttribute("data-fz-no-layout");

// Admin page: only badge/dialog styles (no fixed-height layout, no theme)
injectCSS("fz-shared-ui", NO_LAYOUT ? UI_CSS : UI_CSS + LAYOUT_CSS);

// ---- apply the saved theme as early as possible ----
if (!NO_LAYOUT) applyFzTheme(getSavedTheme());

// ---- keep both pages / tabs in sync ----
window.addEventListener("storage", (e) => {
  if (e.key === "fz_theme") applyFzTheme(getSavedTheme());
});

// Used by the "Profile banner" setting
export function pickMyBanner(fb) {
  const me = fb.auth.currentUser;
  if (!me) return;
  pickBanner(fb, me.uid);
}
