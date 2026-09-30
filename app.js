"use strict";

/* ============================================================
   SIRA DARS FEST — MAIN APPLICATION (FIREBASE VERSION)
============================================================ */

const GRADE_POINTS = Object.freeze({
  A: 5,
  B: 3,
  C: 1
});

let currentSelectedCategory = "ALL";
let currentView = "home";

// Global state variables synced with Firebase
let festCache = {
  festTeams: [
    { name: "AL BADR", points: 0 },
    { name: "AL FAROOQ", points: 0 },
    { name: "AL ANSAR", points: 0 }
  ],
  festProgrammes: [],
  festCandidates: [],
  festResults: [],
  festUpdates: []
};


/* ============================================================
   HELPERS
============================================================ */

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getTeams() {
  return safeArray(festCache.festTeams);
}

function getProgrammes() {
  return safeArray(festCache.festProgrammes);
}

function getCandidates() {
  return safeArray(festCache.festCandidates);
}

function getResults() {
  return safeArray(festCache.festResults);
}

function getUpdates() {
  return safeArray(festCache.festUpdates);
}


function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = String(value ?? "");
  }
}


/* ============================================================
   INITIALIZATION & FIREBASE REAL-TIME SYNC
============================================================ */

window.addEventListener(
  "DOMContentLoaded",
  () => {
    initializeSplash();
    initializeSearch();
    initializeModalEvents();
    
    // Start listening to real-time updates from Firestore
    initFirebaseSync();

    switchView("home");
  }
);


function initFirebaseSync() {
  if (typeof db === "undefined") {
    console.error("Firebase Firestore (db) is not initialized!");
    return;
  }

  // Real-time listener for Teams
  db.collection("festData").doc("teams").onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
      festCache.festTeams = doc.data().items;
    }
    loadAndRenderAllData();
  }, (err) => console.error("Error syncing teams:", err));

  // Real-time listener for Programmes
  db.collection("festData").doc("programmes").onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
      festCache.festProgrammes = doc.data().items;
    }
    loadAndRenderAllData();
  }, (err) => console.error("Error syncing programmes:", err));

  // Real-time listener for Candidates
  db.collection("festData").doc("candidates").onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
      festCache.festCandidates = doc.data().items;
    }
    loadAndRenderAllData();
  }, (err) => console.error("Error syncing candidates:", err));

  // Real-time listener for Results
  db.collection("festData").doc("results").onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
      festCache.festResults = doc.data().items;
    }
    loadAndRenderAllData();
  }, (err) => console.error("Error syncing results:", err));

  // Real-time listener for Updates
  db.collection("festData").doc("updates").onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
      festCache.festUpdates = doc.data().items;
    }
    loadAndRenderAllData();
  }, (err) => console.error("Error syncing updates:", err));
}


/* ============================================================
   SPLASH
============================================================ */

function initializeSplash() {
  const splash = document.getElementById("splashScreen");
  if (!splash) {
    return;
  }

  window.setTimeout(() => {
    splash.classList.add("fade-out");

    window.setTimeout(() => {
      if (splash && splash.parentNode) {
        splash.remove();
      }
    }, 700);

  }, 2400);
}


/* ============================================================
   LOAD ALL DATA
============================================================ */

function loadAndRenderAllData() {
  const teams = getTeams();
  const programmes = getProgrammes();
  const candidates = getCandidates();
  const results = getResults();
  const updates = getUpdates();

  setText("totalPrograms", programmes.length);
  setText("totalCandidates", candidates.length);
  setText("publishedResults", results.length);

  setText("homePrograms", programmes.length);
  setText("homeCandidates", candidates.length);
  setText("homeResults", results.length);

  renderLeaderboard(teams);
  updateTopTeam(teams);
  renderProgrammes(programmes);
  renderCandidates(candidates, results);
  renderResults(results);
  renderIndividualToppers(candidates, results);
  renderUpdates(updates);
}


