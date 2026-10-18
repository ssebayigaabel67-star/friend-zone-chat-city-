import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  increment,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


// ==========================================
// SETTINGS (change these freely)
// ==========================================

export const POINTS_PER_MESSAGE = 3;
export const PRIZE_POINTS = 1000;          // monthly points needed to win
export const PRIZE_AMOUNT = 2;             // dollars
const SCORE_COOLDOWN_MS = 5000;            // anti-spam: 1 scoring message / 5s
const MIN_MESSAGE_LENGTH = 2;              // ignore "a", "." etc.
const TABLE_LIMIT = 50;

export const RANKS = [
  { min: 0,     name: "Newcomer", symbol: "🌱", color: "#7ccf6b" },
  { min: 150,   name: "Bronze",   symbol: "🥉", color: "#cd7f32" },
  { min: 600,   name: "Silver",   symbol: "🥈", color: "#9aa5b1" },
  { min: 1500,  name: "Gold",     symbol: "🥇", color: "#f2b600" },
  { min: 3000,  name: "Platinum", symbol: "💠", color: "#2bb5c9" },
  { min: 6000,  name: "Diamond",  symbol: "💎", color: "#3d8bff" },
  { min: 12000, name: "Master",   symbol: "👑", color: "#9b5cff" },
  { min: 25000, name: "Legend",   symbol: "🔥", color: "#ff4b3e" }
];


// ==========================================
// HELPERS
// ==========================================

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Months are counted in UTC so every user sees the same reset moment.
export function monthKey(date = new Date()) {
  return date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0");
}

function previousMonthKey(date = new Date()) {
  return monthKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)));
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, {
    month: "long", year: "numeric", timeZone: "UTC"
  });
}

function daysLeftInMonth() {
  const now = new Date();
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(0, Math.ceil((end - now.getTime()) / 86400000));
}

export function getRankInfo(points = 0) {
  let index = 0;
  RANKS.forEach((rank, i) => { if (points >= rank.min) index = i; });

  const rank = RANKS[index];
  const next = RANKS[index + 1] || null;
  const percent = next
    ? Math.min(100, Math.round(((points - rank.min) / (next.min - rank.min)) * 100))
    : 100;

  return { ...rank, index, next, percent, points };
}

export function rankBadge(points) {
  const r = getRankInfo(points);
  return `<span class="fzr-badge" style="--c:${r.color}">${r.symbol} ${esc(r.name)}</span>`;
}


// ==========================================
// STYLES (injected once, no extra CSS file)
// ==========================================

function injectStyles() {
  if (document.getElementById("fzr-styles")) return;

  const style = document.createElement("style");
  style.id = "fzr-styles";
  style.textContent = `
    .fzr-card{margin:12px 0;padding:12px;border-radius:14px;background:rgba(120,120,255,.08);
      border:1px solid rgba(120,120,255,.18);text-align:left;font-family:inherit;color:inherit}
    .fzr-top{display:flex;align-items:center;gap:10px}
    .fzr-symbol{font-size:30px;line-height:1}
    .fzr-name{font-weight:800;font-size:15px}
    .fzr-sub{font-size:12px;opacity:.75}
    .fzr-bar{height:9px;border-radius:99px;background:rgba(128,128,128,.25);overflow:hidden;margin:10px 0 4px}
    .fzr-fill{height:100%;border-radius:99px;transition:width .5s}
    .fzr-meta{display:flex;justify-content:space-between;font-size:11.5px;opacity:.8;gap:8px}
    .fzr-link{margin-top:8px;width:100%;border:none;border-radius:10px;padding:8px;cursor:pointer;
      font-weight:700;color:#fff;background:linear-gradient(90deg,#ff4b91,#8a5cff)}
    .fzr-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;
      padding:2px 8px;border-radius:99px;color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent);
      border:1px solid color-mix(in srgb,var(--c) 40%,transparent)}

    .fzr-overlay{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;
      padding:16px;background:rgba(10,10,20,.6);backdrop-filter:blur(5px)}
    .fzr-overlay.show{display:flex}
    .fzr-modal{width:100%;max-width:440px;max-height:88vh;display:flex;flex-direction:column;border-radius:20px;
      background:#fff;color:#222;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden;font-family:Arial,sans-serif}
    body.dark-mode .fzr-modal{background:#1b1d2a;color:#eee}
    .fzr-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;color:#fff;
      background:linear-gradient(90deg,#ff4b91,#ff7a00,#ffd000,#35d07f,#00bfff,#8a5cff)}
    .fzr-head h3{font-size:17px;margin:0}
    .fzr-x{border:none;background:rgba(255,255,255,.85);color:#6c2cff;width:30px;height:30px;border-radius:50%;
      font-size:16px;cursor:pointer}
    .fzr-prize{padding:10px 14px;font-size:12.5px;background:rgba(255,208,0,.16);border-bottom:1px solid rgba(128,128,128,.2)}
    .fzr-tabs{display:flex;gap:6px;padding:10px 12px 4px}
    .fzr-tab{flex:1;border:none;border-radius:10px;padding:8px 4px;font-weight:700;font-size:12.5px;cursor:pointer;
      background:rgba(128,128,128,.15);color:inherit}
    .fzr-tab.active{color:#fff;background:linear-gradient(90deg,#ff4b91,#8a5cff)}
    .fzr-list{overflow-y:auto;padding:8px 12px 14px;flex:1}
    .fzr-row{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:12px}
    .fzr-row.me{background:rgba(138,92,255,.14)}
    .fzr-pos{width:28px;text-align:center;font-weight:800}
    .fzr-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#ddd;flex-shrink:0}
    .fzr-info{flex:1;min-width:0}
    .fzr-info b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .fzr-pts{font-weight:800;font-size:13px;white-space:nowrap}
    .fzr-empty{text-align:center;padding:30px 10px;opacity:.7;font-size:13.5px}
    .fzr-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:100000;padding:10px 16px;
      border-radius:99px;color:#fff;font-weight:700;font-size:13px;background:linear-gradient(90deg,#ff4b91,#8a5cff);
      box-shadow:0 8px 24px rgba(0,0,0,.3)}
  `;
  document.head.appendChild(style);
}


