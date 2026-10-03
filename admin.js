"use strict";

# /*

SIRA DARS FEST
ADMIN PANEL
admin.js

Main rules:

1. Exactly 3 teams

2. Candidate:

   * Chest Number
   * Name
   * Team
   * Category
   * Full edit supported

3. Programme:

   * Stable ID
   * Title
   * Category
   * Venue
   * Time
   * Status
   * Individual / Group
   * 1st / 2nd / 3rd programme-specific points

4. Grade:
   A = 5
   B = 3
   C = 1

5. Individual result:
   Place points + grade points
   -> Candidate
   -> Team

6. Group result:
   Place points + grade points
   -> Team ONLY

7. Group result NEVER contributes
   to individual candidate points.

8. Chest number automatically resolves
   candidate name + team.

9. Team cannot be manually selected
   while entering a result.

10. JSON backup + restore

11. Real XLSX export

=========================================================
*/

/* ========================================================
FIREBASE
======================================================== */

const firebaseConfig = {

```
apiKey: "YOUR_FIREBASE_API_KEY",

authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",

projectId: "YOUR_FIREBASE_PROJECT_ID",

storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",

messagingSenderId:
    "YOUR_FIREBASE_MESSAGING_SENDER_ID",

appId:
    "YOUR_FIREBASE_APP_ID"
```

};

if (!firebase.apps.length) {

```
firebase.initializeApp(
    firebaseConfig
);
```

}

const auth =
firebase.auth();

const db =
firebase.firestore();

/* ========================================================
CONSTANTS
======================================================== */

const ADMIN_COLLECTION =
"admins";

const TEAMS_COLLECTION =
"festTeams";

const CANDIDATES_COLLECTION =
"festCandidates";

const PROGRAMMES_COLLECTION =
"festProgrammes";

const RESULTS_COLLECTION =
"festResults";

const UPDATES_COLLECTION =
"festUpdates";

const DEFAULT_TEAMS = [

```
{
    id: "team_1",
    name: "AL BADR",
    points: 0
},

{
    id: "team_2",
    name: "AL FAROOQ",
    points: 0
},

{
    id: "team_3",
    name: "AL ANSAR",
    points: 0
}
```

];

const GRADE_POINTS = {

```
A: 5,

B: 3,

C: 1
```

};

const VALID_CATEGORIES = [

```
"Sub-Junior",
"Junior",
"Senior",
"General",
"Open"
```

];

const VALID_STATUSES = [

```
"Upcoming",
"Live",
"Completed",
"Cancelled"
```

];

const VALID_EVENT_TYPES = [

```
"individual",
"group"
```

];

/* ========================================================
CACHE
======================================================== */

const adminCache = {

```
teams: [],

candidates: [],

programmes: [],

results: [],

updates: []
```

};

const listeners = [];

let currentUser = null;

let dataReady = {

```
teams: false,

candidates: false,

programmes: false,

results: false,

updates: false
```

};

let selectedBackupFile = null;

let toastTimer = null;

/* ========================================================
DOM HELPERS
======================================================== */

function $(id) {

```
return document.getElementById(id);
```

}

function safeString(value) {

```
if (
    value === null ||
    value === undefined
) {

    return "";

}

return String(value).trim();
```

}

function normalize(value) {

```
return safeString(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
```

}

function numberValue(value) {

```
const number =
    Number(value);

return Number.isFinite(number)
    ? number
    : 0;
```

}

function positiveNumber(value) {

```
const number =
    Number(value);

return Number.isFinite(number) &&
       number >= 0
    ? number
    : null;
```

}

function escapeHTML(value) {

```
return safeString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
```

}

function generateId(prefix) {

```
if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
) {

    return `${prefix}_${crypto.randomUUID()}`;

}


return (
    prefix +
    "_" +
    Date.now() +
    "_" +
    Math.random()
        .toString(36)
        .slice(2, 10)
);
```

}

/* ========================================================
TOAST
======================================================== */

function showToast(
message,
type = "success"
) {

```
const toast =
    $("adminToast");

const toastMessage =
    $("toastMessage");

const toastIcon =
    $("toastIcon");


if (!toast || !toastMessage) {
    return;
}


clearTimeout(
    toastTimer
);


toastMessage.textContent =
    message;


toast.classList.remove(
    "success",
    "error"
);


toast.classList.add(
    type
);


if (toastIcon) {

    toastIcon.textContent =
        type === "error"
            ? "error"
            : "check_circle";

}


toast.classList.add(
    "show"
);


toastTimer =
    setTimeout(
        () => {

            toast.classList.remove(
                "show"
            );

        },
        3200
    );
```

}

/* ========================================================
LOADING
======================================================== */

function setLoading(
visible,
text = "Loading..."
) {

```
const overlay =
    $("adminLoading");

const label =
    $("adminLoadingText");


if (!overlay) {
    return;
}


if (label) {

    label.textContent =
        text;

}


overlay.classList.toggle(
    "hidden",
    !visible
);
```

}

/* ========================================================
FIREBASE ERROR
======================================================== */

function firebaseErrorMessage(
error
) {

```
console.error(
    error
);


if (!error) {

    return "An unknown error occurred.";

}


switch (
    error.code
) {

    case "permission-denied":

        return "Permission denied. Please check Firebase Rules.";

    case "unavailable":

        return "Firebase is temporarily unavailable.";

    case "failed-precondition":

        return "Firebase operation could not be completed.";

    case "network-request-failed":

        return "Network error. Please check your connection.";

    default:

        return (
            error.message ||
            "Something went wrong."
        );

}
```

}

/* ========================================================
AUTHORIZATION
======================================================== */

async function verifyAdmin(
user
) {

```
if (!user) {

    return false;

}


try {

    const adminDoc =
        await db
            .collection(
                ADMIN_COLLECTION
            )
            .doc(
                user.uid
            )
            .get();


    if (!adminDoc.exists) {

        return false;

    }


    const data =
        adminDoc.data() || {};


    return (
        safeString(
            data.role
        ).toLowerCase() ===
        "admin"
    );


} catch (error) {

    console.error(
        "Admin verification failed:",
        error
    );

    return false;

}
```

}

/* ========================================================
AUTH STATE
======================================================== */

auth.onAuthStateChanged(
async user => {

```
    currentUser =
        user || null;


    if (!user) {

        window.location.replace(
            "admin-login.html"
        );

        return;

    }


    const isAdmin =
        await verifyAdmin(
            user
        );


    if (!isAdmin) {

        await auth.signOut();

        window.location.replace(
            "admin-login.html"
        );

        return;

    }


    const email =
        $("adminUserEmail");


    if (email) {

        email.textContent =
            user.email ||
            "Admin";

    }


    initializeAdmin();

}
```

);

/* ========================================================
INITIALIZE
======================================================== */

async function initializeAdmin() {

```
try {

    setupNavigation();

    setupMobileMenu();

    setupLogout();

    setupForms();

    setupBackup();

    setupSearch();

    setupConnectionStatus();

    initializeRealtimeListeners();

} catch (error) {

    console.error(
        "Admin initialization failed:",
        error
    );

    showToast(
        "Admin panel could not initialize.",
        "error"
    );

}
```

}

/* ========================================================
NAVIGATION
======================================================== */

function setupNavigation() {

```
const links =
    document.querySelectorAll(
        ".admin-nav-link"
    );


links.forEach(
    link => {

        link.addEventListener(
            "click",
            event => {

                event.preventDefault();


                const section =
                    link.dataset.section;


                switchSection(
                    section
                );


                history.replaceState(
                    null,
                    "",
                    `#${section}`
                );


                const sidebar =
                    $("adminSidebar");


                if (sidebar) {

                    sidebar.classList.remove(
                        "show"
                    );

                }

            }
        );

    }
);


const hash =
    window.location.hash
        .replace(
            "#",
            ""
        );


if (hash) {

    switchSection(
        hash
    );

}
```

}

function switchSection(
section
) {

```
const sections =
    document.querySelectorAll(
        ".admin-section"
    );


const links =
    document.querySelectorAll(
        ".admin-nav-link"
    );


sections.forEach(
    item => {

        item.classList.toggle(
            "active",
            item.id ===
            `${section}Section`
        );

    }
);


links.forEach(
    link => {

        link.classList.toggle(
            "active",
            link.dataset.section ===
            section
        );

    }
);
```

}

/* ========================================================
MOBILE MENU
======================================================== */

function setupMobileMenu() {

```
const button =
    $("mobileMenuBtn");

const sidebar =
    $("adminSidebar");


if (!button || !sidebar) {
    return;
}