/* ============================================================
   VIEW SWITCHING
============================================================ */

const VALID_VIEWS = [
  "home",
  "leaderboard",
  "updates",
  "programmes",
  "candidates",
  "results"
];

function switchView(viewName) {
  if (!VALID_VIEWS.includes(viewName)) {
    viewName = "home";
  }

  currentView = viewName;

  VALID_VIEWS.forEach((view) => {
    const suffix = view.charAt(0).toUpperCase() + view.slice(1);
    const panel = document.getElementById(`view${suffix}`);
    const tab = document.getElementById(`tab${suffix}`);

    if (panel) {
      panel.classList.toggle("active-panel", view === viewName);
    }
    if (tab) {
      tab.classList.toggle("active", view === viewName);
    }
  });

  const navMap = {
    home: "bNavHome",
    leaderboard: "bNavStandings",
    updates: "bNavUpdates",
    programmes: "bNavProgrammes",
    candidates: null,
    results: "bNavResults"
  };

  Object.entries(navMap).forEach(([view, id]) => {
    if (!id) return;
    const button = document.getElementById(id);
    if (!button) return;
    button.classList.toggle("active", view === viewName);
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* ============================================================
   LEADERBOARD
============================================================ */

function updateTopTeam(teams) {
  const sortedTeams = [...safeArray(teams)].sort(
    (a, b) => toNumber(b.points) - toNumber(a.points)
  );

  const topTeam = sortedTeams[0];

  if (!topTeam) {
    setText("topTeamName", "---");
    setText("topTeamPoints", "0");
    return;
  }

  const points = toNumber(topTeam.points);

  setText("topTeamName", points > 0 ? topTeam.name || "---" : "---");
  setText("topTeamPoints", points);
}


function renderLeaderboard(teams) {
  const listEl = document.getElementById("leaderboardList");
  if (!listEl) return;

  listEl.innerHTML = "";

  const sortedTeams = [...safeArray(teams)].sort(
    (a, b) => toNumber(b.points) - toNumber(a.points)
  );

  if (sortedTeams.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        No team data available yet.
      </div>
    `;
    return;
  }

  sortedTeams.forEach((team, index) => {
    const points = toNumber(team.points);
    const row = document.createElement("div");

    row.className = `team-list-item ${
      index === 0 && points > 0 ? "top-rank" : ""
    }`;

    row.innerHTML = `
      <div class="team-lead-meta">
        <span class="team-rank-no">${index + 1}</span>
        <span class="team-title-text">
          ${escapeHTML(team.name || "Unnamed Team")}
        </span>
      </div>
      <span class="team-score-num">
        ${points}
        <small> PTS</small>
      </span>
    `;

    listEl.appendChild(row);
  });
}


/* ============================================================
   UPDATES
============================================================ */

function renderUpdates(updates) {
  const container = document.getElementById("updatesList");
  if (!container) return;

  container.innerHTML = "";
  const safeUpdates = safeArray(updates);

  if (safeUpdates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No updates posted yet.
      </div>
    `;
    return;
  }

  safeUpdates.forEach((update) => {
    const card = document.createElement("div");
    card.className = "res-card-box";

    if (update.important) {
      card.style.borderColor = "var(--watermelon)";
    }

    card.innerHTML = `
      <div style="
        display:flex;
        justify-content:space-between;
        gap:10px;
        margin-bottom:8px;
      ">
        <span class="chest-badge"
          style="
            background:var(--watermelon-soft);
            color:var(--watermelon);
          "
        >
          ${escapeHTML(update.type || "Notice")}
        </span>
        <span style="
          font-size:.65rem;
          color:var(--text-sub);
          font-weight:700;
        ">
          ${escapeHTML(update.time || "")}
        </span>
      </div>
      <h4 style="
        font-size:.95rem;
        font-weight:900;
        margin-bottom:5px;
      ">
        ${escapeHTML(update.title || "Announcement")}
      </h4>
      <p style="
        font-size:.75rem;
        color:var(--text-sub);
        line-height:1.6;
      ">
        ${escapeHTML(update.desc || "")}
      </p>
    `;

    container.appendChild(card);
  });
}


/* ============================================================
   PROGRAMMES
============================================================ */

function renderProgrammes(programmes) {
  const container = document.getElementById("programmesList");
  if (!container) return;

  container.innerHTML = "";
  const safeProgrammes = safeArray(programmes);

  if (safeProgrammes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No programmes added yet.
      </div>
    `;
    return;
  }

  safeProgrammes.forEach((programme) => {
    const card = document.createElement("div");
    card.className = "team-list-item";

    card.innerHTML = `
      <div style="min-width:0">
        <strong class="team-title-text">
          ${escapeHTML(programme.title || "Untitled Programme")}
          ${programme.category ? ` (${escapeHTML(programme.category)})` : ""}
        </strong>
        <div style="
          font-size:.68rem;
          color:var(--text-sub);
          margin-top:5px;
        ">
          Venue: ${escapeHTML(programme.venue || "TBA")} · ${escapeHTML(programme.time || "TBA")}
        </div>
      </div>
      <span class="chest-badge"
        style="
          background:var(--watermelon-soft);
          color:var(--watermelon);
        "
      >
        ${escapeHTML(programme.status || "Upcoming")}
      </span>
    `;

    container.appendChild(card);
  });
}


/* ============================================================
   CANDIDATES
============================================================ */

function renderCandidates(candidates, results) {
  const container = document.getElementById("candidatesList");
  if (!container) return;

  container.innerHTML = "";
  const safeCandidates = safeArray(candidates);

  if (safeCandidates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No candidates registered yet.
      </div>
    `;
    return;
  }

  safeCandidates.forEach((candidate) => {
    const card = document.createElement("div");
    card.className = "team-list-item";
    card.style.cursor = "pointer";

    card.innerHTML = `
      <div class="team-lead-meta">
        <span class="chest-badge"
          style="
            background:var(--watermelon-soft);
            color:var(--watermelon);
          "
        >
          ${escapeHTML(candidate.chest || "—")}
        </span>
        <div style="min-width:0">
          <span class="team-title-text">
            ${escapeHTML(candidate.name || "Unnamed Candidate")}
          </span>
          <div style="
            font-size:.64rem;
            color:var(--text-sub);
            margin-top:3px;
          ">
            Team: <b>${escapeHTML(candidate.group || "—")}</b> · ${escapeHTML(candidate.category || "—")}
          </div>
        </div>
      </div>
      <span class="material-symbols-rounded"
        style="color:var(--text-sub)"
      >
        chevron_right
      </span>
    `;

    card.addEventListener("click", () => {
      openCandidatePosterModal(candidate, results);
    });

    container.appendChild(card);
  });
}


/* ============================================================
   CANDIDATE MODAL
============================================================ */

function calculateCandidatePoints(candidate, results) {
  const chest = normalizeText(candidate.chest);
  let points = 0;

  safeArray(results).forEach((result) => {
    const positions = [
      { key: "firstPlace", value: toNumber(result.p1Val) },
      { key: "secondPlace", value: toNumber(result.p2Val) },
      { key: "thirdPlace", value: toNumber(result.p3Val) }
    ];

    positions.forEach((position) => {
      const winner = result[position.key];
      if (!winner) return;

      if (normalizeText(winner.chest) !== chest) return;
      if (normalizeText(winner.name) === "---") return;

      const grade = String(winner.grade || "").toUpperCase();
      points += position.value + (GRADE_POINTS[grade] || 0);
    });
  });

  return points;
}


function openCandidatePosterModal(candidate, results) {
  const modal = document.getElementById("candidateModal");
  const modalBody = document.getElementById("modalBody");

  if (!modal || !modalBody) return;

  const candidateChest = normalizeText(candidate.chest);
  const achievements = [];
  let totalPoints = 0;

  safeArray(results).forEach((result) => {
    const positions = [
      { key: "firstPlace", label: "1st Place", value: toNumber(result.p1Val) },
      { key: "secondPlace", label: "2nd Place", value: toNumber(result.p2Val) },
      { key: "thirdPlace", label: "3rd Place", value: toNumber(result.p3Val) }
    ];

    positions.forEach((position) => {
      const winner = result[position.key];
      if (!winner) return;
      if (normalizeText(winner.chest) !== candidateChest) return;
      if (!winner.name || normalizeText(winner.name) === "---") return;

      const grade = String(winner.grade || "").toUpperCase();
      const points = position.value + (GRADE_POINTS[grade] || 0);

      achievements.push({
        program: result.programName || "Event",
        position: position.label,
        grade: winner.grade || "None",
        points
      });

      totalPoints += points;
    });
  });

  let achievementsHTML = "";

  if (achievements.length > 0) {
    achievementsHTML = `
      <div style="
        margin-top:18px;
        border-top:1px solid rgba(255,255,255,.1);
        padding-top:13px;
      ">
        <div style="
          color:#facc15;
          font-size:.65rem;
          font-weight:900;
          margin-bottom:8px;
        ">
          ACHIEVEMENTS & POINTS
        </div>
        ${achievements.map(
          (item) => `
            <div style="
              display:flex;
              justify-content:space-between;
              gap:10px;
              padding:9px;
              border-radius:9px;
              background:rgba(255,255,255,.06);
              margin-bottom:5px;
              font-size:.7rem;
            ">
              <span>
                ${escapeHTML(item.program)} —${escapeHTML(item.position)}
              </span>
              <span>
                Grade: <b style="color:#facc15">${escapeHTML(item.grade)}</b> · <b style="color:#4ade80">+${item.points}</b>
              </span>
            </div>
          `
        ).join("")}
      </div>
    `;
  } else {
    achievementsHTML = `
      <div style="
        margin-top:18px;
        padding-top:13px;
        border-top:1px dashed rgba(255,255,255,.12);
        text-align:center;
        color:#94a3b8;
        font-size:.7rem;
      ">
        No results published yet for this candidate.
      </div>
    `;
  }

  modalBody.innerHTML = `
    <span style="
      display:inline-block;
      background:rgba(255,67,89,.18);
      color:#ff6c7d;
      padding:4px 8px;
      border-radius:7px;
      font-size:.6rem;
      font-weight:900;
    ">
      IDSA FEST OFFICIAL
    </span>
    <h3 id="modalTitle" style="
      font-size:1.4rem;
      margin-top:9px;
      font-weight:900;
      padding-right:35px;
      word-break:break-word;
    ">
      ${escapeHTML(candidate.name || "Unnamed Candidate")}
    </h3>
    <div style="
      margin-top:4px;
      color:#94a3b8;
      font-size:.7rem;
      font-weight:700;
    ">
      Team: <b style="color:#facc15">${escapeHTML(candidate.group || "—")}</b> · Category: ${escapeHTML(candidate.category || "—")} · Chest: ${escapeHTML(candidate.chest || "—")}
    </div>
    ${achievementsHTML}
    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-top:16px;
      padding-top:10px;
      border-top:1px solid rgba(255,255,255,.1);
    ">
      <span style="color:#94a3b8; font-size:.65rem;">
        Sira Dars Fest Live Portal
      </span>
      <strong style="color:#facc15; font-size:.75rem;">
        Total Points: ${totalPoints}
      </strong>
    </div>
  `;

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}


function closeCandidateModal() {
  const modal = document.getElementById("candidateModal");
  if (!modal) return;

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}


/* ============================================================
   MODAL EVENTS
============================================================ */

function initializeModalEvents() {
  const modal = document.getElementById("candidateModal");
  const content = document.getElementById("modalContentBox");

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeCandidateModal();
    }
  });

  content?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCandidateModal();
    }
  });
}