// ==========================================
// AWARD POINTS (call after a text message is saved)
// ==========================================

const profileCache = new Map();
let lastScoredAt = 0;
let lastScoredText = "";

async function getProfile(db, uid) {
  if (profileCache.has(uid)) return profileCache.get(uid);

  let profile = { name: "User", username: "", photoURL: "" };

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const d = snap.data();
      profile = {
        name: d.name || d.username || "User",
        username: d.username || "",
        photoURL: d.photoURL || ""
      };
    }
  } catch (error) {
    console.warn("Ranks: could not load profile", error);
  }

  profileCache.set(uid, profile);
  return profile;
}

/**
 * Gives POINTS_PER_MESSAGE for one text message.
 * Never throws - a rank problem must never stop chat from working.
 * Returns { awarded, points?, rankedUp?, rank? }.
 */
export async function awardMessagePoints(db, uid, text) {
  try {
    if (!uid) return { awarded: false };

    const clean = String(text || "").trim();
    const now = Date.now();

    // anti-spam so points can't be farmed for the prize
    if (clean.length < MIN_MESSAGE_LENGTH) return { awarded: false };
    if (now - lastScoredAt < SCORE_COOLDOWN_MS) return { awarded: false };
    if (clean.toLowerCase() === lastScoredText) return { awarded: false };

    lastScoredAt = now;
    lastScoredText = clean.toLowerCase();

    const profile = await getProfile(db, uid);
    const userRef = doc(db, "users", uid);
    const playerRef = doc(db, "rankMonths", monthKey(), "players", uid);

    const before = (await getDoc(userRef)).data()?.rankPoints || 0;

    const batch = writeBatch(db);

    batch.set(userRef, {
      rankPoints: increment(POINTS_PER_MESSAGE),
      messageCount: increment(1)
    }, { merge: true });

    batch.set(playerRef, {
      uid,
      name: profile.name,
      username: profile.username,
      photoURL: profile.photoURL,
      points: increment(POINTS_PER_MESSAGE),
      updatedAt: serverTimestamp()
    }, { merge: true });

    await batch.commit();

    const after = before + POINTS_PER_MESSAGE;
    const oldRank = getRankInfo(before);
    const newRank = getRankInfo(after);
    const rankedUp = newRank.index > oldRank.index;

    if (rankedUp) {
      showToast(`${newRank.symbol} Rank up! You're now ${newRank.name}`);
    }

    return { awarded: true, points: after, rankedUp, rank: newRank };
  } catch (error) {
    console.warn("Ranks: could not award points", error);
    return { awarded: false };
  }
}


// ==========================================
// READ STATS
// ==========================================

export async function getRankStats(db, uid) {
  const [userSnap, playerSnap] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDoc(doc(db, "rankMonths", monthKey(), "players", uid))
  ]);

  const points = userSnap.exists() ? (userSnap.data().rankPoints || 0) : 0;
  const monthPoints = playerSnap.exists() ? (playerSnap.data().points || 0) : 0;

  return { points, monthPoints, rank: getRankInfo(points) };
}


// ==========================================
// RANK CARD (inside a user popover)
// ==========================================

