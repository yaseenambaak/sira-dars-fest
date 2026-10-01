"use strict";

/* ============================================================
   SIRA DARS FEST — ADMIN CONTROL SYSTEM (FIREBASE VERSION)
============================================================ */

const STORAGE = Object.freeze({
  AUTH: "adminAuthenticated"
});

const DEFAULT_TEAMS = [
  { name: "AL BADR", points: 0 },
  { name: "AL FAROOQ", points: 0 },
  { name: "AL ANSAR", points: 0 }
];

const GRADE_POINTS = Object.freeze({
  A: 5,
  B: 3,
  C: 1
});

let adminCache = {
  festTeams: [...DEFAULT_TEAMS],
  festCandidates: [],
  festProgrammes: [],
  festResults: [],
  festUpdates: [],
  festGallery: []
};


/* =========================================================
   AUTHENTICATION
========================================================= */

if (sessionStorage.getItem(STORAGE.AUTH) !== "true") {
  window.location.replace("admin-login.html");
}


/* =========================================================
   DOM HELPERS
========================================================= */

function $(id) {
  return document.getElementById(id);
}


/* =========================================================
   FIREBASE DATA SYNC & FETCH HELPERS
========================================================= */

function initAdminFirebaseSync(callback) {
  if (typeof db === "undefined") {
    console.error("Firebase Firestore (db) is not initialized!");
    return;
  }

  let loadedCount = 0;
  const totalCollections = 6;

  function checkReady() {
    loadedCount++;
    if (loadedCount >= totalCollections && typeof callback === "function") {
      callback();
    }
  }

  db.collection("festData").doc("teams").onSnapshot((doc) => {
    if (doc.exists && doc.data().items) {
      adminCache.festTeams = doc.data().items;
    } else {
      saveToFirestore("teams", DEFAULT_TEAMS);
    }
    checkReady();
  });

  db.collection("festData").doc("programmes").onSnapshot((doc) => {
    adminCache.festProgrammes = (doc.exists && doc.data().items) ? doc.data().items : [];
    checkReady();
  });

  db.collection("festData").doc("candidates").onSnapshot((doc) => {
    adminCache.festCandidates = (doc.exists && doc.data().items) ? doc.data().items : [];
    checkReady();
  });

  db.collection("festData").doc("results").onSnapshot((doc) => {
    adminCache.festResults = (doc.exists && doc.data().items) ? doc.data().items : [];
    checkReady();
  });

  db.collection("festData").doc("updates").onSnapshot((doc) => {
    adminCache.festUpdates = (doc.exists && doc.data().items) ? doc.data().items : [];
    checkReady();
  });

  db.collection("festData").doc("gallery").onSnapshot((doc) => {
    adminCache.festGallery = (doc.exists && doc.data().items) ? doc.data().items : [];
    checkReady();
  });
}


function saveToFirestore(docName, itemsArray) {
  if (typeof db === "undefined") return;
  db.collection("festData").doc(docName).set({ items: itemsArray })
    .catch((error) => console.error(`Error saving ${docName} to Firebase:`, error));
}


function getJSON(key, fallback) {
  switch(key) {
    case "festTeams": return adminCache.festTeams;
    case "festCandidates": return adminCache.festCandidates;
    case "festProgrammes": return adminCache.festProgrammes;
    case "festResults": return adminCache.festResults;
    case "festUpdates": return adminCache.festUpdates;
    case "festGallery": return adminCache.festGallery;
    default: return fallback;
  }
}

function setJSON(key, value) {
  switch(key) {
    case "festTeams":
      adminCache.festTeams = value;
      saveToFirestore("teams", value);
      break;
    case "festCandidates":
      adminCache.festCandidates = value;
      saveToFirestore("candidates", value);
      break;
    case "festProgrammes":
      adminCache.festProgrammes = value;
      saveToFirestore("programmes", value);
      break;
    case "festResults":
      adminCache.festResults = value;
      saveToFirestore("results", value);
      break;
    case "festUpdates":
      adminCache.festUpdates = value;
      saveToFirestore("updates", value);
      break;
    case "festGallery":
      adminCache.festGallery = value;
      saveToFirestore("gallery", value);
      break;
  }
}