button.addEventListener(
    "click",
    () => {

        sidebar.classList.toggle(
            "show"
        );

    }
);
```

}

/* ========================================================
LOGOUT
======================================================== */

function setupLogout() {

```
const button =
    $("logoutBtn");


if (!button) {
    return;
}


button.addEventListener(
    "click",
    async () => {

        const confirmed =
            confirm(
                "Do you want to log out?"
            );


        if (!confirmed) {
            return;
        }


        try {

            await auth.signOut();

        } catch (error) {

            showToast(
                firebaseErrorMessage(
                    error
                ),
                "error"
            );

        }

    }
);
```

}

/* ========================================================
CONNECTION STATUS
======================================================== */

function setupConnectionStatus() {

```
const update =
    () => {

        const connected =
            navigator.onLine;


        const status =
            $("connectionStatus");

        const dot =
            $("connectionDot");

        const text =
            $("connectionText");

        const dashboardStatus =
            $("dashboardConnectionStatus");

        const dashboardText =
            $("dashboardConnectionText");


        if (connected) {

            if (status) {

                status.classList.remove(
                    "offline"
                );

                status.classList.add(
                    "online"
                );

            }


            if (dot) {

                dot.style.background =
                    "";

            }


            if (text) {

                text.textContent =
                    "Online";

            }


            if (dashboardStatus) {

                dashboardStatus.textContent =
                    "Online";

            }


            if (dashboardText) {

                dashboardText.textContent =
                    "Connected to the network";

            }

        } else {

            if (status) {

                status.classList.remove(
                    "online"
                );

                status.classList.add(
                    "offline"
                );

            }


            if (text) {

                text.textContent =
                    "Offline";

            }


            if (dashboardStatus) {

                dashboardStatus.textContent =
                    "Offline";

            }


            if (dashboardText) {

                dashboardText.textContent =
                    "Network connection unavailable";

            }

        }

    };


window.addEventListener(
    "online",
    update
);


window.addEventListener(
    "offline",
    update
);


update();
```

}

/* ========================================================
REALTIME LISTENERS
======================================================== */

function initializeRealtimeListeners() {

```
removeListeners();


listenToCollection(
    TEAMS_COLLECTION,
    "teams"
);


listenToCollection(
    CANDIDATES_COLLECTION,
    "candidates"
);


listenToCollection(
    PROGRAMMES_COLLECTION,
    "programmes"
);


listenToCollection(
    RESULTS_COLLECTION,
    "results"
);


listenToCollection(
    UPDATES_COLLECTION,
    "updates"
);
```

}

function removeListeners() {

```
while (
    listeners.length
) {

    const unsubscribe =
        listeners.pop();


    try {

        unsubscribe();

    } catch (error) {

        console.warn(
            error
        );

    }

}
```

}

function listenToCollection(
collectionName,
cacheKey
) {

```
const unsubscribe =
    db
        .collection(
            collectionName
        )
        .onSnapshot(
            snapshot => {

                adminCache[
                    cacheKey
                ] =
                    snapshot.docs.map(
                        doc => ({

                            id:
                                doc.id,

                            ...doc.data()

                        })
                    );


                dataReady[
                    cacheKey
                ] = true;


                if (
                    cacheKey ===
                    "results"
                ) {

                    rebuildTeamPoints();

                }


                renderEverything();

            },
            error => {

                console.error(
                    `Listener error: ${collectionName}`,
                    error
                );


                showToast(
                    `Unable to sync ${cacheKey}.`,
                    "error"
                );

            }
        );


listeners.push(
    unsubscribe
);
```

}

/* ========================================================
RENDER EVERYTHING
======================================================== */

function renderEverything() {

```
renderDashboard();

renderTeams();

renderUpdates();

renderCandidates();

renderProgrammes();

renderResults();

populateTeamSelect();

populateProgrammeSelect();

updateResultPlacePoints();

updateLastUpdated();
```

}

/* ========================================================
DASHBOARD
======================================================== */

function renderDashboard() {

```
const teamCount =
    $("statTeams");

const candidateCount =
    $("statCandidates");

const programmeCount =
    $("statProgrammes");

const resultCount =
    $("statResults");


if (teamCount) {

    teamCount.textContent =
        adminCache.teams.length;

}


if (candidateCount) {

    candidateCount.textContent =
        adminCache.candidates.length;

}


if (programmeCount) {

    programmeCount.textContent =
        adminCache.programmes.length;

}


if (resultCount) {

    resultCount.textContent =
        adminCache.results.length;

}


const container =
    $("dashboardTeamPoints");


if (!container) {
    return;
}


const teams =
    [...adminCache.teams]
        .sort(
            (a, b) =>
                numberValue(
                    b.points
                ) -
                numberValue(
                    a.points
                )
        );


if (!teams.length) {

    container.innerHTML =
        `
        <div class="empty-state">
            No team data yet.
        </div>
        `;

    return;

}


container.innerHTML =
    teams
        .map(
            team => `

                <div class="team-point-row">

                    <div class="team-point-name">
                        ${escapeHTML(
                            team.name
                        )}
                    </div>

                    <div class="team-point-value">
                        ${numberValue(
                            team.points
                        )}
                    </div>

                </div>

            `
        )
        .join("");
```

}

/* ========================================================
TEAM MANAGEMENT
======================================================== */

function renderTeams() {

```
const list =
    $("teamsList");


if (!list) {
    return;
}


if (
    adminCache.teams.length === 0
) {

    list.innerHTML =
        `
        <div class="empty-state">
            No teams found.
        </div>
        `;

    return;

}


list.innerHTML =
    adminCache.teams
        .map(
            team => `

                <div class="admin-list-item">

                    <div class="list-item-main">

                        <div class="list-item-title">
                            ${escapeHTML(
                                team.name
                            )}
                        </div>

                        <div class="list-item-meta">

                            <span>
                                Points:
                                ${numberValue(
                                    team.points
                                )}
                            </span>

                            <span>
                                ${escapeHTML(
                                    team.id
                                )}
                            </span>

                        </div>

                    </div>

                </div>

            `
        )
        .join("");


loadTeamsIntoForm();
```

}

function loadTeamsIntoForm() {

```
const sorted =
    [...adminCache.teams]
        .sort(
            (a, b) =>
                String(a.id)
                    .localeCompare(
                        String(b.id)
                    )
        );


const values =
    sorted.length === 3
        ? sorted
        : DEFAULT_TEAMS;


if ($("team1Name")) {

    $("team1Name").value =
        values[0]?.name || "";

}


if ($("team2Name")) {

    $("team2Name").value =
        values[1]?.name || "";

}


if ($("team3Name")) {

    $("team3Name").value =
        values[2]?.name || "";

}
```

}

/* ========================================================
SAVE TEAMS
======================================================== */

async function saveTeams(
event
) {

```
event.preventDefault();


const names = [

    safeString(
        $("team1Name")?.value
    ),

    safeString(
        $("team2Name")?.value
    ),

    safeString(
        $("team3Name")?.value
    )

];


if (
    names.some(
        name => !name
    )
) {

    showToast(
        "All three team names are required.",
        "error"
    );

    return;

}


const normalized =
    names.map(
        normalize
    );


if (
    new Set(
        normalized
    ).size !== 3
) {

    showToast(
        "Team names must be unique.",
        "error"
    );

    return;

}


if (
    adminCache.teams.length !== 3
) {

    showToast(
        "The system must contain exactly three teams.",
        "error"
    );

    return;

}


setLoading(
    true,
    "Saving teams..."
);


try {

    const batch =
        db.batch();


    const oldTeams =
        [...adminCache.teams]
            .sort(
                (a, b) =>
                    String(a.id)
                        .localeCompare(
                            String(b.id)
                        )
            );


    for (
        let i = 0;
        i < 3;
        i++
    ) {

        const team =
            oldTeams[i];


        const ref =
            db
                .collection(
                    TEAMS_COLLECTION
                )
                .doc(
                    team.id
                );


        batch.update(
            ref,
            {

                name:
                    names[i]
                        .toUpperCase(),

                updatedAt:
                    firebase.firestore.FieldValue
                        .serverTimestamp()

            }
        );

    }


    await batch.commit();


    /*
     * Existing candidates/results keep their
     * teamId. We update the displayed team name
     * by resolving teamId at render/calculation time.
     */

    showToast(
        "Teams updated successfully."
    );


} catch (error) {

    showToast(
        firebaseErrorMessage(
            error
        ),
        "error"
    );

} finally {

    setLoading(
        false
    );

}
```

}

/* ========================================================
TEAM HELPERS
======================================================== */

function findTeamById(
teamId
) {

```
return adminCache.teams.find(
    team =>
        team.id ===
        teamId
);
```

}

function findTeamByName(
name
) {

```
const target =
    normalize(
        name
    );