function cardHtml(stats, opts) {
  const r = stats.rank;
  const monthPct = Math.min(100, Math.round((stats.monthPoints / PRIZE_POINTS) * 100));

  const nextLine = r.next
    ? `${r.next.min - stats.points} pts to ${r.next.symbol} ${esc(r.next.name)}`
    : "Max rank reached 🔥";

  return `
    <div class="fzr-card">
      <div class="fzr-top">
        <div class="fzr-symbol">${r.symbol}</div>
        <div>
          <div class="fzr-name" style="color:${r.color}">${esc(r.name)}</div>
          <div class="fzr-sub">${stats.points.toLocaleString()} points total</div>
        </div>
      </div>

      <div class="fzr-bar"><div class="fzr-fill" style="width:${r.percent}%;background:${r.color}"></div></div>
      <div class="fzr-meta"><span>${nextLine}</span><span>${r.percent}%</span></div>

      <div class="fzr-sub" style="margin-top:10px">
        🗓️ This month: <b>${stats.monthPoints.toLocaleString()}</b> / ${PRIZE_POINTS.toLocaleString()} pts for the $${PRIZE_AMOUNT} prize
      </div>
      <div class="fzr-bar"><div class="fzr-fill" style="width:${monthPct}%;background:#ffb300"></div></div>

      ${opts.tableButton
        ? `<button type="button" class="fzr-link" data-fzr-table>🏆 Rank table</button>`
        : ""}
    </div>`;
}

/**
 * Fills an element (by id or element) with the rank card of one user.
 * Safe to call repeatedly - a newer call wins over an older, slower one.
 */
export async function showRankCard(target, db, uid, opts = { tableButton: true }) {
  injectStyles();

  const el = typeof target === "string" ? document.getElementById(target) : target;
  if (!el || !uid) return;

  const token = String(Date.now()) + Math.random();
  el.dataset.fzrToken = token;
  el.innerHTML = `<div class="fzr-card"><div class="fzr-sub">Loading rank…</div></div>`;

  try {
    const stats = await getRankStats(db, uid);
    if (el.dataset.fzrToken !== token) return;   // a newer request replaced this one

    el.innerHTML = cardHtml(stats, opts);

    const btn = el.querySelector("[data-fzr-table]");
    if (btn) btn.addEventListener("click", () => openRankTable(db, opts.currentUid));
  } catch (error) {
    console.warn("Ranks: could not load rank card", error);
    if (el.dataset.fzrToken === token) el.innerHTML = "";
  }
}


// ==========================================
// RANK TABLE (modal)
// ==========================================

let tableOverlay = null;
let tableDb = null;
let tableUid = null;

function buildTable() {
  injectStyles();
  if (tableOverlay) return;

  tableOverlay = document.createElement("div");
  tableOverlay.className = "fzr-overlay";
  tableOverlay.innerHTML = `
    <div class="fzr-modal">
      <div class="fzr-head">
        <h3>🏆 Rank Table</h3>
        <button type="button" class="fzr-x" data-close>✕</button>
      </div>
      <div class="fzr-prize" id="fzrPrize"></div>
      <div class="fzr-tabs">
        <button type="button" class="fzr-tab active" data-tab="month">This month</button>
        <button type="button" class="fzr-tab" data-tab="all">All time</button>
        <button type="button" class="fzr-tab" data-tab="winners">Winners</button>
      </div>
      <div class="fzr-list" id="fzrList"></div>
    </div>`;

  document.body.appendChild(tableOverlay);

  tableOverlay.addEventListener("click", (e) => {
    if (e.target === tableOverlay || e.target.hasAttribute("data-close")) {
      tableOverlay.classList.remove("show");
    }
  });

  tableOverlay.querySelectorAll(".fzr-tab").forEach((btn) => {
    btn.addEventListener("click", () => selectTab(btn.dataset.tab));
  });
}

function rowHtml(pos, user, points, isMe, badgePoints) {
  const medal = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : pos;
  return `
    <div class="fzr-row${isMe ? " me" : ""}">
      <div class="fzr-pos">${medal}</div>
      <img class="fzr-avatar" src="${esc(user.photoURL || "images/default-profile.png")}" alt="">
      <div class="fzr-info">
        <b>${esc(user.name || user.username || "User")}</b>
        ${badgePoints === undefined ? "" : rankBadge(badgePoints)}
      </div>
      <div class="fzr-pts">${Number(points).toLocaleString()} pts</div>
    </div>`;
}