/* =========================================================
   SAFE HTML & TOAST
========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, type = "success") {
  const toast = $("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

function getCurrentDateTimeString() {
  const now = new Date();
  return now.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function ensureDefaultTeams() {
  let teams = getJSON("festTeams", null);
  if (!Array.isArray(teams) || teams.length !== 3) {
    teams = structuredClone(DEFAULT_TEAMS);
    setJSON("festTeams", teams);
  }

  teams = teams.map(team => ({
    name: String(team.name || "").trim().toUpperCase(),
    points: Number.isFinite(Number(team.points)) ? Number(team.points) : 0
  }));

  setJSON("festTeams", teams);
  return teams;
}


/* =========================================================
   TEAMS MANAGEMENT
========================================================= */

function loadTeamDataToUI() {
  const teams = ensureDefaultTeams();

  if ($("teamName1")) $("teamName1").value = teams[0]?.name || "";
  if ($("teamName2")) $("teamName2").value = teams[1]?.name || "";
  if ($("teamName3")) $("teamName3").value = teams[2]?.name || "";

  populateTeamSelect("candGroup");
  populateTeamSelect("res1Team");
  populateTeamSelect("res2Team");
  populateTeamSelect("res3Team");
}

function populateTeamSelect(id, selectedValue = "") {
  const select = $(id);
  if (!select) return;

  const teams = ensureDefaultTeams();
  select.replaceChildren();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select Team";
  select.appendChild(defaultOption);

  teams.forEach(team => {
    const option = document.createElement("option");
    option.value = team.name;
    option.textContent = team.name;
    if (team.name === selectedValue) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function saveAllTeams() {
  const names = [
    $("teamName1").value.trim().toUpperCase(),
    $("teamName2").value.trim().toUpperCase(),
    $("teamName3").value.trim().toUpperCase()
  ];

  if (names.some(name => !name)) {
    showToast("All three team names are required.", "error");
    return;
  }

  const uniqueNames = new Set(names);
  if (uniqueNames.size !== 3) {
    showToast("Team names must be unique.", "error");
    return;
  }

  const oldTeams = ensureDefaultTeams();
  const oldToNew = new Map();
  oldTeams.forEach((team, index) => {
    oldToNew.set(team.name, names[index]);
  });

  const teams = oldTeams.map((team, index) => ({
    name: names[index],
    points: Number(team.points) || 0
  }));

  setJSON("festTeams", teams);

  const candidates = getJSON("festCandidates", []);
  candidates.forEach(candidate => {
    if (oldToNew.has(candidate.group)) {
      candidate.group = oldToNew.get(candidate.group);
    }
  });
  setJSON("festCandidates", candidates);

  const results = getJSON("festResults", []);
  results.forEach(result => {
    [result.firstPlace, result.secondPlace, result.thirdPlace].forEach(place => {
      if (place && oldToNew.has(place.team)) {
        place.team = oldToNew.get(place.team);
      }
    });
  });
  setJSON("festResults", results);

  loadTeamDataToUI();
  loadAdminCandidatesList();
  loadAdminResultsList();

  showToast("Team names updated successfully.");
}


/* =========================================================
   UPDATES
========================================================= */

function loadAdminUpdatesList() {
  const container = $("adminUpdatesList");
  if (!container) return;

  container.replaceChildren();
  const updates = getJSON("festUpdates", []);

  if (!Array.isArray(updates) || updates.length === 0) {
    container.appendChild(emptyMessage("No updates posted yet."));
    return;
  }

  updates.forEach((update, index) => {
    const item = document.createElement("div");
    item.className = "admin-list-item";

    item.innerHTML = `
      <div class="list-content">
        <strong>${escapeHTML(update.title)}</strong>
        <p>
          ${escapeHTML(update.time)} • ${escapeHTML(update.type)}
          ${update.important ? " • IMPORTANT" : ""}
        </p>
      </div>
      <button type="button" class="small-danger-button" data-action="delete-update" data-index="${index}">
        Delete
      </button>
    `;
    container.appendChild(item);
  });
}

function deleteUpdate(index) {
  const updates = getJSON("festUpdates", []);
  if (!updates[index]) return;

  if (!confirm("Delete this update?")) return;

  updates.splice(index, 1);
  setJSON("festUpdates", updates);
  loadAdminUpdatesList();
  showToast("Update deleted.");
}


/* =========================================================
   CANDIDATES
========================================================= */

function loadAdminCandidatesList() {
  const container = $("adminCandidatesList");
  if (!container) return;

  container.replaceChildren();
  const candidates = getJSON("festCandidates", []);

  if (!Array.isArray(candidates) || candidates.length === 0) {
    container.appendChild(emptyMessage("No candidates registered yet."));
    return;
  }

  candidates.forEach((candidate, index) => {
    const item = document.createElement("div");
    item.className = "admin-list-item";

    item.innerHTML = `
      <div class="list-content">
        <strong>${escapeHTML(candidate.chest)} — ${escapeHTML(candidate.name)}</strong>
        <p>${escapeHTML(candidate.group)} • ${escapeHTML(candidate.category)}</p>
      </div>
      <div class="list-actions">
        <button type="button" class="small-edit-button" data-action="edit-candidate" data-index="${index}">Edit</button>
        <button type="button" class="small-danger-button" data-action="delete-candidate" data-index="${index}">Delete</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function deleteCandidate(index) {
  const candidates = getJSON("festCandidates", []);
  const candidate = candidates[index];
  if (!candidate) return;

  if (!confirm(`Delete candidate "${candidate.name}" (${candidate.chest})?`)) return;

  candidates.splice(index, 1);
  setJSON("festCandidates", candidates);
  loadAdminCandidatesList();
  refreshCandidateDatalists();
  showToast("Candidate deleted.");
}

function editCandidate(index) {
  const candidates = getJSON("festCandidates", []);
  const candidate = candidates[index];
  if (!candidate) return;

  const newName = prompt("Edit candidate name:", candidate.name);
  if (newName === null) return;

  const cleanName = newName.trim();
  if (!cleanName) {
    showToast("Candidate name cannot be empty.", "error");
    return;
  }

  candidate.name = cleanName;
  setJSON("festCandidates", candidates);
  loadAdminCandidatesList();
  refreshCandidateDatalists();
  showToast("Candidate updated.");
}


/* =========================================================
   PROGRAMMES
========================================================= */

function loadAdminProgrammesList() {
  const container = $("adminProgrammesList");
  if (!container) return;

  container.replaceChildren();
  const programmes = getJSON("festProgrammes", []);

  if (!Array.isArray(programmes) || programmes.length === 0) {
    container.appendChild(emptyMessage("No programmes added yet."));
    populateResultDropdowns();
    return;
  }

  programmes.forEach((programme, index) => {
    const item = document.createElement("div");
    item.className = "admin-list-item";

    item.innerHTML = `
      <div class="list-content">
        <strong>${escapeHTML(programme.title)} (${escapeHTML(programme.category)})</strong>
        <p>${escapeHTML(programme.venue)} • ${escapeHTML(programme.time)} • ${escapeHTML(programme.status)}</p>
      </div>
      <div class="list-actions">
        <button type="button" class="small-edit-button" data-action="edit-programme" data-index="${index}">Edit</button>
        <button type="button" class="small-danger-button" data-action="delete-programme" data-index="${index}">Delete</button>
      </div>
    `;
    container.appendChild(item);
  });

  populateResultDropdowns();
}

function deleteProgramme(index) {
  const programmes = getJSON("festProgrammes", []);
  const programme = programmes[index];
  if (!programme) return;

  if (!confirm(`Delete programme "${programme.title}"?`)) return;

  const programmeKey = makeProgrammeKey(programme.title, programme.category);
  const results = getJSON("festResults", []);
  const hasResults = results.some(result => makeProgrammeKeyFromResult(result) === programmeKey);

  if (hasResults) {
    showToast("This programme has published results. Delete its results first.", "error");
    return;
  }

  programmes.splice(index, 1);
  setJSON("festProgrammes", programmes);
  loadAdminProgrammesList();
  showToast("Programme deleted.");
}

function editProgramme(index) {
  const programmes = getJSON("festProgrammes", []);
  const programme = programmes[index];
  if (!programme) return;

  const newTitle = prompt("Programme title:", programme.title);
  if (newTitle === null) return;

  const title = newTitle.trim().toUpperCase();
  if (!title) {
    showToast("Programme title cannot be empty.", "error");
    return;
  }

  programme.title = title;
  setJSON("festProgrammes", programmes);
  loadAdminProgrammesList();
  showToast("Programme updated.");
}


/* =========================================================
   GALLERY UPLOAD
========================================================= */

function loadAdminGalleryList() {
  const container = $("adminGalleryList");
  if (!container) return;

  container.replaceChildren();
  const gallery = getJSON("festGallery", []);

  if (!Array.isArray(gallery) || gallery.length === 0) {
    container.appendChild(emptyMessage("No gallery photos uploaded yet."));
    return;
  }

  gallery.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "admin-list-item";

    row.innerHTML = `
      <div class="list-content">
        <strong>${escapeHTML(item.title)}</strong>
        <p>${escapeHTML(item.subtitle)}</p>
      </div>
      <button type="button" class="small-danger-button" data-action="delete-gallery" data-index="${index}">
        Delete
      </button>
    `;
    container.appendChild(row);
  });
}

function uploadGalleryPhoto() {
  const title = $("galleryTitle").value.trim();
  const subtitle = $("gallerySubtitle").value.trim();
  const fileInput = $("galleryImageFile");
  const file = fileInput?.files?.[0];

  if (!title || !subtitle || !file) {
    showToast("Please provide title, subtitle and select an image.", "error");
    return;
  }

  if (typeof storage === "undefined") {
    showToast("Firebase Storage is not initialized.", "error");
    return;
  }

  showToast("Uploading image to Firebase Storage...", "success");

  const storageRef = storage.ref(`gallery/${Date.now()}_${file.name}`);
  storageRef.put(file).then(snapshot => {
    return snapshot.ref.getDownloadURL();
  }).then(downloadURL => {
    const gallery = getJSON("festGallery", []);
    gallery.unshift({
      id: `${Date.now()}`,
      title,
      subtitle,
      imageUrl: downloadURL,
      createdAt: new Date().toISOString()
    });

    setJSON("festGallery", gallery);
    $("galleryForm").reset();
    loadAdminGalleryList();
    showToast("Photo uploaded successfully to Gallery.");
  }).catch(error => {
    console.error("Error uploading gallery image:", error);
    showToast("Failed to upload image. Try again.", "error");
  });
}

function deleteGalleryPhoto(index) {
  const gallery = getJSON("festGallery", []);
  if (!gallery[index]) return;

  if (!confirm("Delete this photo from gallery?")) return;

  gallery.splice(index, 1);
  setJSON("festGallery", gallery);
  loadAdminGalleryList();
  showToast("Gallery photo deleted.");
}


/* =========================================================
   PROGRAMME KEYS & RESULTS
========================================================= */

function makeProgrammeKey(title, category) {
  return `${String(title).trim().toUpperCase()}|||${String(category).trim()}`;
}

function makeProgrammeKeyFromResult(result) {
  const value = String(result.programName || "").trim();
  const match = value.match(/^(.+)\s+\(([^)]+)\)$/);
  if (!match) return value.toUpperCase();
  return makeProgrammeKey(match[1], match[2]);
}

function populateResultDropdowns() {
  const select = $("progSelectInput");
  if (!select) return;

  const previous = select.value;
  select.replaceChildren();

  const first = document.createElement("option");
  first.value = "";
  first.textContent = "Select Programme";
  select.appendChild(first);

  const programmes = getJSON("festProgrammes", []);
  programmes.forEach(programme => {
    const option = document.createElement("option");
    option.value = `${programme.title} (${programme.category})`;
    option.textContent = `${programme.title} (${programme.category})`;
    select.appendChild(option);
  });

  if ([...select.options].some(option => option.value === previous)) {
    select.value = previous;
  }

  refreshCandidateDatalists();
}

function getSelectedProgrammeCategory() {
  const select = $("progSelectInput");
  if (!select || !select.value) return "";
  const match = select.value.match(/\(([^)]+)\)$/);
  return match ? match[1].trim() : "";
}

function isCandidateEligible(candidate) {
  const category = getSelectedProgrammeCategory();
  if (!category) return true;
  return (candidate.category === category || candidate.category === "General" || category === "General");
}

function refreshCandidateDatalists() {
  const candidates = getJSON("festCandidates", []);
  ["res1SearchList", "res2SearchList", "res3SearchList"].forEach(listId => {
    const list = $(listId);
    if (!list) return;

    list.replaceChildren();
    candidates.filter(isCandidateEligible).forEach(candidate => {
      const option = document.createElement("option");
      option.value = candidate.chest;
      option.label = `${candidate.name} (${candidate.group})`;
      list.appendChild(option);
    });
  });
}

function setupCandidateSearch(searchId, chestId, nameId, teamId) {
  const search = $(searchId);
  const chest = $(chestId);
  const name = $(nameId);
  const team = $(teamId);

  if (!search || !chest || !name || !team) return;

  search.addEventListener("input", () => {
    const value = search.value.trim();
    const candidates = getJSON("festCandidates", []);
    const candidate = candidates.find(item => String(item.chest).toLowerCase() === value.toLowerCase());

    if (!candidate || !isCandidateEligible(candidate)) {
      chest.value = "";
      name.value = "";
      team.value = "";
      return;
    }

    chest.value = candidate.chest;
    name.value = candidate.name;
    team.value = candidate.group;
  });

  search.addEventListener("focus", refreshCandidateDatalists);
}

function getResultPlace(prefix) {
  const name = $(`${prefix}Name`).value.trim();
  if (!name) {
    return { chest: "", name: "---", team: "", grade: "" };
  }
  return {
    chest: $(`${prefix}Chest`).value.trim(),
    name,
    team: $(`${prefix}Team`).value,
    grade: $(`${prefix}Grade`).value
  };
}

function validateResultPlace(place, placeName) {
  if (place.name === "---") return true;
  if (!place.chest) {
    showToast(`${placeName}: select a valid candidate.`, "error");
    return false;
  }
  if (!place.team) {
    showToast(`${placeName}: select a team.`, "error");
    return false;
  }
  return true;
}

function calculateTeamPoints(results) {
  const teams = ensureDefaultTeams();
  teams.forEach(team => { team.points = 0; });

  results.forEach(result => {
    const places = [
      { data: result.firstPlace, points: Number(result.p1Val) || 5 },
      { data: result.secondPlace, points: Number(result.p2Val) || 3 },
      { data: result.thirdPlace, points: Number(result.p3Val) || 1 }
    ];

    places.forEach(place => {
      const winner = place.data;
      if (!winner || !winner.name || winner.name === "---" || !winner.team) return;

      const team = teams.find(item => item.name === winner.team);
      if (!team) return;

      team.points += place.points;
      team.points += GRADE_POINTS[winner.grade] || 0;
    });
  });

  setJSON("festTeams", teams);
  return teams;
}

function publishResult() {
  const programme = $("progSelectInput").value.trim();
  if (!programme) {
    showToast("Please select a programme.", "error");
    return false;
  }

  const eventType = $("eventType").value;
  const p1 = Number($("pts1").value);
  const p2 = Number($("pts2").value);
  const p3 = Number($("pts3").value);

  if (!Number.isFinite(p1) || p1 < 0 || !Number.isFinite(p2) || p2 < 0 || !Number.isFinite(p3) || p3 < 0) {
    showToast("Invalid place points.", "error");
    return false;
  }

  const first = getResultPlace("res1");
  const second = getResultPlace("res2");
  const third = getResultPlace("res3");

  if (!validateResultPlace(first, "1st Place")) return false;
  if (!validateResultPlace(second, "2nd Place")) return false;
  if (!validateResultPlace(third, "3rd Place")) return false;

  const selectedChestNumbers = [first.chest, second.chest, third.chest].filter(Boolean);
  if (new Set(selectedChestNumbers).size !== selectedChestNumbers.length) {
    showToast("The same candidate cannot occupy multiple places.", "error");
    return false;
  }

  const results = getJSON("festResults", []);
  const duplicate = results.some(result => {
    return makeProgrammeKeyFromResult(result) === makeProgrammeKeyFromResult({ programName: programme });
  });

  if (duplicate) {
    showToast("A result has already been published for this programme.", "error");
    return false;
  }

  const newResult = {
    id: (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    programName: programme.toUpperCase(),
    eventType,
    p1Val: p1,
    p2Val: p2,
    p3Val: p3,
    firstPlace: first,
    secondPlace: second,
    thirdPlace: third,
    publishedAt: new Date().toISOString()
  };

  results.unshift(newResult);
  setJSON("festResults", results);

  calculateTeamPoints(results);

  loadAdminResultsList();
  loadTeamDataToUI();

  $("resultForm").reset();
  $("res1Chest").value = "";
  $("res2Chest").value = "";
  $("res3Chest").value = "";

  refreshCandidateDatalists();
  showToast("Result published and team points updated successfully.");
  return true;
}

function loadAdminResultsList() {
  const container = $("adminResultsList");
  if (!container) return;

  container.replaceChildren();
  const results = getJSON("festResults", []);

  if (!Array.isArray(results) || results.length === 0) {
    container.appendChild(emptyMessage("No results published yet."));
    return;
  }

  results.forEach((result, index) => {
    const item = document.createElement("div");
    item.className = "admin-list-item";

    item.innerHTML = `
      <div class="list-content">
        <strong>${escapeHTML(result.programName)}</strong>
        <p>
          1st: ${escapeHTML(result.firstPlace?.name || "---")} •
          2nd: ${escapeHTML(result.secondPlace?.name || "---")} •
          3rd: ${escapeHTML(result.thirdPlace?.name || "---")}
        </p>
      </div>
      <button type="button" class="small-danger-button" data-action="delete-result" data-index="${index}">
        Delete
      </button>
    `;
    container.appendChild(item);
  });
}

function deleteResult(index) {
  const results = getJSON("festResults", []);
  const result = results[index];
  if (!result) return;

  if (!confirm(`Delete result for "${result.programName}"?\n\nTeam points will be completely recalculated.`)) return;

  results.splice(index, 1);
  setJSON("festResults", results);

  calculateTeamPoints(results);
  loadAdminResultsList();
  loadTeamDataToUI();
  showToast("Result deleted and team points recalculated.");
}


/* =========================================================
   BACKUP & RESET
========================================================= */

function createBackupData() {
  return {
    backupVersion: 1,
    createdAt: new Date().toISOString(),
    application: "Sira Dars Fest",
    festTeams: getJSON("festTeams", DEFAULT_TEAMS),
    festCandidates: getJSON("festCandidates", []),
    festProgrammes: getJSON("festProgrammes", []),
    festResults: getJSON("festResults", []),
    festUpdates: getJSON("festUpdates", []),
    festGallery: getJSON("festGallery", [])
  };
}

function exportFestBackup() {
  const backup = createBackupData();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `sira_dars_fest_backup_${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Backup exported successfully.");
}

function validateBackup(data) {
  if (!data || typeof data !== "object") return false;
  const requiredKeys = ["festTeams", "festCandidates", "festProgrammes", "festResults", "festUpdates"];
  return requiredKeys.every(key => Array.isArray(data[key]));
}

function importFestBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!validateBackup(imported)) {
        throw new Error("Invalid backup structure");
      }

      if (!confirm("Import this backup?\n\nCurrent festival data will be replaced.")) {
        event.target.value = "";
        return;
      }

      setJSON("festTeams", imported.festTeams);
      setJSON("festCandidates", imported.festCandidates);
      setJSON("festProgrammes", imported.festProgrammes);
      setJSON("festResults", imported.festResults);
      setJSON("festUpdates", imported.festUpdates);
      if (imported.festGallery) {
        setJSON("festGallery", imported.festGallery);
      }

      calculateTeamPoints(imported.festResults);
      showToast("Backup imported successfully.");

      setTimeout(() => {
        window.location.reload();
      }, 700);

    } catch (error) {
      console.error(error);
      showToast("Invalid or corrupted JSON backup.", "error");
    }
    event.target.value = "";
  };

  reader.onerror = () => {
    showToast("Unable to read backup file.", "error");
    event.target.value = "";
  };

  reader.readAsText(file);
}

function resetFestData() {
  const first = confirm(
    "WARNING\n\n" +
    "This will delete candidates, programmes, results and updates.\n\n" +
    "Do you want to export a backup first?"
  );

  if (first) {
    exportFestBackup();
  }

  const second = confirm("FINAL CONFIRMATION\n\nAre you absolutely sure you want to reset ALL festival data?");
  if (!second) return;

  setJSON("festTeams", structuredClone(DEFAULT_TEAMS));
  setJSON("festProgrammes", []);
  setJSON("festCandidates", []);
  setJSON("festResults", []);
  setJSON("festUpdates", []);
  setJSON("festGallery", []);

  showToast("Festival data has been reset.");
  setTimeout(() => {
    window.location.reload();
  }, 700);
}

function emptyMessage(message) {
  const element = document.createElement("div");
  element.className = "empty-message";
  element.textContent = message;
  return element;
}


/* =========================================================
   EVENT SETUP & INITIALIZATION
========================================================= */

function setupForms() {
  $("saveTeamsButton")?.addEventListener("click", saveAllTeams);

  $("galleryForm")?.addEventListener("submit", event => {
    event.preventDefault();
    uploadGalleryPhoto();
  });

  $("updateForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const title = $("updateTitle").value.trim();
    const desc = $("updateDesc").value.trim();
    const time = $("updateTime").value.trim() || getCurrentDateTimeString();
    const type = $("updateType").value;
    const important = $("updateImportant").checked;

    if (!title || !desc) {
      showToast("Please complete update title and description.", "error");
      return;
    }

    const updates = getJSON("festUpdates", []);
    updates.unshift({
      id: (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      title,
      desc,
      time,
      type,
      important,
      createdAt: new Date().toISOString()
    });

    setJSON("festUpdates", updates);
    $("updateForm").reset();
    $("updateTime").value = getCurrentDateTimeString();
    loadAdminUpdatesList();
    showToast("Fest update posted successfully.");
  });

  $("candidateForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const chest = $("candChest").value.trim();
    const name = $("candName").value.trim();
    const group = $("candGroup").value;
    const category = $("candCategory").value;

    if (!chest || !name || !group || !category) {
      showToast("Please complete all candidate fields.", "error");
      return;
    }

    const candidates = getJSON("festCandidates", []);
    const exists = candidates.some(candidate => String(candidate.chest).toLowerCase() === chest.toLowerCase());

    if (exists) {
      showToast("Chest number already exists.", "error");
      return;
    }

    candidates.push({
      chest,
      name,
      group,
      category,
      registeredAt: new Date().toISOString()
    });

    setJSON("festCandidates", candidates);
    $("candidateForm").reset();
    loadAdminCandidatesList();
    refreshCandidateDatalists();
    showToast("Candidate registered successfully.");
  });

  $("programmeForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const title = $("progTitle").value.trim().toUpperCase();
    const category = $("progCat").value;
    const venue = $("progVenue").value.trim();
    const time = $("progTime").value.trim();
    const status = $("progStatus").value.trim() || "Upcoming";

    if (!title || !category || !venue || !time) {
      showToast("Please complete all programme fields.", "error");
      return;
    }

    const programmes = getJSON("festProgrammes", []);
    const duplicate = programmes.some(
      programme => makeProgrammeKey(programme.title, programme.category) === makeProgrammeKey(title, category)
    );

    if (duplicate) {
      showToast("This programme already exists.", "error");
      return;
    }

    programmes.push({
      title,
      category,
      venue,
      time,
      status,
      createdAt: new Date().toISOString()
    });

    setJSON("festProgrammes", programmes);
    $("programmeForm").reset();
    loadAdminProgrammesList();
    showToast("Programme added successfully.");
  });

  $("resultForm")?.addEventListener("submit", event => {
    event.preventDefault();
    publishResult();
  });
}