/* ============================================================
   INDIVIDUAL TOPPERS
============================================================ */

function renderIndividualToppers(candidates, results) {
  const container = document.getElementById("individualToppersList");
  if (!container) return;

  container.innerHTML = "";

  const scores = safeArray(candidates)
    .map((candidate) => ({
      name: candidate.name || "Unnamed Candidate",
      group: candidate.group || "—",
      chest: candidate.chest || "—",
      points: calculateCandidatePoints(candidate, results)
    }))
    .filter(item => item.points > 0)
    .sort((a, b) => b.points - a.points);

  if (scores.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No individual points recorded yet.
      </div>
    `;
    return;
  }

  scores.slice(0, 5).forEach((top, index) => {
    const item = document.createElement("div");
    item.className = "team-list-item top-rank";

    item.innerHTML = `
      <div class="team-lead-meta">
        <span class="team-rank-no">${index + 1}</span>
        <div style="min-width:0">
          <span class="team-title-text">${escapeHTML(top.name)}</span>
          <div style="
            font-size:.62rem;
            color:var(--text-sub);
            margin-top:2px;
          ">
            ${escapeHTML(top.group)} · Chest ${escapeHTML(top.chest)}
          </div>
        </div>
      </div>
      <span class="team-score-num">
        ${top.points}
        <small>PTS</small>
      </span>
    `;

    container.appendChild(item);
  });
}


/* ============================================================
   RESULT CATEGORY
============================================================ */

function getResultCategory(result, programmes) {
  if (result?.category) {
    return String(result.category).trim();
  }

  const programName = String(result?.programName || "").trim();
  const safeProgrammes = safeArray(programmes);

  const exact = safeProgrammes.find(programme => {
    const full = `${programme.title || ""} (${programme.category || ""})`.trim();
    return normalizeText(full) === normalizeText(programName);
  });

  if (exact?.category) {
    return String(exact.category).trim();
  }

  const titleMatch = safeProgrammes.find(
    programme => normalizeText(programme.title) === normalizeText(programName)
  );

  if (titleMatch?.category) {
    return String(titleMatch.category).trim();
  }

  const bracketMatch = programName.match(/\(([^)]+)\)\s*$/);
  return bracketMatch ? bracketMatch[1].trim() : "";
}


/* ============================================================
   FILTER RESULT CATEGORY
============================================================ */

function filterResultCategory(category) {
  currentSelectedCategory = category || "ALL";

  document.querySelectorAll("#resultCategoryFilters .cat-filter-btn").forEach(button => {
    const buttonCategory = button.dataset.category || button.textContent.trim();
    button.classList.toggle(
      "active",
      normalizeText(buttonCategory) === normalizeText(currentSelectedCategory)
    );
  });

  renderResults(getResults());
}


/* ============================================================
   RESULTS
============================================================ */

function renderResults(results) {
  const container = document.getElementById("resultsList");
  if (!container) return;

  container.innerHTML = "";

  const safeResults = safeArray(results);
  const programmes = getProgrammes();
  let filtered = [...safeResults];

  if (currentSelectedCategory !== "ALL") {
    filtered = filtered.filter(result => {
      const category = getResultCategory(result, programmes);
      return normalizeText(category) === normalizeText(currentSelectedCategory);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        No results published for this category yet.
      </div>
    `;
    return;
  }

  filtered.forEach(result => {
    const card = document.createElement("div");
    card.className = "res-card-box";

    const positions = [
      { data: result.firstPlace, tag: "1st", cls: "w-pos-1" },
      { data: result.secondPlace, tag: "2nd", cls: "w-pos-2" },
      { data: result.thirdPlace, tag: "3rd", cls: "w-pos-3" }
    ];

    let winnersHTML = "";

    positions.forEach(position => {
      const winner = position.data;
      if (!winner || !winner.name || normalizeText(winner.name) === "---") {
        return;
      }

      winnersHTML += `
        <div class="winner-entry"
          style="
            margin-bottom:7px;
            padding:8px;
            background:var(--bg);
            border:1px solid var(--border-clean);
            border-radius:10px;
          "
        >
          <div style="
            display:flex;
            align-items:center;
            gap:6px;
          ">
            <span class="w-pos-tag ${position.cls}">
              ${position.tag}
            </span>
            ${winner.chest ? `<span class="chest-badge">${escapeHTML(winner.chest)}</span>` : ""}
            <div style="min-width:0">
              <strong class="w-name-val">
                ${escapeHTML(winner.name)}
              </strong>
              ${winner.team ? `<small class="w-team-sub">${escapeHTML(winner.team)}</small>` : ""}
            </div>
          </div>
          ${winner.grade ? `<span class="chest-badge" style="margin-top:5px; background:#facc15; color:#172033;">Grade: ${escapeHTML(winner.grade)}</span>` : ""}
        </div>
      `;
    });

    card.innerHTML = `
      <div class="res-prog-title">
        ${escapeHTML(result.programName || "Untitled Event")}
      </div>
      <div style="
        font-size:.63rem;
        color:var(--text-sub);
        font-weight:700;
        margin-bottom:9px;
      ">
        Event Type: ${escapeHTML(result.eventType || "Individual")}
      </div>
      ${winnersHTML || `<div style="font-size:.7rem; color:var(--text-sub);">No winners recorded.</div>`}
    `;

    container.appendChild(card);
  });
}


