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
let currentCandidateCategory = "ALL";
let currentProgrammeCategory = "ALL";
let currentView = "home";
let currentIndividualCategory = "Sub-Junior";

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
  festUpdates: [],
  festGallery: []
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

function getGallery() {
  return safeArray(festCache.festGallery);
}


function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "");
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

function getCurrentDateTimeString() {
  const now = new Date();
  return now.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
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
    
    initFirebaseSync();
    switchView("home");
  }
);


function initFirebaseSync() {
  if (typeof db === "undefined") {
    console.error("Firebase Firestore (db) is not initialized!");
    return;
  }

  db.collection("festData").doc("teams").onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
      festCache.festTeams = doc.data().items;
    }
    loadAndRenderAllData();
  }, (err) => console.error("Error syncing teams:", err));

  db.collection("festData").doc("programmes").onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
      festCache.festProgrammes = doc.data().items;
    }
    loadAndRenderAllData();
  }, (err) => console.error("Error syncing programmes:", err));

  db.collection("festData").doc("candidates").onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
      festCache.festCandidates = doc.data().items;
    }
    loadAndRenderAllData();
  }, (err) => console.error("Error syncing candidates:", err));

  db.collection("festData").doc("results").onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
      festCache.festResults = doc.data().items;
    }
    loadAndRenderAllData();
  }, (err) => console.error("Error syncing results:", err));

  db.collection("festData").doc("updates").onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
      festCache.festUpdates = doc.data().items;
    }
    loadAndRenderAllData();
  }, (err) => console.error("Error syncing updates:", err));

  db.collection("festData").doc("gallery").onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
      festCache.festGallery = doc.data().items;
    }
    renderGallery(getGallery());
  }, (err) => console.error("Error syncing gallery:", err));
}


/* ============================================================
   SPLASH
============================================================ */

function initializeSplash() {
  const splash = document.getElementById("splashScreen");
  if (!splash) return;

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
  const gallery = getGallery();

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
  renderGallery(gallery);
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
    updates: null,
    programmes: "bNavProgrammes",
    candidates: "bNavCandidates",
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
   GALLERY HIGHLIGHTS
============================================================ */

function renderGallery(galleryItems) {
  const galleryGrid = document.querySelector(".gallery-grid");
  if (!galleryGrid) return;

  const safeGallery = safeArray(galleryItems);
  if (safeGallery.length === 0) return;

  galleryGrid.innerHTML = safeGallery.map((item) => `
    <div class="gallery-card" style="background-image: url('${escapeHTML(item.imageUrl)}'); background-size: cover; background-position: center;">
      <span class="material-symbols-rounded">photo_camera</span>
      <strong>${escapeHTML(item.title || "Fest Moments")}</strong>
      <small>${escapeHTML(item.subtitle || "Stage Performances")}</small>
    </div>
  `).join("");
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
      <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:8px;">
        <span class="chest-badge" style="background:var(--watermelon-soft); color:var(--watermelon);">
          ${escapeHTML(update.type || "Notice")}
        </span>
        <span style="font-size:.65rem; color:var(--text-sub); font-weight:700;">
          ${escapeHTML(update.time || getCurrentDateTimeString())}
        </span>
      </div>
      <h4 style="font-size:.95rem; font-weight:900; margin-bottom:5px;">
        ${escapeHTML(update.title || "Announcement")}
      </h4>
      <p style="font-size:.75rem; color:var(--text-sub); line-height:1.6;">
        ${escapeHTML(update.desc || "")}
      </p>
    `;

    container.appendChild(card);
  });
}


/* ============================================================
   PROGRAMMES & CATEGORY FILTER
============================================================ */

function filterProgrammeCategory(category) {
  currentProgrammeCategory = category || "ALL";

  document.querySelectorAll("#programmeCategoryFilters .cat-filter-btn").forEach(button => {
    const buttonCategory = button.dataset.category || button.textContent.trim();
    button.classList.toggle(
      "active",
      normalizeText(buttonCategory) === normalizeText(currentProgrammeCategory)
    );
  });

  renderProgrammes(getProgrammes());
}

function renderProgrammes(programmes) {
  const container = document.getElementById("programmesList");
  if (!container) return;

  container.innerHTML = "";
  let safeProgrammes = safeArray(programmes);

  if (currentProgrammeCategory !== "ALL") {
    safeProgrammes = safeProgrammes.filter(programme => {
      const category = String(programme.category || "").trim();
      return normalizeText(category) === normalizeText(currentProgrammeCategory);
    });
  }

  if (safeProgrammes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No programmes added for this category yet.
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
        <div style="font-size:.68rem; color:var(--text-sub); margin-top:5px;">
          Venue: ${escapeHTML(programme.venue || "TBA")} · ${escapeHTML(programme.time || "TBA")}
        </div>
      </div>
      <span class="chest-badge" style="background:var(--watermelon-soft); color:var(--watermelon);">
        ${escapeHTML(programme.status || "Upcoming")}
      </span>
    `;

    container.appendChild(card);
  });
}