return adminCache.teams.find(
    team =>
        normalize(
            team.name
        ) === target
);
```

}

function teamName(
teamId
) {

```
const team =
    findTeamById(
        teamId
    );


return team
    ? team.name
    : "";
```

}

/* ========================================================
UPDATES
======================================================== */

function renderUpdates() {

```
const list =
    $("updatesList");


if (!list) {
    return;
}


const items =
    [...adminCache.updates]
        .sort(
            (a, b) =>
                numberValue(
                    b.createdAtMillis
                ) -
                numberValue(
                    a.createdAtMillis
                )
        );


if (!items.length) {

    list.innerHTML =
        `
        <div class="empty-state">
            No updates published yet.
        </div>
        `;

    return;

}


list.innerHTML =
    items
        .map(
            item => `

                <div class="admin-list-item">

                    <div class="list-item-main">

                        <div class="list-item-title">

                            ${escapeHTML(
                                item.title
                            )}

                        </div>

                        <div class="list-item-meta">

                            <span>
                                ${escapeHTML(
                                    item.type ||
                                    "General"
                                )}
                            </span>

                            ${
                                item.important
                                    ? `
                                        <span>
                                            Important
                                        </span>
                                      `
                                    : ""
                            }

                        </div>

                        <div class="list-item-description">

                            ${escapeHTML(
                                item.description
                            )}

                        </div>

                    </div>


                    <div class="list-item-actions">

                        <button
                            type="button"
                            class="icon-btn"
                            data-action="edit-update"
                            data-id="${escapeHTML(
                                item.id
                            )}"
                            aria-label="Edit update"
                        >

                            <span class="material-symbols-rounded">
                                edit
                            </span>

                        </button>


                        <button
                            type="button"
                            class="icon-btn danger"
                            data-action="delete-update"
                            data-id="${escapeHTML(
                                item.id
                            )}"
                            aria-label="Delete update"
                        >

                            <span class="material-symbols-rounded">
                                delete
                            </span>

                        </button>

                    </div>

                </div>

            `
        )
        .join("");


list
    .querySelectorAll(
        "[data-action='edit-update']"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () =>
                    editUpdate(
                        button.dataset.id
                    )
            );

        }
    );


list
    .querySelectorAll(
        "[data-action='delete-update']"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () =>
                    deleteUpdate(
                        button.dataset.id
                    )
            );

        }
    );
```

}

/* ========================================================
SAVE UPDATE
======================================================== */

async function saveUpdate(
event
) {

```
event.preventDefault();


const title =
    safeString(
        $("updateTitle")?.value
    );

const description =
    safeString(
        $("updateDescription")?.value
    );

const type =
    safeString(
        $("updateType")?.value
    ) ||
    "General";

const displayTime =
    safeString(
        $("updateTime")?.value
    );

const important =
    Boolean(
        $("updateImportant")?.checked
    );

const editId =
    safeString(
        $("updateEditId")?.value
    );


if (
    !title ||
    !description
) {

    showToast(
        "Title and description are required.",
        "error"
    );

    return;

}


setLoading(
    true,
    editId
        ? "Updating..."
        : "Publishing..."
);


try {

    const data = {

        title,

        description,

        type,

        displayTime,

        important,

        updatedAt:
            firebase.firestore.FieldValue
                .serverTimestamp()

    };


    if (editId) {

        await db
            .collection(
                UPDATES_COLLECTION
            )
            .doc(
                editId
            )
            .update(
                data
            );


        showToast(
            "Update edited successfully."
        );

    } else {

        data.createdAt =
            firebase.firestore.FieldValue
                .serverTimestamp();


        await db
            .collection(
                UPDATES_COLLECTION
            )
            .add(
                data
            );


        showToast(
            "Update published successfully."
        );

    }


    resetUpdateForm();


} catch (error) {

    showToast(
        firebaseErrorMessage(
            error
        ),
        "error"
    );

} finally {

    setLoading(
        false
    );

}
```

}

/* ========================================================
EDIT UPDATE
======================================================== */

function editUpdate(
id
) {

```
const item =
    adminCache.updates.find(
        update =>
            update.id === id
    );


if (!item) {
    return;
}


$("updateEditId").value =
    item.id;

$("updateTitle").value =
    item.title || "";

$("updateDescription").value =
    item.description || "";

$("updateType").value =
    item.type || "General";

$("updateTime").value =
    item.displayTime || "";

$("updateImportant").checked =
    Boolean(
        item.important
    );


$("saveUpdateBtn").innerHTML =
    `
    <span class="material-symbols-rounded">
        save
    </span>
    Save Changes
    `;


$("cancelUpdateEdit")
    ?.classList.remove(
        "hidden"
    );


switchSection(
    "updates"
);


window.scrollTo(
    {
        top: 0,
        behavior: "smooth"
    }
);
```

}

function resetUpdateForm() {

```
$("updateForm")
    ?.reset();


$("updateEditId").value =
    "";


$("saveUpdateBtn").innerHTML =
    `
    <span class="material-symbols-rounded">
        publish
    </span>
    Publish Update
    `;


$("cancelUpdateEdit")
    ?.classList.add(
        "hidden"
    );
```

}

/* ========================================================
DELETE UPDATE
======================================================== */

async function deleteUpdate(
id
) {

```
const confirmed =
    confirm(
        "Delete this update?"
    );


if (!confirmed) {
    return;
}


try {

    await db
        .collection(
            UPDATES_COLLECTION
        )
        .doc(
            id
        )
        .delete();


    showToast(
        "Update deleted."
    );


} catch (error) {

    showToast(
        firebaseErrorMessage(
            error
        ),
        "error"
    );

}
```

}

/* ========================================================
CANDIDATE FORM
======================================================== */

function populateTeamSelect() {

```
const select =
    $("candidateTeam");


if (!select) {
    return;
}


const current =
    select.value;


select.innerHTML =
    `
    <option value="">
        Select Team
    </option>
    ` +
    adminCache.teams
        .map(
            team => `

                <option value="${escapeHTML(
                    team.id
                )}">

                    ${escapeHTML(
                        team.name
                    )}

                </option>

            `
        )
        .join("");


if (current) {

    select.value =
        current;

}
```

}

function saveCandidateForm(
event
) {

```
event.preventDefault();

saveCandidate();
```

}

async function saveCandidate() {

```
const editId =
    safeString(
        $("candidateEditId")?.value
    );


const chest =
    safeString(
        $("candidateChest")?.value
    );


const name =
    safeString(
        $("candidateName")?.value
    );


const teamId =
    safeString(
        $("candidateTeam")?.value
    );


const category =
    safeString(
        $("candidateCategory")?.value
    );


if (
    !chest ||
    !name ||
    !teamId ||
    !category
) {

    showToast(
        "All candidate fields are required.",
        "error"
    );

    return;

}


if (
    !VALID_CATEGORIES.includes(
        category
    )
) {

    showToast(
        "Invalid candidate category.",
        "error"
    );

    return;

}


const team =
    findTeamById(
        teamId
    );


if (!team) {

    showToast(
        "Please select a valid team.",
        "error"
    );

    return;

}


const duplicate =
    adminCache.candidates.find(
        candidate =>
            normalize(
                candidate.chest
            ) ===
            normalize(
                chest
            ) &&
            candidate.id !==
            editId
    );


if (duplicate) {

    showToast(
        "That chest number is already registered.",
        "error"
    );

    return;

}


setLoading(
    true,
    editId
        ? "Updating candidate..."
        : "Registering candidate..."
);


try {

    const data = {

        chest,

        name,

        teamId,

        category,

        updatedAt:
            firebase.firestore.FieldValue
                .serverTimestamp()

    };


    if (editId) {

        await db
            .collection(
                CANDIDATES_COLLECTION
            )
            .doc(
                editId
            )
            .update(
                data
            );


        showToast(
            "Candidate updated successfully."
        );

    } else {

        data.createdAt =
            firebase.firestore.FieldValue
                .serverTimestamp();


        await db
            .collection(
                CANDIDATES_COLLECTION
            )
            .add(
                data
            );


        showToast(
            "Candidate registered successfully."
        );

    }


    resetCandidateForm();


} catch (error) {

    showToast(
        firebaseErrorMessage(
            error
        ),
        "error"
    );

} finally {

    setLoading(
        false
    );

}
```

}

/* ========================================================
CANDIDATE LIST
======================================================== */

function renderCandidates() {

```
const list =
    $("candidatesList");