/* ============================================================
   SEARCH
============================================================ */

function initializeSearch() {
  const programSearch = document.getElementById("searchProgram");
  const candidateSearch = document.getElementById("searchCandidate");
  const resultSearch = document.getElementById("searchResult");

  /* PROGRAMMES */
  programSearch?.addEventListener("input", event => {
    const keyword = normalizeText(event.target.value);
    const programmes = getProgrammes();

    if (!keyword) {
      renderProgrammes(programmes);
      return;
    }

    const filtered = programmes.filter(programme => (
      normalizeText(programme.title).includes(keyword) ||
      normalizeText(programme.category).includes(keyword) ||
      normalizeText(programme.venue).includes(keyword) ||
      normalizeText(programme.status).includes(keyword)
    ));

    renderProgrammes(filtered);
  });

  /* CANDIDATES */
  candidateSearch?.addEventListener("input", event => {
    const keyword = normalizeText(event.target.value);
    const candidates = getCandidates();
    const results = getResults();

    if (!keyword) {
      renderCandidates(candidates, results);
      return;
    }

    const filtered = candidates.filter(candidate => (
      normalizeText(candidate.name).includes(keyword) ||
      normalizeText(candidate.chest).includes(keyword) ||
      normalizeText(candidate.group).includes(keyword) ||
      normalizeText(candidate.category).includes(keyword)
    ));

    renderCandidates(filtered, results);
  });

  /* RESULTS */
  resultSearch?.addEventListener("input", event => {
    const keyword = normalizeText(event.target.value);
    const results = getResults();

    if (!keyword) {
      renderResults(results);
      return;
    }

    const filtered = results.filter(result => {
      const programMatch = normalizeText(result.programName).includes(keyword);
      const typeMatch = normalizeText(result.eventType).includes(keyword);

      const winners = [result.firstPlace, result.secondPlace, result.thirdPlace];
      const winnerMatch = winners.some(winner => {
        if (!winner) return false;
        return (
          normalizeText(winner.name).includes(keyword) ||
          normalizeText(winner.chest).includes(keyword) ||
          normalizeText(winner.team).includes(keyword)
        );
      });

      return programMatch || typeMatch || winnerMatch;
    });

    renderResults(filtered);
  });
}


/* ============================================================
   PUBLIC FUNCTIONS BINDING
============================================================ */

window.switchView = switchView;
window.filterResultCategory = filterResultCategory;
window.closeCandidateModal = closeCandidateModal;