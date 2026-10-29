// ==========================================
// FRIENDSZONE MUSIC PLAYER
// Shared by Home.js (homepage) and live-room.js
//
// - Play songs from the user's own phone (files never leave the device)
// - Search online: full songs from Audius, 30-second previews from iTunes
// - Queue, shuffle, repeat, seek, volume, lock-screen controls
// - Music keeps playing after the panel is closed
// - Music pauses by itself when a call, voice note or video starts
//
// Usage:  initMusic("musicBtn");
// ==========================================


// ==========================================
// SETTINGS
// ==========================================

const APP_NAME = "FriendsZoneChat";                 // shown to Audius
const AUDIUS_BASE = "https://api.audius.co/v1";     // change if Audius moves it
const ITUNES_BASE = "https://itunes.apple.com/search";
const RESULT_LIMIT = 25;


// ==========================================
// STATE
// ==========================================

const audio = new Audio();
audio.preload = "metadata";

const state = {
  queue: [],            // { id, title, artist, src, cover, source, blob }
  index: -1,
  shuffle: false,
  repeat: "off",        // off | all | one
  tab: "search",        // search | phone | queue
  source: "audius",     // audius | itunes
  results: [],
  searching: false,
  message: "",
  lastQuery: "",
  trendingLoaded: false
};

let buttonEl = null;
let overlay = null;
let seeking = false;


// ==========================================
// HELPERS
// ==========================================

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function fmtTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ":" + String(s).padStart(2, "0");
}

function current() {
  return state.queue[state.index] || null;
}

function toast(message) {
  const t = document.createElement("div");
  t.className = "fzm-toast";
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}



// ==========================================
// ICONS (SVG, same style as the rest of the app)
// ==========================================

const ICONS = {
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  prev: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>',
  next: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
  shuffle: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
  repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  repeatOne: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/>',
  volLow: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  volHigh: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'
};