if (!list) {
    return;
}


const search =
    normalize(
        $("candidateAdminSearch")
            ?.value
    );


let items =
    [...adminCache.candidates];


if (search) {

    items =
        items.filter(
            candidate =>
                normalize(
                    candidate.chest
                ).includes(
                    search
                ) ||
                normalize(
                    candidate.name
                ).includes(
                    search
                ) ||
                normalize(
                    candidate.category
                ).includes(
                    search
                ) ||
                normalize(
                    teamName(
                        candidate.teamId
                    )
                ).includes(
                    search
                )
        );

}


items.sort(
    (a, b) =>
        normalize(
            a.name
        ).localeCompare(
            normalize(
                b.name
            )
        )
);


if (!items.length) {

    list.innerHTML =
        `
        <div class="empty-state">
            No candidates found.
        </div>
        `;

    return;

}


list.innerHTML =
    items
        .map(
            candidate => `

                <div class="admin-list-item">

                    <div class="list-item-main">

                        <div class="list-item-title">

                            ${escapeHTML(
                                candidate.name
                            )}

                        </div>

                        <div class="list-item-meta">

                            <span>
                                Chest:
                                ${escapeHTML(
                                    candidate.chest
                                )}
                            </span>

                            <span>
                                ${escapeHTML(
                                    teamName(
                                        candidate.teamId
                                    )
                                )}
                            </span>

                            <span>
                                ${escapeHTML(
                                    candidate.category
                                )}
                            </span>

                        </div>

                    </div>


                    <div class="list-item-actions">

                        <button
                            type="button"
                            class="icon-btn"
                            data-action="edit-candidate"
                            data-id="${escapeHTML(
                                candidate.id
                            )}"
                            aria-label="Edit candidate"
                        >

                            <span class="material-symbols-rounded">
                                edit
                            </span>

                        </button>


                        <button
                            type="button"
                            class="icon-btn danger"
                            data-action="delete-candidate"
                            data-id="${escapeHTML(
                                candidate.id
                            )}"
                            aria-label="Delete candidate"
                        >

                            <span class="material-symbols-rounded">
                                delete
                            </span>

                        </button>

                    </div>

                </div>

            `
        )
        .join("");


list
    .querySelectorAll(
        "[data-action='edit-candidate']"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () =>
                    editCandidate(
                        button.dataset.id
                    )
            );

        }
    );


list
    .querySelectorAll(
        "[data-action='delete-candidate']"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () =>
                    deleteCandidate(
                        button.dataset.id
                    )
            );

        }
    );
```

}

/* ========================================================
EDIT CANDIDATE
======================================================== */

function editCandidate(
id
) {

```
const candidate =
    adminCache.candidates.find(
        item =>
            item.id === id
    );


if (!candidate) {
    return;
}


$("candidateEditId").value =
    candidate.id;

$("candidateChest").value =
    candidate.chest || "";

$("candidateName").value =
    candidate.name || "";

$("candidateTeam").value =
    candidate.teamId || "";

$("candidateCategory").value =
    candidate.category || "";


$("candidateFormHeading")
    .textContent =
    "Edit Candidate";


$("saveCandidateBtn").innerHTML =
    `
    <span class="material-symbols-rounded">
        save
    </span>
    Save Changes
    `;


$("cancelCandidateEdit")
    ?.classList.remove(
        "hidden"
    );


switchSection(
    "candidates"
);


window.scrollTo(
    {
        top: 0,
        behavior: "smooth"
    }
);
```

}

function resetCandidateForm() {

```
$("candidateForm")
    ?.reset();


$("candidateEditId").value =
    "";


$("candidateFormHeading")
    .textContent =
    "Add Candidate";


$("saveCandidateBtn").innerHTML =
    `
    <span class="material-symbols-rounded">
        person_add
    </span>
    Add Candidate
    `;


$("cancelCandidateEdit")
    ?.classList.add(
        "hidden"
    );
```

}

/* ========================================================
DELETE CANDIDATE
======================================================== */

async function deleteCandidate(
id
) {

```
const candidate =
    adminCache.candidates.find(
        item =>
            item.id === id
    );


if (!candidate) {
    return;
}


const linkedResults =
    adminCache.results.filter(
        result =>
            Array.isArray(
                result.places
            ) &&
            result.places.some(
                place =>
                    place.candidateId ===
                    id
            )
    );


if (
    linkedResults.length
) {

    showToast(
        "This candidate has published results. Delete those results first.",
        "error"
    );

    return;

}


const confirmed =
    confirm(
        `Delete candidate "${candidate.name}"?`
    );


if (!confirmed) {
    return;
}


try {

    await db
        .collection(
            CANDIDATES_COLLECTION
        )
        .doc(
            id
        )
        .delete();


    showToast(
        "Candidate deleted."
    );


} catch (error) {

    showToast(
        firebaseErrorMessage(
            error
        ),
        "error"
    );

}
```

}

/* ========================================================
PROGRAMME SELECT
======================================================== */

function populateProgrammeSelect() {

```
const select =
    $("resultProgramme");


if (!select) {
    return;
}


const current =
    select.value;


const programmes =
    [...adminCache.programmes]
        .sort(
            (a, b) =>
                normalize(
                    a.title
                ).localeCompare(
                    normalize(
                        b.title
                    )
                )
        );


select.innerHTML =
    `
    <option value="">
        Select Programme
    </option>
    ` +
    programmes
        .map(
            programme => `

                <option
                    value="${escapeHTML(
                        programme.id
                    )}"
                >

                    ${escapeHTML(
                        programme.title
                    )}
                    —
                    ${escapeHTML(
                        programme.category
                    )}

                </option>

            `
        )
        .join("");


if (
    programmes.some(
        programme =>
            programme.id ===
            current
    )
) {

    select.value =
        current;

}
```

}

/* ========================================================
PROGRAMME FORM
======================================================== */

async function saveProgrammeForm(
event
) {

```
event.preventDefault();


const editId =
    safeString(
        $("programmeEditId")?.value
    );


const title =
    safeString(
        $("programmeTitle")?.value
    );


const category =
    safeString(
        $("programmeCategory")?.value
    );


const venue =
    safeString(
        $("programmeVenue")?.value
    );


const time =
    safeString(
        $("programmeTime")?.value
    );


const status =
    safeString(
        $("programmeStatus")?.value
    );


const firstPoints =
    positiveNumber(
        $("programmeFirstPoints")?.value
    );


const secondPoints =
    positiveNumber(
        $("programmeSecondPoints")?.value
    );


const thirdPoints =
    positiveNumber(
        $("programmeThirdPoints")?.value
    );


if (
    !title ||
    !category
) {

    showToast(
        "Programme title and category are required.",
        "error"
    );

    return;

}


if (
    firstPoints === null ||
    secondPoints === null ||
    thirdPoints === null
) {

    showToast(
        "Programme points must be valid non-negative numbers.",
        "error"
    );

    return;

}


if (
    !VALID_CATEGORIES.includes(
        category
    )
) {

    showToast(
        "Invalid programme category.",
        "error"
    );

    return;

}


if (
    !VALID_STATUSES.includes(
        status
    )
) {

    showToast(
        "Invalid programme status.",
        "error"
    );

    return;

}


const duplicate =
    adminCache.programmes.find(
        programme =>
            normalize(
                programme.title
            ) ===
            normalize(
                title
            ) &&
            normalize(
                programme.category
            ) ===
            normalize(
                category
            ) &&
            programme.id !==
            editId
    );


if (duplicate) {

    showToast(
        "A programme with this title and category already exists.",
        "error"
    );

    return;

}


setLoading(
    true,
    editId
        ? "Updating programme..."
        : "Creating programme..."
);


try {

    const data = {

        title,

        category,

        venue,

        time,

        status,

        points: {

            first:
                firstPoints,

            second:
                secondPoints,

            third:
                thirdPoints

        },

        updatedAt:
            firebase.firestore.FieldValue
                .serverTimestamp()

    };


    if (editId) {

        await db
            .collection(
                PROGRAMMES_COLLECTION
            )
            .doc(
                editId
            )
            .update(
                data
            );


        showToast(
            "Programme updated successfully."
        );

    } else {

        data.createdAt =
            firebase.firestore.FieldValue
                .serverTimestamp();


        await db
            .collection(
                PROGRAMMES_COLLECTION
            )
            .add(
                data
            );


        showToast(
            "Programme created successfully."
        );

    }


    resetProgrammeForm();


} catch (error) {

    showToast(
        firebaseErrorMessage(
            error
        ),
        "error"
    );

} finally {

    setLoading(
        false
    );

}
```

}

/* ========================================================
RENDER PROGRAMMES
======================================================== */

function renderProgrammes() {

```
const list =
    $("programmesList");