async function selectTab(tab) {
  tableOverlay.querySelectorAll(".fzr-tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab));

  const list = tableOverlay.querySelector("#fzrList");
  list.innerHTML = `<div class="fzr-empty">Loading…</div>`;

  try {
    // ---------- THIS MONTH ----------
    if (tab === "month") {
      const snap = await getDocs(query(
        collection(tableDb, "rankMonths", monthKey(), "players"),
        orderBy("points", "desc"), limit(TABLE_LIMIT)
      ));

      list.innerHTML = snap.empty
        ? `<div class="fzr-empty">No messages this month yet. Be the first! 💬</div>`
        : snap.docs.map((d, i) => {
            const u = d.data();
            return rowHtml(i + 1, u, u.points || 0, u.uid === tableUid);
          }).join("");
      return;
    }

    // ---------- ALL TIME ----------
    if (tab === "all") {
      const snap = await getDocs(query(
        collection(tableDb, "users"),
        orderBy("rankPoints", "desc"), limit(TABLE_LIMIT)
      ));

      list.innerHTML = snap.empty
        ? `<div class="fzr-empty">Nobody has points yet.</div>`
        : snap.docs.map((d, i) => {
            const u = d.data();
            return rowHtml(i + 1, u, u.rankPoints || 0, d.id === tableUid, u.rankPoints || 0);
          }).join("");
      return;
    }

    // ---------- WINNERS ----------
    const snap = await getDocs(query(
      collection(tableDb, "rankWinners"),
      orderBy("monthKey", "desc"), limit(12)
    ));

    const winners = snap.docs.map((d) => d.data()).filter((w) => !w.noWinner);

    list.innerHTML = winners.length
      ? winners.map((w) => `
          <div class="fzr-row">
            <div class="fzr-pos">🏅</div>
            <img class="fzr-avatar" src="${esc(w.photoURL || "images/default-profile.png")}" alt="">
            <div class="fzr-info">
              <b>${esc(w.name || "User")}</b>
              <span class="fzr-sub">${esc(monthLabel(w.monthKey))} · won $${esc(w.prize ?? PRIZE_AMOUNT)}</span>
            </div>
            <div class="fzr-pts">${Number(w.points || 0).toLocaleString()} pts</div>
          </div>`).join("")
      : `<div class="fzr-empty">No winners yet. The first monthly winner will appear here. 🏆</div>`;
  } catch (error) {
    console.error("Ranks: could not load table", error);
    list.innerHTML = `<div class="fzr-empty">Could not load the table. Please try again.</div>`;
  }
}

export async function openRankTable(db, currentUid) {
  tableDb = db;
  tableUid = currentUid || null;

  buildTable();
  tableOverlay.classList.add("show");

  const prize = tableOverlay.querySelector("#fzrPrize");
  prize.innerHTML =
    `💰 Reach <b>${PRIZE_POINTS.toLocaleString()} points</b> and lead the month to win <b>$${PRIZE_AMOUNT}</b>. ` +
    `${daysLeftInMonth()} day(s) left this month.`;

  selectTab("month");

  // Pick the winner of last month if nobody has done it yet
  const winner = await finalizePreviousMonth(db);
  if (winner && !winner.noWinner) {
    prize.innerHTML +=
      `<br>🏅 <b>${esc(monthLabel(winner.monthKey))} winner:</b> ${esc(winner.name)} (${Number(winner.points).toLocaleString()} pts)`;
  }
}


// ==========================================
// MONTH END: PICK THE WINNER
// ==========================================
// Runs the first time anybody opens the table in a new month.
// Firestore rules should only allow creating (never changing) a winner doc,
// see firestore-rules-ranks.txt.

export async function finalizePreviousMonth(db) {
  try {
    const key = previousMonthKey();
    const winnerRef = doc(db, "rankWinners", key);
    const existing = await getDoc(winnerRef);
    if (existing.exists()) return existing.data();

    const snap = await getDocs(query(
      collection(db, "rankMonths", key, "players"),
      orderBy("points", "desc"), limit(1)
    ));

    if (snap.empty) return null;     // nobody played last month

    const top = snap.docs[0].data();
    const data = (top.points || 0) >= PRIZE_POINTS
      ? {
          monthKey: key,
          uid: top.uid,
          name: top.name || "User",
          username: top.username || "",
          photoURL: top.photoURL || "",
          points: top.points,
          prize: PRIZE_AMOUNT,
          paid: false,
          createdAt: serverTimestamp()
        }
      : { monthKey: key, noWinner: true, createdAt: serverTimestamp() };

    await setDoc(winnerRef, data);
    return data;
  } catch (error) {
    console.warn("Ranks: could not finalize previous month", error);
    return null;
  }
}


// ==========================================
// SMALL TOAST
// ==========================================

function showToast(message) {
  injectStyles();
  const t = document.createElement("div");
  t.className = "fzr-toast";
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