function setupListActions() {
  $("adminUpdatesList")?.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === "delete-update") {
      deleteUpdate(index);
    }
  });

  $("adminGalleryList")?.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === "delete-gallery") {
      deleteGalleryPhoto(index);
    }
  });

  $("adminCandidatesList")?.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === "edit-candidate") {
      editCandidate(index);
    } else if (button.dataset.action === "delete-candidate") {
      deleteCandidate(index);
    }
  });

  $("adminProgrammesList")?.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === "edit-programme") {
      editProgramme(index);
    } else if (button.dataset.action === "delete-programme") {
      deleteProgramme(index);
    }
  });

  $("adminResultsList")?.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === "delete-result") {
      deleteResult(index);
    }
  });
}

function setupLogout() {
  $("logoutButton")?.addEventListener("click", () => {
    if (!confirm("Logout from the admin panel?")) return;
    sessionStorage.removeItem(STORAGE.AUTH);
    window.location.replace("admin-login.html");
  });
}

function setupBackupControls() {
  $("exportBackupButton")?.addEventListener("click", exportFestBackup);
  $("importFile")?.addEventListener("change", importFestBackup);
  $("resetButton")?.addEventListener("click", resetFestData);
}

function setupProgrammeChange() {
  $("progSelectInput")?.addEventListener("change", () => {
    ["res1", "res2", "res3"].forEach(prefix => {
      $(`${prefix}Search`).value = "";
      $(`${prefix}Chest`).value = "";
      $(`${prefix}Name`).value = "";
      $(`${prefix}Team`).value = "";
      $(`${prefix}Grade`).value = "";
    });
    refreshCandidateDatalists();
  });
}

function initializeAdminPanel() {
  if (sessionStorage.getItem(STORAGE.AUTH) !== "true") {
    window.location.replace("admin-login.html");
    return;
  }

  if ($("updateTime")) {
    $("updateTime").value = getCurrentDateTimeString();
  }

  initAdminFirebaseSync(() => {
    ensureDefaultTeams();
    loadTeamDataToUI();
    loadAdminUpdatesList();
    loadAdminCandidatesList();
    loadAdminProgrammesList();
    loadAdminGalleryList();
    loadAdminResultsList();
    populateResultDropdowns();

    setupCandidateSearch("res1Search", "res1Chest", "res1Name", "res1Team");
    setupCandidateSearch("res2Search", "res2Chest", "res2Name", "res2Team");
    setupCandidateSearch("res3Search", "res3Chest", "res3Name", "res3Team");

    setupForms();
    setupListActions();
    setupLogout();
    setupBackupControls();
    setupProgrammeChange();
    refreshCandidateDatalists();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAdminPanel);
} else {
  initializeAdminPanel();
}