if (!list) {
    return;
}


const search =
    normalize(
        $("programmeAdminSearch")
            ?.value
    );


let items =
    [...adminCache.programmes];


if (search) {

    items =
        items.filter(
            programme =>
                normalize(
                    programme.title
                ).includes(
                    search
                ) ||
                normalize(
                    programme.category
                ).includes(
                    search
                ) ||
                normalize(
                    programme.venue
                ).includes(
                    search
                )
        );

}


items.sort(
    (a, b) =>
        normalize(
            a.title
        ).localeCompare(
            normalize(
                b.title
            )
        )
);


if (!items.length) {

    list.innerHTML =
        `
        <div class="empty-state">
            No programmes found.
        </div>
        `;

    return;

}


list.innerHTML =
    items
        .map(
            programme => {

                const points =
                    programme.points ||
                    {};


                return `

                    <div class="admin-list-item">

                        <div class="list-item-main">

                            <div class="list-item-title">

                                ${escapeHTML(
                                    programme.title
                                )}

                            </div>


                            <div class="list-item-meta">

                                <span>
                                    ${escapeHTML(
                                        programme.category
                                    )}
                                </span>

                                <span>
                                    1st:
                                    ${numberValue(
                                        points.first
                                    )}
                                </span>

                                <span>
                                    2nd:
                                    ${numberValue(
                                        points.second
                                    )}
                                </span>

                                <span>
                                    3rd:
                                    ${numberValue(
                                        points.third
                                    )}
                                </span>

                                <span>
                                    ${escapeHTML(
                                        programme.status ||
                                        "Upcoming"
                                    )}
                                </span>

                            </div>


                            <div class="list-item-description">

                                ${
                                    programme.venue
                                        ? `
                                            Venue:
                                            ${escapeHTML(
                                                programme.venue
                                            )}
                                          `
                                        : ""
                                }

                                ${
                                    programme.time
                                        ? `
                                            ${
                                                programme.venue
                                                    ? " • "
                                                    : ""
                                            }
                                            Time:
                                            ${escapeHTML(
                                                programme.time
                                            )}
                                          `
                                        : ""
                                }

                            </div>

                        </div>


                        <div class="list-item-actions">

                            <button
                                type="button"
                                class="icon-btn"
                                data-action="edit-programme"
                                data-id="${escapeHTML(
                                    programme.id
                                )}"
                                aria-label="Edit programme"
                            >

                                <span class="material-symbols-rounded">
                                    edit
                                </span>

                            </button>


                            <button
                                type="button"
                                class="icon-btn danger"
                                data-action="delete-programme"
                                data-id="${escapeHTML(
                                    programme.id
                                )}"
                                aria-label="Delete programme"
                            >

                                <span class="material-symbols-rounded">
                                    delete
                                </span>

                            </button>

                        </div>

                    </div>

                `;

            }
        )
        .join("");


list
    .querySelectorAll(
        "[data-action='edit-programme']"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () =>
                    editProgramme(
                        button.dataset.id
                    )
            );

        }
    );


list
    .querySelectorAll(
        "[data-action='delete-programme']"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () =>
                    deleteProgramme(
                        button.dataset.id
                    )
            );

        }
    );
```

}

/* ========================================================
EDIT PROGRAMME
======================================================== */

function editProgramme(
id
) {

```
const programme =
    adminCache.programmes.find(
        item =>
            item.id === id
    );


if (!programme) {
    return;
}


const points =
    programme.points ||
    {};


$("programmeEditId").value =
    programme.id;

$("programmeTitle").value =
    programme.title || "";

$("programmeCategory").value =
    programme.category || "";

$("programmeVenue").value =
    programme.venue || "";

$("programmeTime").value =
    programme.time || "";

$("programmeStatus").value =
    programme.status ||
    "Upcoming";

$("programmeFirstPoints").value =
    numberValue(
        points.first
    );

$("programmeSecondPoints").value =
    numberValue(
        points.second
    );

$("programmeThirdPoints").value =
    numberValue(
        points.third
    );


$("programmeFormHeading")
    .textContent =
    "Edit Programme";


$("saveProgrammeBtn").innerHTML =
    `
    <span class="material-symbols-rounded">
        save
    </span>
    Save Changes
    `;


$("cancelProgrammeEdit")
    ?.classList.remove(
        "hidden"
    );


switchSection(
    "programmes"
);


window.scrollTo(
    {
        top: 0,
        behavior: "smooth"
    }
);
```

}

function resetProgrammeForm() {

```
$("programmeForm")
    ?.reset();


$("programmeEditId").value =
    "";


$("programmeFirstPoints").value =
    5;

$("programmeSecondPoints").value =
    3;

$("programmeThirdPoints").value =
    1;


$("programmeStatus").value =
    "Upcoming";


$("programmeFormHeading")
    .textContent =
    "Add Programme";


$("saveProgrammeBtn").innerHTML =
    `
    <span class="material-symbols-rounded">
        add_circle
    </span>
    Add Programme
    `;


$("cancelProgrammeEdit")
    ?.classList.add(
        "hidden"
    );
```

}

/* ========================================================
DELETE PROGRAMME
======================================================== */

async function deleteProgramme(
id
) {

```
const programme =
    adminCache.programmes.find(
        item =>
            item.id === id
    );


if (!programme) {
    return;
}


const linked =
    adminCache.results.some(
        result =>
            result.programmeId ===
            id
    );


if (linked) {

    showToast(
        "This programme has published results. Delete those results first.",
        "error"
    );

    return;

}


const confirmed =
    confirm(
        `Delete programme "${programme.title}"?`
    );


if (!confirmed) {
    return;
}


try {

    await db
        .collection(
            PROGRAMMES_COLLECTION
        )
        .doc(
            id
        )
        .delete();


    showToast(
        "Programme deleted."
    );


} catch (error) {

    showToast(
        firebaseErrorMessage(
            error
        ),
        "error"
    );

}
```

}

/* ========================================================
RESULT POINTS
======================================================== */

function getProgrammePoints(
programme
) {

```
const points =
    programme?.points ||
    {};


return {

    first:
        numberValue(
            points.first
        ),

    second:
        numberValue(
            points.second
        ),

    third:
        numberValue(
            points.third
        )

};
```

}

function updateResultPlacePoints() {

```
const programmeId =
    safeString(
        $("resultProgramme")?.value
    );


const programme =
    adminCache.programmes.find(
        item =>
            item.id ===
            programmeId
    );


if (!programme) {

    [
        "1",
        "2",
        "3"
    ].forEach(
        place => {

            const input =
                $(
                    `result${place}Points`
                );


            if (input) {

                input.value =
                    "";

            }

        }
    );

    return;

}


const points =
    getProgrammePoints(
        programme
    );


const map = {

    "1":
        points.first,

    "2":
        points.second,

    "3":
        points.third

};


Object.keys(
    map
).forEach(
    place => {

        const input =
            $(
                `result${place}Points`
            );


        if (input) {

            input.value =
                map[place];

        }

    }
);
```

}

/* ========================================================
CANDIDATE RESOLUTION
======================================================== */

function findCandidateByChest(
chest
) {

```
const target =
    normalize(
        chest
    );


if (!target) {
    return null;
}


return adminCache.candidates.find(
    candidate =>
        normalize(
            candidate.chest
        ) ===
        target
) || null;
```

}

/* ========================================================
RESULT PLACE AUTO FILL
======================================================== */

function setupChestInput(
place
) {

```
const chestInput =
    $(
        `result${place}Chest`
    );


if (!chestInput) {
    return;
}


chestInput.addEventListener(
    "input",
    () => {

        const candidate =
            findCandidateByChest(
                chestInput.value
            );


        fillResultCandidate(
            place,
            candidate
        );

    }
);


chestInput.addEventListener(
    "blur",
    () => {

        const candidate =
            findCandidateByChest(
                chestInput.value
            );


        fillResultCandidate(
            place,
            candidate
        );

    }
);
```

}

function fillResultCandidate(
place,
candidate
) {

```
const nameInput =
    $(
        `result${place}Name`
    );

const teamInput =
    $(
        `result${place}Team`
    );


if (!nameInput || !teamInput) {
    return;
}