function svg(name, size = 18, filled = false) {
  return `<svg class="fzm-ic${filled ? " f" : ""}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

// ==========================================
// STYLES (injected once)
// ==========================================

function injectStyles() {
  if (document.getElementById("fzm-styles")) return;

  const style = document.createElement("style");
  style.id = "fzm-styles";
  style.textContent = `
    .fzm-overlay{position:fixed;inset:0;z-index:99998;display:none;align-items:flex-end;justify-content:center;
      background:rgba(10,10,20,.55);backdrop-filter:blur(4px)}
    .fzm-overlay.show{display:flex}
    @media(min-width:640px){.fzm-overlay{align-items:center;padding:16px}}
    .fzm-sheet{width:100%;max-width:460px;height:86vh;max-height:720px;display:flex;flex-direction:column;
      background:#fff;color:#222;border-radius:22px 22px 0 0;overflow:hidden;font-family:Arial,sans-serif;
      box-shadow:0 -10px 50px rgba(0,0,0,.35)}
    @media(min-width:640px){.fzm-sheet{border-radius:22px}}
    body.dark-mode .fzm-sheet{background:#1b1d2a;color:#eee}
    .fzm-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;color:#fff;
      background:linear-gradient(90deg,#ff4b91,#ff7a00,#ffd000,#35d07f,#00bfff,#8a5cff)}
    .fzm-head h3{margin:0;font-size:17px}
    .fzm-x{border:none;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.88);color:#6c2cff;
      font-size:16px;cursor:pointer}

    .fzm-now{padding:12px 14px;border-bottom:1px solid rgba(128,128,128,.2)}
    .fzm-nowrow{display:flex;align-items:center;gap:12px}
    .fzm-art{width:54px;height:54px;border-radius:12px;object-fit:cover;background:linear-gradient(135deg,#ff4b91,#8a5cff);
      flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff}
    .fzm-meta{min-width:0;flex:1}
    .fzm-title{font-weight:800;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .fzm-artist{font-size:12px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .fzm-seek{display:flex;align-items:center;gap:8px;margin:10px 0 4px;font-size:11px;opacity:.85}
    .fzm-seek input{flex:1}
    .fzm-controls{display:flex;align-items:center;justify-content:center;gap:10px}
    .fzm-ctl{border:none;background:rgba(128,128,128,.16);color:inherit;width:40px;height:40px;border-radius:50%;
      font-size:16px;cursor:pointer}
    .fzm-ctl.on{background:linear-gradient(90deg,#ff4b91,#8a5cff);color:#fff}
    .fzm-ctl.big{width:52px;height:52px;font-size:20px;color:#fff;background:linear-gradient(90deg,#ff4b91,#8a5cff)}
    .fzm-vol{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:14px}
    .fzm-vol input{flex:1}

    .fzm-tabs{display:flex;gap:6px;padding:10px 12px 4px}
    .fzm-tab{flex:1;border:none;border-radius:10px;padding:8px 4px;font-weight:700;font-size:12.5px;cursor:pointer;
      background:rgba(128,128,128,.15);color:inherit}
    .fzm-tab.active{color:#fff;background:linear-gradient(90deg,#ff4b91,#8a5cff)}
    .fzm-body{flex:1;overflow-y:auto;padding:8px 12px 14px}

    .fzm-form{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
    .fzm-form input[type=search]{flex:1;min-width:140px;padding:10px 12px;border-radius:12px;font-size:14px;
      border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit}
    .fzm-form select{padding:10px;border-radius:12px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit}
    .fzm-go{border:none;border-radius:12px;padding:10px 16px;font-weight:800;color:#fff;cursor:pointer;
      background:linear-gradient(90deg,#ff4b91,#8a5cff)}

    .fzm-row{display:flex;align-items:center;gap:10px;padding:7px 4px;border-radius:12px}
    .fzm-row.playing{background:rgba(138,92,255,.15)}
    .fzm-row img,.fzm-row .fzm-thumb{width:42px;height:42px;border-radius:10px;object-fit:cover;flex-shrink:0;
      background:linear-gradient(135deg,#ff4b91,#8a5cff);display:flex;align-items:center;justify-content:center;color:#fff}
    .fzm-row .fzm-meta{cursor:pointer}
    .fzm-mini{border:none;background:rgba(128,128,128,.16);color:inherit;border-radius:10px;padding:7px 10px;
      font-weight:800;cursor:pointer;flex-shrink:0}
    .fzm-empty{text-align:center;padding:26px 10px;opacity:.7;font-size:13.5px;line-height:1.5}
    .fzm-pick{display:block;text-align:center;padding:16px;border-radius:16px;font-weight:800;color:#fff;cursor:pointer;
      background:linear-gradient(90deg,#ff4b91,#8a5cff);margin:6px 0 10px}
    .fzm-note{font-size:11.5px;opacity:.65;text-align:center;margin-top:10px;line-height:1.5}
    .fzm-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:100001;padding:10px 16px;
      border-radius:99px;color:#fff;font-weight:700;font-size:13px;background:#333;box-shadow:0 8px 24px rgba(0,0,0,.3)}

    .fzm-ic{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-3px;flex-shrink:0}
    .fzm-ic.f{fill:currentColor}
    .fzm-head h3,.fzm-tab,.fzm-pick{display:flex;align-items:center;justify-content:center;gap:6px}
    .fzm-head h3{justify-content:flex-start}
    .fzm-ctl,.fzm-mini,.fzm-x{display:inline-flex;align-items:center;justify-content:center;padding:0}
    .fzm-mini{padding:7px 10px}
    .fzm-vol{display:flex;align-items:center;gap:8px}
    @keyframes fzmPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
    .fzm-playing{animation:fzmPulse 1.2s infinite}
  `;
  document.head.appendChild(style);
}


// ==========================================
// BUILD THE PANEL (once)
// ==========================================

function buildPanel() {
  if (overlay) return;
  injectStyles();

  overlay = document.createElement("div");
  overlay.className = "fzm-overlay";
  overlay.innerHTML = `
    <div class="fzm-sheet">
      <div class="fzm-head">
        <h3>${svg("music", 18)} Music</h3>
        <button type="button" class="fzm-x" data-act="close">${svg("x", 16)}</button>
      </div>

      <div class="fzm-now">
        <div class="fzm-nowrow">
          <div class="fzm-art" id="fzmArt">${svg("music", 26)}</div>
          <div class="fzm-meta">
            <div class="fzm-title" id="fzmTitle">Nothing playing</div>
            <div class="fzm-artist" id="fzmArtist">Pick a song below</div>
          </div>
        </div>

        <div class="fzm-seek">
          <span id="fzmCur">0:00</span>
          <input type="range" id="fzmSeek" min="0" max="1000" value="0">
          <span id="fzmDur">0:00</span>
        </div>

        <div class="fzm-controls">
          <button type="button" class="fzm-ctl" id="fzmShuffle" data-act="shuffle" title="Shuffle">${svg("shuffle")}</button>
          <button type="button" class="fzm-ctl" data-act="prev" title="Previous">${svg("prev", 18, true)}</button>
          <button type="button" class="fzm-ctl big" id="fzmPlay" data-act="toggle" title="Play / pause">${svg("play", 22, true)}</button>
          <button type="button" class="fzm-ctl" data-act="next" title="Next">${svg("next", 18, true)}</button>
          <button type="button" class="fzm-ctl" id="fzmRepeat" data-act="repeat" title="Repeat">${svg("repeat")}</button>
        </div>

        <div class="fzm-vol">${svg("volLow", 16)} <input type="range" id="fzmVol" min="0" max="100" value="80"> ${svg("volHigh", 16)}</div>
      </div>

      <div class="fzm-tabs">
        <button type="button" class="fzm-tab active" data-tab="search">${svg("search", 15)} Search</button>
        <button type="button" class="fzm-tab" data-tab="phone">${svg("phone", 15)} My phone</button>
        <button type="button" class="fzm-tab" data-tab="queue" id="fzmQueueTab">Queue</button>
      </div>

      <div class="fzm-body" id="fzmBody"></div>

      <input type="file" id="fzmFiles" accept="audio/*" multiple hidden>
    </div>`;

  document.body.appendChild(overlay);

  // ---- clicks (event delegation) ----
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) return closePanel();

    const tabBtn = e.target.closest("[data-tab]");
    if (tabBtn) return setTab(tabBtn.dataset.tab);

    const el = e.target.closest("[data-act]");
    if (!el) return;

    const act = el.dataset.act;
    const i = Number(el.dataset.i);

    if (act === "close") closePanel();
    else if (act === "toggle") togglePlay();
    else if (act === "next") nextTrack(false);
    else if (act === "prev") prevTrack();
    else if (act === "shuffle") { state.shuffle = !state.shuffle; updatePlayer(); }
    else if (act === "repeat") {
      state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
      updatePlayer();
    }
    else if (act === "play-result") playTracks([state.results[i]]);
    else if (act === "add-result") { addToQueue([state.results[i]]); toast("Added to queue"); }
    else if (act === "play-queue") playIndex(i);
    else if (act === "remove") removeAt(i);
    else if (act === "clear") clearQueue();
    else if (act === "pick") document.getElementById("fzmFiles").click();
  });

  // ---- search form ----
  overlay.addEventListener("submit", (e) => {
    if (!e.target.matches("[data-form=search]")) return;
    e.preventDefault();
    const input = e.target.querySelector("input[type=search]");
    runSearch(input.value.trim());
  });

  overlay.addEventListener("change", (e) => {
    if (e.target.matches("[data-source]")) {
      state.source = e.target.value;
      state.results = [];
      state.message = "";
      state.trendingLoaded = false;
      renderBody();
      if (state.source === "audius") loadTrending();
    }
  });

  // ---- seek + volume ----
  const seek = overlay.querySelector("#fzmSeek");
  seek.addEventListener("pointerdown", () => { seeking = true; });
  seek.addEventListener("pointerup", () => { seeking = false; });
  seek.addEventListener("input", () => {
    if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration;
  });

  const vol = overlay.querySelector("#fzmVol");
  audio.volume = vol.value / 100;
  vol.addEventListener("input", () => { audio.volume = vol.value / 100; });

  // ---- files from the phone ----
  overlay.querySelector("#fzmFiles").addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("audio/") || /\.(mp3|m4a|aac|wav|ogg|flac|opus|weba)$/i.test(f.name));
    e.target.value = "";
    if (!files.length) return toast("No audio files selected");

    const tracks = files.map((file) => ({
      id: "local-" + file.name + "-" + file.size,
      title: file.name.replace(/\.[^.]+$/, ""),
      artist: "My phone",
      src: URL.createObjectURL(file),
      cover: "",
      source: "local",
      blob: true
    }));

    playTracks(tracks);
    setTab("queue");
  });
}


// ==========================================
// PANEL OPEN / CLOSE / TABS
// ==========================================

function openPanel() {
  buildPanel();
  overlay.classList.add("show");
  updatePlayer();
  renderBody();
  if (state.tab === "search" && state.source === "audius") loadTrending();
}

function closePanel() {
  if (overlay) overlay.classList.remove("show");
}

function setTab(tab) {
  state.tab = tab;
  overlay.querySelectorAll(".fzm-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  renderBody();
  if (tab === "search" && state.source === "audius") loadTrending();
}


// ==========================================
// RENDER BODY
// ==========================================

function trackRow(t, i, kind) {
  const art = t.cover
    ? `<img src="${esc(t.cover)}" alt="" loading="lazy">`
    : `<div class="fzm-thumb">${svg("music", 20)}</div>`;

  if (kind === "result") {
    return `
      <div class="fzm-row">
        ${art}
        <div class="fzm-meta" data-act="play-result" data-i="${i}">
          <div class="fzm-title">${esc(t.title)}</div>
          <div class="fzm-artist">${esc(t.artist)}</div>
        </div>
        <button type="button" class="fzm-mini" data-act="add-result" data-i="${i}" title="Add to queue">${svg("plus", 16)}</button>
        <button type="button" class="fzm-mini" data-act="play-result" data-i="${i}" title="Play">${svg("play", 14, true)}</button>
      </div>`;
  }

  return `
    <div class="fzm-row${i === state.index ? " playing" : ""}">
      ${art}
      <div class="fzm-meta" data-act="play-queue" data-i="${i}">
        <div class="fzm-title">${i === state.index ? svg("music", 13) + " " : ""}${esc(t.title)}</div>
        <div class="fzm-artist">${esc(t.artist)}</div>
      </div>
      <button type="button" class="fzm-mini" data-act="remove" data-i="${i}" title="Remove">${svg("x", 14)}</button>
    </div>`;
}

function renderBody() {
  if (!overlay) return;
  const body = overlay.querySelector("#fzmBody");
  overlay.querySelector("#fzmQueueTab").textContent = `Queue${state.queue.length ? " (" + state.queue.length + ")" : ""}`;

  // ---------- SEARCH ----------
  if (state.tab === "search") {
    const list = state.searching
      ? `<div class="fzm-empty">Searching…</div>`
      : state.results.length
        ? state.results.map((t, i) => trackRow(t, i, "result")).join("")
        : `<div class="fzm-empty">${esc(state.message) || "Type a song or artist and press Search."}</div>`;

    body.innerHTML = `
      <form class="fzm-form" data-form="search">
        <input type="search" placeholder="Search songs or artists" value="${esc(state.lastQuery)}">
        <select data-source>
          <option value="audius"${state.source === "audius" ? " selected" : ""}>Full songs (Audius)</option>
          <option value="itunes"${state.source === "itunes" ? " selected" : ""}>30s previews (iTunes)</option>
        </select>
        <button type="submit" class="fzm-go">Search</button>
      </form>
      ${list}
      <div class="fzm-note">Music from Audius and Apple iTunes previews. Credit goes to the artists.</div>`;
    return;
  }

  // ---------- PHONE ----------
  if (state.tab === "phone") {
    body.innerHTML = `
      <div class="fzm-pick" data-act="pick">${svg("phone", 18)} Choose music from your phone</div>
      <div class="fzm-note">
        Pick one or many songs. They play right on your device and are never uploaded.<br>
        Local songs are cleared when you close or refresh the page.
      </div>`;
    return;
  }

  // ---------- QUEUE ----------
  body.innerHTML = state.queue.length
    ? state.queue.map((t, i) => trackRow(t, i, "queue")).join("") +
      `<button type="button" class="fzm-mini" style="width:100%;margin-top:10px" data-act="clear">Clear queue</button>`
    : `<div class="fzm-empty">Your queue is empty.<br>Search for a song or add music from your phone.</div>`;
}


// ==========================================
// UPDATE THE PLAYER AREA
// ==========================================

function updatePlayer() {
  const t = current();
  const playing = !audio.paused && !audio.ended;

  if (buttonEl) buttonEl.classList.toggle("fzm-playing", playing);

  if ("mediaSession" in navigator && t) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist,
      artwork: t.cover ? [{ src: t.cover }] : []
    });
  }

  if (!overlay) return;

  const art = overlay.querySelector("#fzmArt");
  if (t && t.cover) art.innerHTML = `<img src="${esc(t.cover)}" alt="" style="width:100%;height:100%;border-radius:12px;object-fit:cover">`;
  else art.innerHTML = svg("music", 26);

  overlay.querySelector("#fzmTitle").textContent = t ? t.title : "Nothing playing";
  overlay.querySelector("#fzmArtist").textContent = t ? t.artist : "Pick a song below";
  overlay.querySelector("#fzmPlay").innerHTML = playing ? svg("pause", 22, true) : svg("play", 22, true);
  overlay.querySelector("#fzmShuffle").classList.toggle("on", state.shuffle);

  const rep = overlay.querySelector("#fzmRepeat");
  rep.classList.toggle("on", state.repeat !== "off");
  rep.innerHTML = state.repeat === "one" ? svg("repeatOne") : svg("repeat");

  // Only the queue needs a redraw (highlights the playing song).
  // Redrawing the search tab would wipe what the user is typing.
  if (state.tab === "queue") renderBody();
}

function updateProgress() {
  if (!overlay || seeking) return;
  overlay.querySelector("#fzmCur").textContent = fmtTime(audio.currentTime);
  overlay.querySelector("#fzmDur").textContent = fmtTime(audio.duration);
  overlay.querySelector("#fzmSeek").value = audio.duration ? (audio.currentTime / audio.duration) * 1000 : 0;
}


// ==========================================
// PLAYBACK
// ==========================================

function addToQueue(tracks) {
  tracks.filter(Boolean).forEach((t) => state.queue.push(t));
  renderBody();
}

function playTracks(tracks) {
  tracks = tracks.filter(Boolean);
  if (!tracks.length) return;

  const firstNew = state.queue.length;
  tracks.forEach((t) => state.queue.push(t));
  playIndex(firstNew);
}

function playIndex(i) {
  const t = state.queue[i];
  if (!t) return;

  state.index = i;
  audio.src = t.src;

  audio.play().catch((error) => {
    console.warn("Music: play blocked or failed", error);
    toast("Could not play this song");
  });

  updatePlayer();
}

function togglePlay() {
  if (!current()) {
    if (state.queue.length) return playIndex(0);
    return toast("Pick a song first");
  }
  if (audio.paused) audio.play().catch(() => toast("Could not play this song"));
  else audio.pause();
}

function nextTrack(auto) {
  if (!state.queue.length) return;

  if (auto && state.repeat === "one") {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }

  let next;
  if (state.shuffle && state.queue.length > 1) {
    do { next = Math.floor(Math.random() * state.queue.length); } while (next === state.index);
  } else {
    next = state.index + 1;
    if (next >= state.queue.length) {
      if (state.repeat === "all" || !auto) next = 0;
      else { audio.pause(); updatePlayer(); return; }   // end of queue
    }
  }
  playIndex(next);
}

function prevTrack() {
  if (!state.queue.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  playIndex(state.index > 0 ? state.index - 1 : state.queue.length - 1);
}

function releaseTrack(t) {
  if (t && t.blob) URL.revokeObjectURL(t.src);
}

function removeAt(i) {
  const t = state.queue[i];
  if (!t) return;

  if (i === state.index) {
    audio.pause();
    audio.removeAttribute("src");
    state.index = -1;
  } else if (i < state.index) {
    state.index--;
  }

  releaseTrack(t);
  state.queue.splice(i, 1);
  updatePlayer();
}

function clearQueue() {
  audio.pause();
  audio.removeAttribute("src");
  state.queue.forEach(releaseTrack);
  state.queue = [];
  state.index = -1;
  updatePlayer();
}


// ==========================================
// ONLINE SEARCH
// ==========================================

function fromAudius(item) {
  return {
    id: "audius-" + item.id,
    title: item.title || "Untitled",
    artist: (item.user && item.user.name) || "Unknown artist",
    src: `${AUDIUS_BASE}/tracks/${encodeURIComponent(item.id)}/stream?app_name=${APP_NAME}`,
    cover: (item.artwork && (item.artwork["150x150"] || item.artwork["480x480"])) || "",
    source: "audius"
  };
}

function fromItunes(item) {
  return {
    id: "itunes-" + item.trackId,
    title: item.trackName || "Untitled",
    artist: item.artistName || "Unknown artist",
    src: item.previewUrl,
    cover: (item.artworkUrl100 || "").replace("100x100", "300x300"),
    source: "itunes"
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}

async function runSearch(term) {
  if (!term) return;

  state.lastQuery = term;
  state.searching = true;
  state.message = "";
  renderBody();

  try {
    if (state.source === "audius") {
      const data = await fetchJson(
        `${AUDIUS_BASE}/tracks/search?query=${encodeURIComponent(term)}&limit=${RESULT_LIMIT}&app_name=${APP_NAME}`
      );
      state.results = (data.data || []).filter((t) => t.is_streamable !== false).map(fromAudius);
    } else {
      const data = await fetchJson(
        `${ITUNES_BASE}?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${RESULT_LIMIT}`
      );
      state.results = (data.results || []).filter((t) => t.previewUrl).map(fromItunes);
    }

    if (!state.results.length) state.message = "No songs found. Try another name.";
  } catch (error) {
    console.error("Music: search failed", error);
    state.results = [];
    state.message = "Search failed. Check your internet, or try the other source.";
  }

  state.searching = false;
  renderBody();
}

async function loadTrending() {
  if (state.trendingLoaded || state.results.length || state.searching) return;
  state.trendingLoaded = true;

  try {
    const data = await fetchJson(`${AUDIUS_BASE}/tracks/trending?limit=${RESULT_LIMIT}&app_name=${APP_NAME}`);
    state.results = (data.data || []).filter((t) => t.is_streamable !== false).map(fromAudius);
    state.message = "";
  } catch (error) {
    console.warn("Music: trending failed", error);
    state.message = "Type a song or artist and press Search.";
  }

  renderBody();
}


// ==========================================
// AUDIO EVENTS
// ==========================================

audio.addEventListener("play", updatePlayer);
audio.addEventListener("pause", updatePlayer);
audio.addEventListener("timeupdate", updateProgress);
audio.addEventListener("loadedmetadata", updateProgress);
audio.addEventListener("ended", () => nextTrack(true));

audio.addEventListener("error", () => {
  if (!current()) return;
  toast("This song can't be played. Skipping…");
  if (state.queue.length > 1) setTimeout(() => nextTrack(true), 800);
});

// Pause music when a call, voice note or video starts playing elsewhere on the page
document.addEventListener("play", (event) => {
  if (event.target !== audio && !audio.paused) audio.pause();
}, true);

// Lock-screen / headset controls
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", () => audio.play());
  navigator.mediaSession.setActionHandler("pause", () => audio.pause());
  navigator.mediaSession.setActionHandler("nexttrack", () => nextTrack(false));
  navigator.mediaSession.setActionHandler("previoustrack", prevTrack);
}


// ==========================================
// PUBLIC API
// ==========================================

/** Connects the music panel to a button (by id). */
export function initMusic(buttonId) {
  buttonEl = document.getElementById(buttonId);

  if (!buttonEl) {
    console.warn("Music: button not found:", buttonId);
    return;
  }

  buttonEl.addEventListener("click", (event) => {
    event.stopPropagation();
    openPanel();
  });
}

export function pauseMusic() {
  audio.pause();
}