/* ============================================================
   CANDIDATES & CATEGORY FILTER
============================================================ */

function filterCandidateCategory(category) {
  currentCandidateCategory = category || "ALL";

  document.querySelectorAll("#candidateCategoryFilters .cat-filter-btn").forEach(button => {
    const buttonCategory = button.dataset.category || button.textContent.trim();
    button.classList.toggle(
      "active",
      normalizeText(buttonCategory) === normalizeText(currentCandidateCategory)
    );
  });

  renderCandidates(getCandidates(), getResults());
}

function renderCandidates(candidates, results) {
  const container = document.getElementById("candidatesList");
  if (!container) return;

  container.innerHTML = "";
  let safeCandidates = safeArray(candidates);

  if (currentCandidateCategory !== "ALL") {
    safeCandidates = safeCandidates.filter(candidate => {
      const category = String(candidate.category || "").trim();
      return normalizeText(category) === normalizeText(currentCandidateCategory);
    });
  }

  if (safeCandidates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No candidates registered for this category yet.
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
        <span class="chest-badge" style="background:var(--watermelon-soft); color:var(--watermelon);">
          ${escapeHTML(candidate.chest || "—")}
        </span>
        <div style="min-width:0">
          <span class="team-title-text">
            ${escapeHTML(candidate.name || "Unnamed Candidate")}
          </span>
          <div style="font-size:.64rem; color:var(--text-sub); margin-top:3px;">
            Team: <b>${escapeHTML(candidate.group || "—")}</b> · ${escapeHTML(candidate.category || "—")}
          </div>
        </div>
      </div>
      <span class="material-symbols-rounded" style="color:var(--text-sub)">
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
   CANDIDATE MODAL & POINTS LOGIC
============================================================ */

function calculateCandidatePoints(candidate, results) {
  const chest = normalizeText(candidate.chest);
  let points = 0;

  safeArray(results).forEach((result) => {
    if (normalizeText(result.eventType) === "group") {
      return; 
    }

    const positions = [
      { key: "firstPlace", value: 5 },
      { key: "secondPlace", value: 3 },
      { key: "thirdPlace", value: 1 }
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
    const isGroupEvent = normalizeText(result.eventType) === "group";
    const positions = [
      { key: "firstPlace", label: "1st Place", value: 5 },
      { key: "secondPlace", label: "2nd Place", value: 3 },
      { key: "thirdPlace", label: "3rd Place", value: 1 }
    ];

    positions.forEach((position) => {
      const winner = result[position.key];
      if (!winner) return;
      if (normalizeText(winner.chest) !== candidateChest) return;
      if (!winner.name || normalizeText(winner.name) === "---") return;

      const grade = String(winner.grade || "").toUpperCase();
      const posPoints = isGroupEvent ? 0 : position.value;
      const points = posPoints + (GRADE_POINTS[grade] || 0);

      achievements.push({
        program: result.programName || "Event",
        position: position.label,
        grade: winner.grade || "None",
        points,
        isGroup: isGroupEvent
      });

      if (!isGroupEvent) {
        totalPoints += points;
      }
    });
  });

  let achievementsHTML = "";

  if (achievements.length > 0) {
    achievementsHTML = `
      <div style="margin-top:18px; border-top:1px solid rgba(255,255,255,.1); padding-top:13px;">
        <div style="color:#facc15; font-size:.65rem; font-weight:900; margin-bottom:8px;">
          ACHIEVEMENTS & POINTS
        </div>
        ${achievements.map(
          (item) => `
            <div style="display:flex; justify-content:space-between; gap:10px; padding:9px; border-radius:9px; background:rgba(255,255,255,.06); margin-bottom:5px; font-size:.7rem;">
              <span>
                ${escapeHTML(item.program)} — ${escapeHTML(item.position)}${item.isGroup ? '(Group)' : ''}
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
      <div style="margin-top:18px; padding-top:13px; border-top:1px dashed rgba(255,255,255,.12); text-align:center; color:#94a3b8; font-size:.7rem;">
        No results published yet for this candidate.
      </div>
    `;
  }

  modalBody.innerHTML = `
    <span style="display:inline-block; background:rgba(255,67,89,.18); color:#ff6c7d; padding:4px 8px; border-radius:7px; font-size:.6rem; font-weight:900;">
      IDSA FEST OFFICIAL
    </span>
    <h3 id="modalTitle" style="font-size:1.4rem; margin-top:9px; font-weight:900; padding-right:35px; word-break:break-word;">
      ${escapeHTML(candidate.name || "Unnamed Candidate")}
    </h3>
    <div style="margin-top:4px; color:#94a3b8; font-size:.7rem; font-weight:700;">
      Team: <b style="color:#facc15">${escapeHTML(candidate.group || "—")}</b> · Category: ${escapeHTML(candidate.category || "—")} · Chest: ${escapeHTML(candidate.chest || "—")}
    </div>
    ${achievementsHTML}
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:10px; border-top:1px solid rgba(255,255,255,.1);">
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

  const allScores = safeArray(candidates).map((candidate) => ({
    name: candidate.name || "Unnamed Candidate",
    group: candidate.group || "—",
    chest: candidate.chest || "—",
    category: candidate.category || "General",
    points: calculateCandidatePoints(candidate, results)
  })).filter(item => item.points > 0);

  if (allScores.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No individual points recorded yet.
      </div>
    `;
    return;
  }

  const categories = ["Sub-Junior", "Junior", "Senior"];

  if (!categories.includes(currentIndividualCategory)) {
    currentIndividualCategory = categories[0];
  }

  const filterWrapper = document.createElement("div");
  filterWrapper.className = "category-filters";
  filterWrapper.style.marginBottom = "16px";

  categories.forEach(cat => {
    const isActive = normalizeText(cat) === normalizeText(currentIndividualCategory);
    const btn = document.createElement("button");
    btn.className = `cat-filter-btn ${isActive ? "active" : ""}`;
    btn.textContent = cat;
    
    btn.addEventListener("click", () => {
      currentIndividualCategory = cat;
      renderIndividualToppers(getCandidates(), getResults());
    });

    filterWrapper.appendChild(btn);
  });

  container.appendChild(filterWrapper);

  const selectedCatScores = allScores
    .filter(item => normalizeText(item.category) === normalizeText(currentIndividualCategory))
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  const podiumSection = document.createElement("div");
  podiumSection.className = "toppers-category-section";

  if (selectedCatScores.length === 0) {
    podiumSection.innerHTML = `
      <div class="empty-state">
        No individual points recorded for ${escapeHTML(currentIndividualCategory)} category yet.
      </div>
    `;
  } else {
    const podiumGrid = document.createElement("div");
    podiumGrid.className = "podium-container";

    const orderedPodium = [];
    if (selectedCatScores[1]) orderedPodium.push({ item: selectedCatScores[1], rank: 2, badgeClass: "badge-2nd" });
    if (selectedCatScores[0]) orderedPodium.push({ item: selectedCatScores[0], rank: 1, badgeClass: "badge-1st" });
    if (selectedCatScores[2]) orderedPodium.push({ item: selectedCatScores[2], rank: 3, badgeClass: "badge-3rd" });

    orderedPodium.forEach(podium => {
      const { item, rank, badgeClass } = podium;
      const initial = item.name.charAt(0).toUpperCase();

      const card = document.createElement("div");
      card.className = `podium-card rank-${rank}`;

      card.innerHTML = `
        ${rank === 1 ? '<span class="material-symbols-rounded podium-crown">workspace_premium</span>' : ''}
        <span class="podium-badge ${badgeClass}">${rank === 1 ? '1st Place' : rank === 2 ? '2nd Place' : '3rd Place'}</span>
        <div class="podium-avatar">${initial}</div>
        <div class="podium-name">${escapeHTML(item.name)}</div>
        <div class="podium-team">${escapeHTML(item.group)} · Chest ${escapeHTML(item.chest)}</div>
        <div class="podium-points">${item.points} PTS</div>
      `;

      podiumGrid.appendChild(card);
    });

    podiumSection.appendChild(podiumGrid);
  }

  container.appendChild(podiumSection);
}


/* ============================================================
   EXCEL / CSV BACKUP EXPORT FUNCTION
============================================================ */

function exportFestDataToExcel() {
  const data = {
    teams: getTeams(),
    programmes: getProgrammes(),
    candidates: getCandidates(),
    results: getResults(),
    updates: getUpdates()
  };

  const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", jsonString);
  downloadAnchor.setAttribute("download", `sira_dars_fest_backup_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}


/* ============================================================
   RESULT CATEGORY & FILTERS
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
        <div class="winner-entry" style="margin-bottom:7px; padding:8px; background:var(--bg); border:1px solid var(--border-clean); border-radius:10px;">
          <div style="display:flex; align-items:center; gap:6px;">
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
      <div style="font-size:.63rem; color:var(--text-sub); font-weight:700; margin-bottom:9px;">
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
window.filterCandidateCategory = filterCandidateCategory;
window.filterProgrammeCategory = filterProgrammeCategory;
window.closeCandidateModal = closeCandidateModal;
window.exportFestDataToExcel = exportFestDataToExcel;