if (!candidate) {

    nameInput.value =
        "";

    teamInput.value =
        "";


    if (
        safeString(
            $(
                `result${place}Chest`
            )?.value
        )
    ) {

        nameInput.placeholder =
            "Candidate not found";

        teamInput.placeholder =
            "Candidate not found";

    } else {

        nameInput.placeholder =
            "Auto-filled";

        teamInput.placeholder =
            "Auto-filled";

    }


    return;

}


nameInput.value =
    candidate.name || "";


teamInput.value =
    teamName(
        candidate.teamId
    ) || "";


nameInput.placeholder =
    "Auto-filled";

teamInput.placeholder =
    "Auto-filled";
```

}

/* ========================================================
RESULT DATA
======================================================== */

function readResultPlace(
place
) {

```
const chest =
    safeString(
        $(
            `result${place}Chest`
        )?.value
    );


if (!chest) {

    return null;

}


const candidate =
    findCandidateByChest(
        chest
    );


if (!candidate) {

    throw new Error(
        `Chest number "${chest}" was not found.`
    );

}


const grade =
    safeString(
        $(
            `result${place}Grade`
        )?.value
    );


if (
    !GRADE_POINTS.hasOwnProperty(
        grade
    )
) {

    throw new Error(
        `Select A, B or C grade for ${place === "1" ? "1st" : place === "2" ? "2nd" : "3rd"} place.`
    );

}


const points =
    positiveNumber(
        $(
            `result${place}Points`
        )?.value
    );


if (points === null) {

    throw new Error(
        `Invalid points for place ${place}.`
    );

}


return {

    place:
        Number(place),

    candidateId:
        candidate.id,

    chest:
        candidate.chest,

    name:
        candidate.name,

    teamId:
        candidate.teamId,

    grade,

    gradePoints:
        GRADE_POINTS[
            grade
        ],

    placePoints:
        points

};
```

}

/* ========================================================
SAVE RESULT
======================================================== */

async function saveResult(
event
) {

```
event.preventDefault();


const programmeId =
    safeString(
        $("resultProgramme")?.value
    );


const eventType =
    safeString(
        $("resultEventType")?.value
    );


if (!programmeId) {

    showToast(
        "Select a programme.",
        "error"
    );

    return;

}


if (
    !VALID_EVENT_TYPES.includes(
        eventType
    )
) {

    showToast(
        "Select a valid event type.",
        "error"
    );

    return;

}


const programme =
    adminCache.programmes.find(
        item =>
            item.id ===
            programmeId
    );


if (!programme) {

    showToast(
        "Selected programme was not found.",
        "error"
    );

    return;

}


let places = [];


try {

    [
        "1",
        "2",
        "3"
    ].forEach(
        place => {

            const data =
                readResultPlace(
                    place
                );


            if (data) {

                places.push(
                    data
                );

            }

        }
    );

} catch (error) {

    showToast(
        error.message,
        "error"
    );

    return;

}


if (!places.length) {

    showToast(
        "Enter at least one result.",
        "error"
    );

    return;

}


const candidateIds =
    places.map(
        place =>
            place.candidateId
    );


if (
    new Set(
        candidateIds
    ).size !==
    candidateIds.length
) {

    showToast(
        "The same candidate cannot occupy multiple places.",
        "error"
    );

    return;

}


/*
 * Category integrity:
 *
 * Individual events require the candidate
 * category to match the programme category,
 * unless the programme category is General/Open.
 *
 * Group events are also tied to the programme
 * category, but the points are team-only.
 */

const programmeCategory =
    normalize(
        programme.category
    );


if (
    programmeCategory !==
        "general" &&
    programmeCategory !==
        "open"
) {

    const invalid =
        places.find(
            place => {

                const candidate =
                    adminCache.candidates.find(
                        item =>
                            item.id ===
                            place.candidateId
                    );


                return (
                    candidate &&
                    normalize(
                        candidate.category
                    ) !==
                    programmeCategory
                );

            }
        );


    if (invalid) {

        showToast(
            "Candidate category does not match the programme category.",
            "error"
        );

        return;

    }

}


const duplicateResult =
    adminCache.results.find(
        result =>
            result.programmeId ===
            programmeId
    );


if (duplicateResult) {

    showToast(
        "This programme already has a published result.",
        "error"
    );

    return;

}


/*
 * IMPORTANT:
 *
 * For group events, candidate information is
 * retained for identification, but candidate
 * points are NEVER calculated from this result.
 *
 * Team receives:
 * placePoints + gradePoints
 *
 * Individual candidate receives:
 * placePoints + gradePoints
 */

const resultData = {

    programmeId,

    programmeTitle:
        programme.title,

    programmeCategory:
        programme.category,

    eventType,

    places,

    createdAt:
        firebase.firestore.FieldValue
            .serverTimestamp(),

    updatedAt:
        firebase.firestore.FieldValue
            .serverTimestamp()

};


setLoading(
    true,
    "Publishing result..."
);


try {

    await db
        .collection(
            RESULTS_COLLECTION
        )
        .add(
            resultData
        );


    showToast(
        "Result published successfully."
    );


    resetResultForm();


} catch (error) {

    showToast(
        firebaseErrorMessage(
            error
        ),
        "error"
    );

} finally {

    setLoading(
        false
    );

}
```

}

/* ========================================================
RESULT LIST
======================================================== */

function renderResults() {

```
const list =
    $("resultsList");


if (!list) {
    return;
}


const items =
    [...adminCache.results]
        .sort(
            (a, b) =>
                numberValue(
                    b.createdAtMillis
                ) -
                numberValue(
                    a.createdAtMillis
                )
        );


if (!items.length) {

    list.innerHTML =
        `
        <div class="empty-state">
            No results published yet.
        </div>
        `;

    return;

}


list.innerHTML =
    items
        .map(
            result => {

                const places =
                    Array.isArray(
                        result.places
                    )
                        ? result.places
                        : [];


                return `

                    <div class="admin-list-item">

                        <div class="list-item-main">

                            <div class="list-item-title">

                                ${escapeHTML(
                                    result.programmeTitle
                                )}

                            </div>


                            <div class="list-item-meta">

                                <span>
                                    ${escapeHTML(
                                        result.programmeCategory ||
                                        ""
                                    )}
                                </span>

                                <span>
                                    ${
                                        result.eventType ===
                                        "group"
                                            ? "Group"
                                            : "Individual"
                                    }
                                </span>

                            </div>


                            <div class="list-item-description">

                                ${places
                                    .map(
                                        place => `

                                            <div>
                                                <strong>
                                                    ${place.place}.
                                                </strong>

                                                ${escapeHTML(
                                                    place.name
                                                )}

                                                —
                                                ${escapeHTML(
                                                    place.chest
                                                )}

                                                —
                                                ${escapeHTML(
                                                    teamName(
                                                        place.teamId
                                                    )
                                                )}

                                                —
                                                ${escapeHTML(
                                                    place.grade
                                                )}

                                                —
                                                ${numberValue(
                                                    place.placePoints
                                                )}
                                                + 
                                                ${numberValue(
                                                    place.gradePoints
                                                )}
                                            </div>

                                        `
                                    )
                                    .join("")}

                            </div>

                        </div>


                        <div class="list-item-actions">

                            <button
                                type="button"
                                class="icon-btn danger"
                                data-action="delete-result"
                                data-id="${escapeHTML(
                                    result.id
                                )}"
                                aria-label="Delete result"
                            >

                                <span class="material-symbols-rounded">
                                    delete
                                </span>

                            </button>

                        </div>

                    </div>

                `;

            }
        )
        .join("");


list
    .querySelectorAll(
        "[data-action='delete-result']"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () =>
                    deleteResult(
                        button.dataset.id
                    )
            );

        }
    );
```

}

/* ========================================================
DELETE RESULT
======================================================== */

async function deleteResult(
id
) {

```
const confirmed =
    confirm(
        "Delete this published result?"
    );


if (!confirmed) {
    return;
}


try {

    await db
        .collection(
            RESULTS_COLLECTION
        )
        .doc(
            id
        )
        .delete();


    showToast(
        "Result deleted."
    );


} catch (error) {

    showToast(
        firebaseErrorMessage(
            error
        ),
        "error"
    );

}
```

}

/* ========================================================
TEAM SCORING
======================================================== */

function calculateResultPoints(
place
) {

```
return (
    numberValue(
        place.placePoints
    ) +
    numberValue(
        place.gradePoints
    )
);
```

}

function rebuildTeamPoints() {

```
if (
    adminCache.teams.length !== 3
) {

    return;

}


const totals =
    {};


adminCache.teams.forEach(
    team => {

        totals[
            team.id
        ] = 0;

    }
);


adminCache.results.forEach(
    result => {

        const places =
            Array.isArray(
                result.places
            )
                ? result.places
                : [];


        places.forEach(
            place => {

                if (
                    totals.hasOwnProperty(
                        place.teamId
                    )
                ) {

                    /*
                     * BOTH individual and group
                     * results contribute to team.
                     */

                    totals[
                        place.teamId
                    ] +=
                        calculateResultPoints(
                            place
                        );

                }

            }
        );

    }
);


/*
 * Update local team totals only.
 * Do NOT write them continuously to Firestore.
 *
 * This prevents unnecessary writes whenever
 * a snapshot arrives.
 */

adminCache.teams =
    adminCache.teams.map(
        team => ({

            ...team,

            points:
                totals[
                    team.id
                ] || 0

        })
    );


renderDashboard();
```

}

/* ========================================================
CANDIDATE TOTAL
======================================================== */

function calculateCandidateTotal(
candidateId
) {

```
let total = 0;


adminCache.results.forEach(
    result => {

        /*
         * GROUP RESULT:
         * absolutely NO candidate points.
         */

        if (
            result.eventType ===
            "group"
        ) {

            return;

        }


        const places =
            Array.isArray(
                result.places
            )
                ? result.places
                : [];


        places.forEach(
            place => {

                if (
                    place.candidateId ===
                    candidateId
                ) {

                    total +=
                        calculateResultPoints(
                            place
                        );

                }

            }
        );

    }
);


return total;
```

}

/* ========================================================
BACKUP DATA
======================================================== */

function getBackupData() {

```
return {

    application:
        "Sira Dars Fest",

    version:
        2,

    exportedAt:
        new Date()
            .toISOString(),

    teams:
        adminCache.teams,

    candidates:
        adminCache.candidates,

    programmes:
        adminCache.programmes,

    results:
        adminCache.results,

    updates:
        adminCache.updates

};
```

}

/* ========================================================
JSON EXPORT
======================================================== */

function exportJSON() {

```
try {

    const data =
        getBackupData();


    const json =
        JSON.stringify(
            data,
            null,
            2
        );


    const blob =
        new Blob(
            [
                json
            ],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    const date =
        new Date()
            .toISOString()
            .slice(
                0,
                10
            );


    link.href =
        url;

    link.download =
        `sira-dars-fest-backup-${date}.json`;


    document.body.appendChild(
        link
    );

    link.click();

    link.remove();


    URL.revokeObjectURL(
        url
    );


    showToast(
        "JSON backup exported."
    );


} catch (error) {

    console.error(
        error
    );

    showToast(
        "JSON export failed.",
        "error"
    );

}
```

}

/* ========================================================
EXCEL EXPORT
======================================================== */

function exportExcel() {

```
if (
    typeof XLSX ===
    "undefined"
) {

    showToast(
        "Excel library is not available.",
        "error"
    );

    return;

}


try {

    const workbook =
        XLSX.utils.book_new();


    /* -----------------------------------------------
       TEAMS
    ----------------------------------------------- */

    const teamsRows =
        adminCache.teams.map(
            team => ({

                "Team":
                    team.name,

                "Points":
                    numberValue(
                        team.points
                    )

            })
        );


    const teamsSheet =
        XLSX.utils.json_to_sheet(
            teamsRows
        );


    XLSX.utils.book_append_sheet(
        workbook,
        teamsSheet,
        "Teams"
    );


    /* -----------------------------------------------
       CANDIDATES
    ----------------------------------------------- */

    const candidateRows =
        adminCache.candidates.map(
            candidate => ({

                "Chest Number":
                    candidate.chest,

                "Name":
                    candidate.name,

                "Team":
                    teamName(
                        candidate.teamId
                    ),

                "Category":
                    candidate.category,

                "Individual Points":
                    calculateCandidateTotal(
                        candidate.id
                    )

            })
        );


    const candidateSheet =
        XLSX.utils.json_to_sheet(
            candidateRows
        );


    XLSX.utils.book_append_sheet(
        workbook,
        candidateSheet,
        "Candidates"
    );


    /* -----------------------------------------------
       PROGRAMMES
    ----------------------------------------------- */

    const programmeRows =
        adminCache.programmes.map(
            programme => {

                const points =
                    programme.points ||
                    {};


                return {

                    "Programme ID":
                        programme.id,

                    "Title":
                        programme.title,

                    "Category":
                        programme.category,

                    "Venue":
                        programme.venue || "",

                    "Time":
                        programme.time || "",

                    "Status":
                        programme.status || "",

                    "1st Points":
                        numberValue(
                            points.first
                        ),

                    "2nd Points":
                        numberValue(
                            points.second
                        ),

                    "3rd Points":
                        numberValue(
                            points.third
                        )

                };

            }
        );


    const programmeSheet =
        XLSX.utils.json_to_sheet(
            programmeRows
        );


    XLSX.utils.book_append_sheet(
        workbook,
        programmeSheet,
        "Programmes"
    );


    /* -----------------------------------------------
       RESULTS
    ----------------------------------------------- */

    const resultRows = [];


    adminCache.results.forEach(
        result => {

            const places =
                Array.isArray(
                    result.places
                )
                    ? result.places
                    : [];


            places.forEach(
                place => {

                    resultRows.push({

                        "Programme ID":
                            result.programmeId,

                        "Programme":
                            result.programmeTitle,

                        "Category":
                            result.programmeCategory,

                        "Event Type":
                            result.eventType,

                        "Place":
                            place.place,

                        "Chest Number":
                            place.chest,

                        "Candidate":
                            place.name,

                        "Team":
                            teamName(
                                place.teamId
                            ),

                        "Grade":
                            place.grade,

                        "Grade Points":
                            numberValue(
                                place.gradePoints
                            ),

                        "Place Points":
                            numberValue(
                                place.placePoints
                            ),

                        "Total Result Points":
                            calculateResultPoints(
                                place
                            ),

                        "Candidate Points Added":
                            result.eventType ===
                            "group"
                                ? 0
                                : calculateResultPoints(
                                    place
                                ),

                        "Team Points Added":
                            calculateResultPoints(
                                place
                            )

                    });

                }
            );

        }
    );


    const resultSheet =
        XLSX.utils.json_to_sheet(
            resultRows
        );


    XLSX.utils.book_append_sheet(
        workbook,
        resultSheet,
        "Results"
    );


    /* -----------------------------------------------
       UPDATES
    ----------------------------------------------- */

    const updateRows =
        adminCache.updates.map(
            update => ({

                "Title":
                    update.title,

                "Description":
                    update.description,

                "Type":
                    update.type,

                "Display Time":
                    update.displayTime,

                "Important":
                    update.important
                        ? "Yes"
                        : "No"

            })
        );


    const updateSheet =
        XLSX.utils.json_to_sheet(
            updateRows
        );


    XLSX.utils.book_append_sheet(
        workbook,
        updateSheet,
        "Updates"
    );


    const date =
        new Date()
            .toISOString()
            .slice(
                0,
                10
            );


    XLSX.writeFile(
        workbook,
        `sira-dars-fest-${date}.xlsx`
    );


    showToast(
        "Excel file exported successfully."
    );


} catch (error) {

    console.error(
        "Excel export error:",
        error
    );


    showToast(
        "Excel export failed.",
        "error"
    );

}
```

}

/* ========================================================
JSON RESTORE
======================================================== */

async function restoreJSON(
file
) {

```
if (!file) {

    showToast(
        "Please select a JSON backup file.",
        "error"
    );

    return;

}


let data;


try {

    const text =
        await file.text();


    data =
        JSON.parse(
            text
        );

} catch (error) {

    showToast(
        "The selected file is not valid JSON.",
        "error"
    );

    return;

}


if (
    !data ||
    typeof data !==
        "object"
) {

    showToast(
        "Invalid backup structure.",
        "error"
    );

    return;

}


const teams =
    Array.isArray(
        data.teams
    )
        ? data.teams
        : [];

const candidates =
    Array.isArray(
        data.candidates
    )
        ? data.candidates
        : [];

const programmes =
    Array.isArray(
        data.programmes
    )
        ? data.programmes
        : [];

const results =
    Array.isArray(
        data.results
    )
        ? data.results
        : [];

const updates =
    Array.isArray(
        data.updates
    )
        ? data.updates
        : [];


if (
    teams.length !== 3
) {

    showToast(
        "Backup must contain exactly three teams.",
        "error"
    );

    return;

}


const confirmed =
    confirm(
        "Restore this backup? Existing teams, candidates, programmes, results and updates will be replaced."
    );


if (!confirmed) {
    return;
}


setLoading(
    true,
    "Restoring backup..."
);


try {

    /*
     * Clear existing collections first.
     */

    await clearCollection(
        TEAMS_COLLECTION
    );

    await clearCollection(
        CANDIDATES_COLLECTION
    );

    await clearCollection(
        PROGRAMMES_COLLECTION
    );

    await clearCollection(
        RESULTS_COLLECTION
    );

    await clearCollection(
        UPDATES_COLLECTION
    );


    /*
     * Restore using generated/existing IDs.
     */

    await restoreCollection(
        TEAMS_COLLECTION,
        teams
    );

    await restoreCollection(
        CANDIDATES_COLLECTION,
        candidates
    );

    await restoreCollection(
        PROGRAMMES_COLLECTION,
        programmes
    );

    await restoreCollection(
        RESULTS_COLLECTION,
        results
    );

    await restoreCollection(
        UPDATES_COLLECTION,
        updates
    );


    showToast(
        "Backup restored successfully."
    );


} catch (error) {

    showToast(
        firebaseErrorMessage(
            error
        ),
        "error"
    );

} finally {

    setLoading(
        false
    );

}
```

}

/* ========================================================
CLEAR COLLECTION
======================================================== */

async function clearCollection(
collectionName
) {

```
const snapshot =
    await db
        .collection(
            collectionName
        )
        .get();


if (
    snapshot.empty
) {

    return;

}


const docs =
    snapshot.docs;


for (
    let start = 0;
    start < docs.length;
    start += 400
) {

    const batch =
        db.batch();


    const chunk =
        docs.slice(
            start,
            start + 400
        );


    chunk.forEach(
        doc => {

            batch.delete(
                doc.ref
            );

        }
    );


    await batch.commit();

}
```

}

/* ========================================================
RESTORE COLLECTION
======================================================== */

async function restoreCollection(
collectionName,
items
) {

```
if (!items.length) {
    return;
}


for (
    let start = 0;
    start < items.length;
    start += 400
) {

    const batch =
        db.batch();


    const chunk =
        items.slice(
            start,
            start + 400
        );


    chunk.forEach(
        item => {

            const id =
                safeString(
                    item.id
                ) ||
                generateId(
                    collectionName
                );


            const data =
                {
                    ...item
                };


            delete data.id;


            batch.set(
                db
                    .collection(
                        collectionName
                    )
                    .doc(
                        id
                    ),
                data
            );

        }
    );


    await batch.commit();

}
```

}

/* ========================================================
BACKUP EVENTS
======================================================== */

function setupBackup() {

```
$("exportJsonBtn")
    ?.addEventListener(
        "click",
        exportJSON
    );


$("exportExcelBtn")
    ?.addEventListener(
        "click",
        exportExcel
    );


$("importJsonFile")
    ?.addEventListener(
        "change",
        event => {

            selectedBackupFile =
                event.target.files?.[0] ||
                null;


            const label =
                $("selectedBackupFile");


            const button =
                $("importJsonBtn");


            if (label) {

                label.textContent =
                    selectedBackupFile
                        ? selectedBackupFile.name
                        : "No file selected";

            }


            if (button) {

                button.disabled =
                    !selectedBackupFile;

            }

        }
    );


$("importJsonBtn")
    ?.addEventListener(
        "click",
        () =>
            restoreJSON(
                selectedBackupFile
            )
    );


$("resetAllDataBtn")
    ?.addEventListener(
        "click",
        resetAllData
    );
```

}

/* ========================================================
SEARCH
======================================================== */

function setupSearch() {

```
$("candidateAdminSearch")
    ?.addEventListener(
        "input",
        renderCandidates
    );


$("programmeAdminSearch")
    ?.addEventListener(
        "input",
        renderProgrammes
    );
```

}

/* ========================================================
FORMS
======================================================== */

function setupForms() {

```
$("teamsForm")
    ?.addEventListener(
        "submit",
        saveTeams
    );


$("updateForm")
    ?.addEventListener(
        "submit",
        saveUpdate
    );


$("candidateForm")
    ?.addEventListener(
        "submit",
        saveCandidateForm
    );


$("programmeForm")
    ?.addEventListener(
        "submit",
        saveProgrammeForm
    );


$("resultForm")
    ?.addEventListener(
        "submit",
        saveResult
    );


$("cancelUpdateEdit")
    ?.addEventListener(
        "click",
        resetUpdateForm
    );


$("cancelCandidateEdit")
    ?.addEventListener(
        "click",
        resetCandidateForm
    );


$("cancelProgrammeEdit")
    ?.addEventListener(
        "click",
        resetProgrammeForm
    );


$("resultProgramme")
    ?.addEventListener(
        "change",
        updateResultPlacePoints
    );


[
    "1",
    "2",
    "3"
].forEach(
    place =>
        setupChestInput(
            place
        )
);
```

}

/* ========================================================
LAST UPDATED
======================================================== */

function updateLastUpdated() {

```
const element =
    $("adminLastUpdated");


if (!element) {
    return;
}


element.textContent =
    new Date()
        .toLocaleTimeString(
            [],
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit",

                second:
                    "2-digit"
            }
        );
```

}

/* ========================================================
RESET RESULT FORM
======================================================== */

function resetResultForm() {

```
$("resultForm")
    ?.reset();


[
    "1",
    "2",
    "3"
].forEach(
    place => {

        const name =
            $(
                `result${place}Name`
            );

        const team =
            $(
                `result${place}Team`
            );

        const points =
            $(
                `result${place}Points`
            );


        if (name) {

            name.value =
                "";

        }


        if (team) {

            team.value =
                "";

        }


        if (points) {

            points.value =
                "";

        }

    }
);
```

}

/* ========================================================
RESET ALL DATA
======================================================== */

async function resetAllData() {

```
const firstConfirm =
    confirm(
        "This will permanently delete all fest teams, candidates, programmes, results and updates. Continue?"
    );


if (!firstConfirm) {
    return;
}


const secondConfirm =
    confirm(
        "Final confirmation: delete ALL fest data?"
    );


if (!secondConfirm) {
    return;
}


setLoading(
    true,
    "Resetting fest data..."
);


try {

    await clearCollection(
        TEAMS_COLLECTION
    );

    await clearCollection(
        CANDIDATES_COLLECTION
    );

    await clearCollection(
        PROGRAMMES_COLLECTION
    );

    await clearCollection(
        RESULTS_COLLECTION
    );

    await clearCollection(
        UPDATES_COLLECTION
    );


    /*
     * Recreate exactly three teams.
     */

    const batch =
        db.batch();


    DEFAULT_TEAMS.forEach(
        team => {

            const ref =
                db
                    .collection(
                        TEAMS_COLLECTION
                    )
                    .doc(
                        team.id
                    );


            batch.set(
                ref,
                {

                    name:
                        team.name,

                    points:
                        0,

                    createdAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp(),

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()

                }
            );

        }
    );


    await batch.commit();


    showToast(
        "All fest data has been reset."
    );


} catch (error) {

    showToast(
        firebaseErrorMessage(
            error
        ),
        "error"
    );

} finally {

    setLoading(
        false
    );

}
```

}

/* ========================================================
INITIAL FALLBACK TEAM CREATION
======================================================== */

async function ensureTeamsExist() {

```
const snapshot =
    await db
        .collection(
            TEAMS_COLLECTION
        )
        .get();


if (
    snapshot.size === 3
) {

    return;

}


/*
 * Only create defaults when the collection
 * is empty.
 *
 * Do not overwrite existing teams automatically.
 */

if (
    snapshot.empty
) {

    const batch =
        db.batch();


    DEFAULT_TEAMS.forEach(
        team => {

            batch.set(

                db
                    .collection(
                        TEAMS_COLLECTION
                    )
                    .doc(
                        team.id
                    ),

                {

                    name:
                        team.name,

                    points:
                        0,

                    createdAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp(),

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()

                }

            );

        }
    );


    await batch.commit();

}
```

}

/* ========================================================
BOOTSTRAP
======================================================== */

window.addEventListener(
"beforeunload",
() => {

```
    removeListeners();

}
```

);

/*

* Create the default three teams only when the
* collection is completely empty.
*
* This is deliberately delayed until Firebase Auth
* has verified the admin.
  */

auth.onAuthStateChanged(
async user => {

```
    if (!user) {
        return;
    }


    try {

        const isAdmin =
            await verifyAdmin(
                user
            );


        if (
            !isAdmin
        ) {

            return;

        }


        await ensureTeamsExist();


    } catch (error) {

        console.error(
            "Team bootstrap error:",
            error
        );

    }

}
```

);

/* ========================================================
END
========================================================= */
