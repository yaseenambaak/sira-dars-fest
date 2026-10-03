/* =========================================================
   SIRA DARS FEST
   app.js
   Public Website Application
========================================================= */

"use strict";


/* =========================================================
   GLOBAL CONSTANTS
========================================================= */

const GRADE_POINTS = Object.freeze({
    A: 5,
    B: 3,
    C: 1
});

const DEFAULT_TEAMS = [
    {
        id: "al-badr",
        name: "AL BADR",
        points: 0
    },
    {
        id: "al-farooq",
        name: "AL FAROOQ",
        points: 0
    },
    {
        id: "al-ansar",
        name: "AL ANSAR",
        points: 0
    }
];


/* =========================================================
   PUBLIC CACHE
========================================================= */

const festCache = {
    teams: [],
    candidates: [],
    programmes: [],
    results: [],
    updates: [],
    gallery: []
};


/* =========================================================
   CURRENT UI STATE
========================================================= */

const appState = {
    currentView: "home",

    candidateSearch: "",
    updateSearch: "",
    resultSearch: "",

    candidateCategory: "all",
    programmeFilter: "all",
    resultFilter: "all",

    dataReady: {
        teams: false,
        candidates: false,
        programmes: false,
        results: false,
        updates: false,
        gallery: false
    },

    listenersStarted: false,
    initialRenderDone: false,
    lastServerUpdate: null
};


/* =========================================================
   FIRESTORE LISTENER REFERENCES
========================================================= */

const publicListeners = [];


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    setupSplash();

    setupNavigation();

    setupSearch();

    setupFilters();

    setupModal();

    setupConnectionStatus();

    initializeFirebaseSync();

});


/* =========================================================
   SPLASH
========================================================= */

function setupSplash() {

    const splash = document.getElementById("splashScreen");

    if (!splash) {
        return;
    }

    const hideSplash = () => {

        splash.classList.add("hidden");

        setTimeout(() => {
            splash.remove();
        }, 450);

    };

    /*
     * Do not keep the user stuck on the splash screen.
     * Wait for Firebase initialization for a short period,
     * but always release the screen.
     */

    const minimumDisplayTime = 650;

    setTimeout(hideSplash, minimumDisplayTime);

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    document.querySelectorAll("[data-view]").forEach(button => {

        button.addEventListener("click", () => {

            const view = button.dataset.view;

            if (view) {
                switchView(view);
            }

        });

    });

}


function switchView(viewName) {

    const allowedViews = [
        "home",
        "leaderboard",
        "updates",
        "programmes",
        "candidates",
        "results"
    ];

    if (!allowedViews.includes(viewName)) {
        viewName = "home";
    }

    appState.currentView = viewName;

    document.querySelectorAll(".page-view").forEach(view => {

        view.classList.remove("active-view");

    });

    const target = document.getElementById(
        `view-${viewName}`
    );

    if (target) {
        target.classList.add("active-view");
    }


    document.querySelectorAll(".nav-item").forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.view === viewName
        );

    });


    /*
     * Re-render only the relevant view.
     * This avoids unnecessary complete page rendering.
     */

    renderCurrentView();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

    const candidateSearch =
        document.getElementById("candidateSearch");

    const updateSearch =
        document.getElementById("updateSearch");

    const resultSearch =
        document.getElementById("resultSearch");


    if (candidateSearch) {

        candidateSearch.addEventListener(
            "input",
            debounce(event => {

                appState.candidateSearch =
                    normalizeText(event.target.value);

                renderCandidates();

            }, 120)
        );

    }


    if (updateSearch) {

        updateSearch.addEventListener(
            "input",
            debounce(event => {

                appState.updateSearch =
                    normalizeText(event.target.value);

                renderUpdates();

            }, 120)
        );

    }


    if (resultSearch) {

        resultSearch.addEventListener(
            "input",
            debounce(event => {

                appState.resultSearch =
                    normalizeText(event.target.value);

                renderResults();

            }, 120)
        );

    }

}


/* =========================================================
   FILTERS
========================================================= */

function setupFilters() {

    document.querySelectorAll(
        "[data-category-filter]"
    ).forEach(button => {

        button.addEventListener("click", () => {

            appState.candidateCategory =
                button.dataset.categoryFilter || "all";

            setActiveFilter(
                "[data-category-filter]",
                button
            );

            renderCandidates();

        });

    });


    document.querySelectorAll(
        "[data-programme-filter]"
    ).forEach(button => {

        button.addEventListener("click", () => {

            appState.programmeFilter =
                button.dataset.programmeFilter || "all";

            setActiveFilter(
                "[data-programme-filter]",
                button
            );

            renderProgrammes();

        });

    });


    document.querySelectorAll(
        "[data-result-filter]"
    ).forEach(button => {

        button.addEventListener("click", () => {

            appState.resultFilter =
                button.dataset.resultFilter || "all";

            setActiveFilter(
                "[data-result-filter]",
                button
            );

            renderResults();

        });

    });

}


function setActiveFilter(selector, activeButton) {

    document.querySelectorAll(selector).forEach(button => {

        button.classList.toggle(
            "active",
            button === activeButton
        );

    });

}


/* =========================================================
   FIREBASE REALTIME SYNC
========================================================= */

function initializeFirebaseSync() {

    if (
        typeof firebase === "undefined" ||
        typeof db === "undefined"
    ) {

        console.error(
            "Firebase / Firestore is not initialized."
        );

        showConnectionError();

        return;
    }


    if (appState.listenersStarted) {
        return;
    }

    appState.listenersStarted = true;


    /*
     * Each dataset remains a single Firestore document
     * to remain compatible with the existing project structure.
     *
     * Public users only READ.
     * Admin writes are protected by Firestore Rules.
     */

    attachPublicListener(
        "teams",
        "festTeams"
    );

    attachPublicListener(
        "candidates",
        "festCandidates"
    );

    attachPublicListener(
        "programmes",
        "festProgrammes"
    );

    attachPublicListener(
        "results",
        "festResults"
    );

    attachPublicListener(
        "updates",
        "festUpdates"
    );

    attachPublicListener(
        "gallery",
        "festGallery"
    );

}


/* =========================================================
   SINGLE PUBLIC LISTENER
========================================================= */

function attachPublicListener(
    cacheKey,
    documentName
) {

    const ref = db
        .collection("festData")
        .doc(documentName);


    const unsubscribe = ref.onSnapshot(
        {
            includeMetadataChanges: true
        },

        snapshot => {

            const data = snapshot.exists
                ? snapshot.data()
                : {};

            const items = Array.isArray(data.items)
                ? data.items
                : [];


            festCache[cacheKey] = items;

            appState.dataReady[cacheKey] = true;


            if (
                !snapshot.metadata.fromCache
            ) {

                appState.lastServerUpdate =
                    new Date();

            }


            updateConnectionStatus(
                snapshot.metadata.fromCache
            );


            /*
             * Recalculate team points from published results
             * whenever teams or results change.
             */

            if (
                cacheKey === "teams" ||
                cacheKey === "results"
            ) {
                syncCalculatedTeamPoints();
            }


            updateStats();

            renderCurrentView();

            updateLastUpdated();

            updateNotificationBadge();

        },

        error => {

            console.error(
                `Firestore listener error (${documentName}):`,
                error
            );

            handleFirestoreError(error);

        }
    );


    publicListeners.push(unsubscribe);

}


/* =========================================================
   CONNECTION STATUS
========================================================= */

function setupConnectionStatus() {

    window.addEventListener(
        "online",
        () => {
            updateConnectionStatus(false);
        }
    );


    window.addEventListener(
        "offline",
        () => {
            updateConnectionStatus(true);
        }
    );


    updateConnectionStatus(
        !navigator.onLine
    );

}


function updateConnectionStatus(isOffline) {

    const box =
        document.getElementById("connectionStatus");

    const text =
        document.getElementById("connectionText");


    if (!box || !text) {
        return;
    }


    if (isOffline) {

        box.classList.add("offline");

        text.textContent = "Offline";

    } else {

        box.classList.remove("offline");

        text.textContent = "Online";

    }

}


function showConnectionError() {

    updateConnectionStatus(true);

}


/* =========================================================
   FIRESTORE ERROR HANDLER
========================================================= */

function handleFirestoreError(error) {

    updateConnectionStatus(true);

    console.error(error);

}


/* =========================================================
   CURRENT VIEW RENDER
========================================================= */

function renderCurrentView() {

    switch (appState.currentView) {

        case "home":
            renderHome();
            break;

        case "leaderboard":
            renderLeaderboard();
            break;

        case "updates":
            renderUpdates();
            break;

        case "programmes":
            renderProgrammes();
            break;

        case "candidates":
            renderCandidates();
            break;

        case "results":
            renderResults();
            break;

        default:
            renderHome();
    }

}


/* =========================================================
   HOME
========================================================= */

function renderHome() {

    renderHomeLeaderboard();

    renderHomeUpdates();

    renderGallery();

    updateStats();

}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

    setText(
        "teamCount",
        festCache.teams.length
    );

    setText(
        "programmeCount",
        festCache.programmes.length
    );

    setText(
        "candidateCount",
        festCache.candidates.length
    );

    setText(
        "resultCount",
        festCache.results.length
    );

}


/* =========================================================
   TEAM POINT CALCULATION
========================================================= */

/*
 * IMPORTANT:
 *
 * Team points are NOT trusted from the public UI.
 *
 * They are calculated from:
 *
 * Individual:
 * programme place points + grade points
 *
 * Group:
 * programme place points + grade points
 *
 * Group points NEVER enter candidate individual points.
 */

function calculateTeamScores() {

    const scores = {};

    festCache.teams.forEach(team => {

        const teamId =
            getTeamId(team);

        if (teamId) {
            scores[teamId] = 0;
        }

    });


    festCache.results.forEach(result => {

        const programme =
            findProgrammeByResult(result);

        if (!programme) {
            return;
        }


        const eventType =
            normalizeEventType(
                programme.eventType ||
                result.eventType
            );


        const places =
            getResultPlaces(result);


        places.forEach(place => {

            const teamId =
                resolveResultTeamId(
                    place,
                    result
                );

            if (!teamId) {
                return;
            }


            const placePoints =
                getProgrammePlacePoints(
                    programme,
                    place.place
                );


            const gradePoints =
                getGradePoints(
                    place.grade
                );


            /*
             * Both Individual and Group results
             * contribute to the TEAM.
             */

            let earned =
                placePoints + gradePoints;


            /*
             * Explicitly keep Group as team-only.
             * This calculation is for team score,
             * so group points remain here.
             */

            if (eventType === "group") {

                earned =
                    placePoints + gradePoints;

            }


            scores[teamId] =
                (scores[teamId] || 0) + earned;

        });

    });


    return scores;

}


/* =========================================================
   SYNC CALCULATED TEAM POINTS
========================================================= */

function syncCalculatedTeamPoints() {

    const scores =
        calculateTeamScores();


    festCache.teams =
        festCache.teams.map(team => {

            const id =
                getTeamId(team);

            return {
                ...team,
                points:
                    Number(scores[id] || 0)
            };

        });

}


/* =========================================================
   TEAM ID
========================================================= */

function getTeamId(team) {

    if (!team) {
        return "";
    }

    return String(
        team.id ||
        team.teamId ||
        slugify(team.name)
    );

}


/* =========================================================
   TEAM FINDER
========================================================= */

function findTeamById(teamId) {

    if (!teamId) {
        return null;
    }

    return (
        festCache.teams.find(
            team =>
                String(getTeamId(team)) ===
                String(teamId)
        ) || null
    );

}


function findTeamByName(name) {

    const normalized =
        normalizeText(name);

    if (!normalized) {
        return null;
    }

    return (
        festCache.teams.find(
            team =>
                normalizeText(team.name) ===
                normalized
        ) || null
    );

}


/* =========================================================
   PROGRAMME FINDER
========================================================= */

function findProgrammeById(programmeId) {

    if (!programmeId) {
        return null;
    }

    return (
        festCache.programmes.find(
            programme =>
                String(
                    programme.id ||
                    programme.programmeId
                ) === String(programmeId)
        ) || null
    );

}


function findProgrammeByResult(result) {

    if (!result) {
        return null;
    }


    /*
     * New structure:
     * result.programmeId
     */

    if (result.programmeId) {

        const programme =
            findProgrammeById(
                result.programmeId
            );

        if (programme) {
            return programme;
        }

    }


    /*
     * Backward compatibility with older data.
     */

    const resultTitle =
        normalizeText(
            result.programmeTitle ||
            result.programme
        );

    const resultCategory =
        normalizeText(
            result.category
        );


    return (
        festCache.programmes.find(
            programme => {

                const title =
                    normalizeText(
                        programme.title
                    );

                const category =
                    normalizeText(
                        programme.category
                    );

                return (
                    title === resultTitle &&
                    (
                        !resultCategory ||
                        category === resultCategory
                    )
                );

            }
        ) || null
    );

}


/* =========================================================
   EVENT TYPE
========================================================= */

function normalizeEventType(value) {

    const type =
        normalizeText(value);

    if (
        type === "group" ||
        type === "team" ||
        type === "group event"
    ) {
        return "group";
    }

    return "individual";

}


/* =========================================================
   PROGRAMME PLACE POINTS
========================================================= */

function getProgrammePlacePoints(
    programme,
    place
) {

    if (!programme) {
        return 0;
    }


    const placeNumber =
        Number(place);


    if (
        !Number.isInteger(placeNumber) ||
        placeNumber < 1
    ) {
        return 0;
    }


    /*
     * Preferred new structure:
     *
     * placePoints: {
     *   first: number,
     *   second: number,
     *   third: number
     * }
     */

    const pointObject =
        programme.placePoints ||
        programme.points ||
        {};


    if (placeNumber === 1) {

        return toNumber(
            pointObject.first ??
            pointObject.firstPlace ??
            programme.firstPoints,
            0
        );

    }


    if (placeNumber === 2) {

        return toNumber(
            pointObject.second ??
            pointObject.secondPlace ??
            programme.secondPoints,
            0
        );

    }


    if (placeNumber === 3) {

        return toNumber(
            pointObject.third ??
            pointObject.thirdPlace ??
            programme.thirdPoints,
            0
        );

    }


    return 0;

}


/* =========================================================
   GRADE POINTS
========================================================= */

function getGradePoints(grade) {

    const normalized =
        String(grade || "")
            .trim()
            .toUpperCase();

    return (
        GRADE_POINTS[normalized] || 0
    );

}


/* =========================================================
   RESULT PLACES
========================================================= */

function getResultPlaces(result) {

    if (!result) {
        return [];
    }


    /*
     * Preferred structure:
     *
     * places: [
     *   {
     *     place: 1,
     *     candidateId,
     *     chestNumber,
     *     candidateName,
     *     teamId,
     *     teamName,
     *     grade
     *   }
     * ]
     */

    if (Array.isArray(result.places)) {

        return result.places
            .filter(Boolean)
            .map(place => ({
                ...place,
                place:
                    Number(place.place) || 0
            }))
            .filter(
                place =>
                    place.place >= 1
            );

    }


    /*
     * Backward compatibility with
     * p1 / p2 / p3 data.
     */

    const legacyPlaces = [];

    const p1 =
        normalizeLegacyPlace(
            result.p1,
            result.p1Val,
            1,
            result
        );

    const p2 =
        normalizeLegacyPlace(
            result.p2,
            result.p2Val,
            2,
            result
        );

    const p3 =
        normalizeLegacyPlace(
            result.p3,
            result.p3Val,
            3,
            result
        );


    if (p1) {
        legacyPlaces.push(p1);
    }

    if (p2) {
        legacyPlaces.push(p2);
    }

    if (p3) {
        legacyPlaces.push(p3);
    }


    return legacyPlaces;

}


/* =========================================================
   LEGACY RESULT NORMALIZATION
========================================================= */

function normalizeLegacyPlace(
    candidate,
    points,
    place,
    result
) {

    if (!candidate) {
        return null;
    }


    if (
        typeof candidate === "string"
    ) {

        return {
            place,
            candidateName: candidate,
            teamName:
                result.teamName || "",
            points:
                toNumber(points, 0),
            grade:
                result[`p${place}Grade`] ||
                ""
        };

    }


    return {
        ...candidate,
        place,
        points:
            toNumber(
                candidate.points ??
                points,
                0
            )
    };

}


/* =========================================================
   RESOLVE RESULT TEAM
========================================================= */

function resolveResultTeamId(
    place,
    result
) {

    if (!place) {
        return "";
    }


    if (place.teamId) {

        const team =
            findTeamById(
                place.teamId
            );

        if (team) {
            return getTeamId(team);
        }

    }


    if (place.teamName) {

        const team =
            findTeamByName(
                place.teamName
            );

        if (team) {
            return getTeamId(team);
        }

    }


    if (place.candidateId) {

        const candidate =
            findCandidateById(
                place.candidateId
            );

        if (candidate) {

            return getCandidateTeamId(
                candidate
            );

        }

    }


    if (place.chestNumber) {

        const candidate =
            findCandidateByChest(
                place.chestNumber
            );

        if (candidate) {

            return getCandidateTeamId(
                candidate
            );

        }

    }


    /*
     * Legacy result-level team.
     */

    if (result && result.teamId) {

        const team =
            findTeamById(
                result.teamId
            );

        if (team) {
            return getTeamId(team);
        }

    }


    if (result && result.teamName) {

        const team =
            findTeamByName(
                result.teamName
            );

        if (team) {
            return getTeamId(team);
        }

    }


    return "";

}


/* =========================================================
   CANDIDATE HELPERS
========================================================= */

function getCandidateId(candidate) {

    if (!candidate) {
        return "";
    }

    return String(
        candidate.id ||
        candidate.candidateId ||
        ""
    );

}


function getCandidateTeamId(candidate) {

    if (!candidate) {
        return "";
    }


    if (candidate.teamId) {

        const team =
            findTeamById(
                candidate.teamId
            );

        if (team) {
            return getTeamId(team);
        }

    }


    if (candidate.group) {

        const team =
            findTeamByName(
                candidate.group
            );

        if (team) {
            return getTeamId(team);
        }

    }


    if (candidate.teamName) {

        const team =
            findTeamByName(
                candidate.teamName
            );

        if (team) {
            return getTeamId(team);
        }

    }


    return "";

}


function findCandidateById(candidateId) {

    if (!candidateId) {
        return null;
    }

    return (
        festCache.candidates.find(
            candidate =>
                String(
                    getCandidateId(candidate)
                ) === String(candidateId)
        ) || null
    );

}


function findCandidateByChest(chestNumber) {

    const chest =
        normalizeChestNumber(
            chestNumber
        );

    if (!chest) {
        return null;
    }

    return (
        festCache.candidates.find(
            candidate =>
                normalizeChestNumber(
                    candidate.chestNumber ||
                    candidate.chest ||
                    candidate.number
                ) === chest
        ) || null
    );

}


/* =========================================================
   CANDIDATE POINT CALCULATION
========================================================= */

function calculateCandidatePoints(
    candidateId
) {

    const candidate =
        findCandidateById(
            candidateId
        );


    if (!candidate) {
        return 0;
    }


    let total = 0;


    festCache.results.forEach(result => {

        const programme =
            findProgrammeByResult(
                result
            );


        if (!programme) {
            return;
        }


        const eventType =
            normalizeEventType(
                programme.eventType ||
                result.eventType
            );


        /*
         * GROUP RESULTS NEVER contribute
         * to individual candidate points.
         *
         * This also means Group Grade points
         * do NOT enter the candidate total.
         */

        if (eventType === "group") {
            return;
        }


        const places =
            getResultPlaces(result);


        places.forEach(place => {

            let matched = false;


            if (
                place.candidateId &&
                String(place.candidateId) ===
                String(candidateId)
            ) {
                matched = true;
            }


            if (
                !matched &&
                place.chestNumber &&
                normalizeChestNumber(
                    place.chestNumber
                ) ===
                normalizeChestNumber(
                    candidate.chestNumber
                )
            ) {
                matched = true;
            }


            if (
                !matched &&
                place.candidateName &&
                normalizeText(
                    place.candidateName
                ) ===
                normalizeText(
                    candidate.name
                )
            ) {

                /*
                 * Name-only fallback is used only
                 * for legacy result records.
                 */

                matched = true;
            }


            if (!matched) {
                return;
            }


            const programmePoints =
                getProgrammePlacePoints(
                    programme,
                    place.place
                );


            const gradePoints =
                getGradePoints(
                    place.grade
                );


            total +=
                programmePoints +
                gradePoints;

        });

    });


    return total;

}


/* =========================================================
   CANDIDATE ACHIEVEMENTS
========================================================= */

function getCandidateAchievements(
    candidate
) {

    if (!candidate) {
        return [];
    }


    const candidateId =
        getCandidateId(candidate);


    const achievements = [];


    festCache.results.forEach(result => {

        const programme =
            findProgrammeByResult(
                result
            );


        if (!programme) {
            return;
        }


        const eventType =
            normalizeEventType(
                programme.eventType ||
                result.eventType
            );


        /*
         * Group results are team-only.
         * Do not show them as individual achievements.
         */

        if (eventType === "group") {
            return;
        }


        const places =
            getResultPlaces(result);


        places.forEach(place => {

            let matched = false;


            if (
                place.candidateId &&
                String(place.candidateId) ===
                String(candidateId)
            ) {
                matched = true;
            }


            if (
                !matched &&
                place.chestNumber &&
                normalizeChestNumber(
                    place.chestNumber
                ) ===
                normalizeChestNumber(
                    candidate.chestNumber
                )
            ) {
                matched = true;
            }


            if (!matched) {
                return;
            }


            const programmePoints =
                getProgrammePlacePoints(
                    programme,
                    place.place
                );


            const gradePoints =
                getGradePoints(
                    place.grade
                );


            achievements.push({
                programmeId:
                    programme.id ||
                    programme.programmeId ||
                    "",

                programmeTitle:
                    programme.title ||
                    "Programme",

                category:
                    programme.category ||
                    "",

                place:
                    Number(place.place) || 0,

                grade:
                    String(place.grade || "")
                        .toUpperCase(),

                programmePoints,

                gradePoints,

                totalPoints:
                    programmePoints +
                    gradePoints
            });

        });

    });


    return achievements.sort(
        (a, b) =>
            a.place - b.place
    );

}


/* =========================================================
   LEADERBOARD
========================================================= */

function getSortedTeams() {

    return [
        ...festCache.teams
    ].sort((a, b) => {

        const pointsA =
            toNumber(a.points, 0);

        const pointsB =
            toNumber(b.points, 0);

        if (pointsB !== pointsA) {
            return pointsB - pointsA;
        }

        return String(
            a.name || ""
        ).localeCompare(
            String(b.name || "")
        );

    });

}


function renderHomeLeaderboard() {

    const container =
        document.getElementById(
            "homeLeaderboard"
        );

    if (!container) {
        return;
    }


    const teams =
        getSortedTeams();


    if (!teams.length) {

        container.innerHTML =
            emptyState(
                "No team data available yet."
            );

        return;
    }


    container.innerHTML =
        teams
            .map(
                (team, index) =>
                    createLeaderboardItem(
                        team,
                        index
                    )
            )
            .join("");

}


function renderLeaderboard() {

    const container =
        document.getElementById(
            "leaderboardFull"
        );

    if (!container) {
        return;
    }


    const teams =
        getSortedTeams();


    if (!teams.length) {

        container.innerHTML =
            emptyState(
                "No team data available yet."
            );

        return;
    }


    container.innerHTML =
        teams
            .map(
                (team, index) =>
                    createLeaderboardItem(
                        team,
                        index
                    )
            )
            .join("");


    updateTopTeam();

}


function createLeaderboardItem(
    team,
    index
) {

    const rank =
        index + 1;

    const points =
        toNumber(
            team.points,
            0
        );


    let rankClass = "";

    if (rank === 1) {
        rankClass = "rank-one";
    } else if (rank === 2) {
        rankClass = "rank-two";
    } else if (rank === 3) {
        rankClass = "rank-three";
    }


    return `
        <div class="leaderboard-item ${rankClass}">

            <div class="leaderboard-rank">
                ${rank}
            </div>

            <div class="leaderboard-team">

                <strong>
                    ${escapeHTML(
                        team.name || "Team"
                    )}
                </strong>

                <span>
                    Team
                </span>

            </div>

            <div class="leaderboard-points">

                <strong>
                    ${points}
                </strong>

                <span>
                    points
                </span>

            </div>

        </div>
    `;

}


function updateTopTeam() {

    /*
     * The existing public layout does not require
     * a separate top-team card.
     *
     * Keep this function for compatibility.
     */

}


/* =========================================================
   UPDATES
========================================================= */

function renderHomeUpdates() {

    const container =
        document.getElementById(
            "homeUpdates"
        );

    if (!container) {
        return;
    }


    const updates =
        getSortedUpdates()
            .slice(0, 3);


    if (!updates.length) {

        container.innerHTML =
            emptyState(
                "No updates published yet."
            );

        return;
    }


    container.innerHTML =
        updates
            .map(
                createUpdateCard
            )
            .join("");

}


function renderUpdates() {

    const container =
        document.getElementById(
            "updatesContainer"
        );

    if (!container) {
        return;
    }


    const search =
        appState.updateSearch;


    let updates =
        getSortedUpdates();


    if (search) {

        updates =
            updates.filter(update => {

                const text =
                    normalizeText(
                        [
                            update.title,
                            update.description,
                            update.type
                        ].join(" ")
                    );

                return text.includes(search);

            });

    }


    if (!updates.length) {

        container.innerHTML =
            emptyState(
                "No matching updates found."
            );

        return;
    }


    container.innerHTML =
        updates
            .map(
                createUpdateCard
            )
            .join("");

}


function getSortedUpdates() {

    return [
        ...festCache.updates
    ].sort((a, b) => {

        const importantA =
            a.important ? 1 : 0;

        const importantB =
            b.important ? 1 : 0;


        if (importantA !== importantB) {
            return importantB - importantA;
        }


        const timeA =
            toDateValue(
                a.createdAt ||
                a.time
            );

        const timeB =
            toDateValue(
                b.createdAt ||
                b.time
            );


        return timeB - timeA;

    });

}


function createUpdateCard(update) {

    return `
        <article
            class="update-card ${
                update.important
                    ? "important"
                    : ""
            }"
        >

            <div class="update-top">

                <h3 class="update-title">
                    ${escapeHTML(
                        update.title ||
                        "Update"
                    )}
                </h3>

            </div>

            <p class="update-description">
                ${escapeHTML(
                    update.description ||
                    ""
                )}
            </p>

            <div class="update-meta">

                ${
                    update.type
                        ? `
                            <span class="update-type">
                                ${escapeHTML(
                                    update.type
                                )}
                            </span>
                          `
                        : ""
                }

                <span class="update-time">
                    ${escapeHTML(
                        formatDate(
                            update.createdAt ||
                            update.time
                        )
                    )}
                </span>

            </div>

        </article>
    `;

}


/* =========================================================
   PROGRAMMES
========================================================= */

function renderProgrammes() {

    const container =
        document.getElementById(
            "programmesContainer"
        );

    if (!container) {
        return;
    }


    let programmes =
        [...festCache.programmes];


    if (
        appState.programmeFilter !==
        "all"
    ) {

        programmes =
            programmes.filter(
                programme =>
                    normalizeEventType(
                        programme.eventType
                    ) ===
                    appState.programmeFilter
            );

    }


    programmes.sort(
        sortProgrammes
    );


    if (!programmes.length) {

        container.innerHTML =
            emptyState(
                "No programmes available."
            );

        return;
    }


    container.innerHTML =
        programmes
            .map(
                createProgrammeCard
            )
            .join("");

}


function sortProgrammes(a, b) {

    const timeA =
        toDateValue(
            a.time ||
            a.date
        );

    const timeB =
        toDateValue(
            b.time ||
            b.date
        );


    if (
        timeA &&
        timeB &&
        timeA !== timeB
    ) {
        return timeA - timeB;
    }


    return String(
        a.title || ""
    ).localeCompare(
        String(b.title || "")
    );

}


function createProgrammeCard(
    programme
) {

    const eventType =
        normalizeEventType(
            programme.eventType
        );


    const status =
        String(
            programme.status ||
            "Scheduled"
        );


    const placePoints =
        programme.placePoints ||
        programme.points ||
        {};


    return `
        <article class="programme-card">

            <div class="programme-top">

                <div>
                    <h3 class="programme-title">
                        ${escapeHTML(
                            programme.title ||
                            "Programme"
                        )}
                    </h3>
                </div>

                <span class="programme-category">
                    ${escapeHTML(
                        programme.category ||
                        "General"
                    )}
                </span>

            </div>


            <div class="programme-details">

                <div class="programme-detail">

                    <span class="material-icon">
                        groups
                    </span>

                    <span>
                        ${
                            eventType === "group"
                                ? "Group"
                                : "Individual"
                        }
                    </span>

                </div>


                <div class="programme-detail">

                    <span class="material-icon">
                        location_on
                    </span>

                    <span>
                        ${escapeHTML(
                            programme.venue ||
                            "Venue not set"
                        )}
                    </span>

                </div>


                <div class="programme-detail">

                    <span class="material-icon">
                        schedule
                    </span>

                    <span>
                        ${escapeHTML(
                            programme.time ||
                            "Time not set"
                        )}
                    </span>

                </div>


                <div class="programme-detail">

                    <span class="material-icon">
                        emoji_events
                    </span>

                    <span>
                        1st:
                        ${toNumber(
                            placePoints.first ??
                            placePoints.firstPlace ??
                            programme.firstPoints,
                            0
                        )}
                    </span>

                </div>

            </div>


            <span
                class="programme-status ${
                    normalizeText(status) ===
                    "scheduled"
                        ? ""
                        : "pending"
                }"
            >
                ${escapeHTML(status)}
            </span>

        </article>
    `;

}


/* =========================================================
   CANDIDATES
========================================================= */

function renderCandidates() {

    const container =
        document.getElementById(
            "candidatesContainer"
        );

    if (!container) {
        return;
    }


    const search =
        appState.candidateSearch;


    let candidates =
        [...festCache.candidates];


    if (
        appState.candidateCategory !==
        "all"
    ) {

        candidates =
            candidates.filter(
                candidate =>
                    normalizeText(
                        candidate.category
                    ) ===
                    normalizeText(
                        appState.candidateCategory
                    )
            );

    }


    if (search) {

        candidates =
            candidates.filter(
                candidate => {

                    const text =
                        normalizeText(
                            [
                                candidate.name,
                                candidate.chestNumber,
                                candidate.chest,
                                candidate.teamName,
                                candidate.group,
                                candidate.category
                            ].join(" ")
                        );

                    return text.includes(search);

                }
            );

    }


    candidates.sort(
        sortCandidates
    );


    if (!candidates.length) {

        container.innerHTML =
            emptyState(
                search
                    ? "No matching candidates found."
                    : "No candidates registered yet."
            );

        return;
    }


    container.innerHTML =
        candidates
            .map(
                createCandidateCard
            )
            .join("");


    container
        .querySelectorAll(
            "[data-candidate-id]"
        )
        .forEach(card => {

            card.addEventListener(
                "click",
                () => {

                    openCandidatePosterModal(
                        card.dataset.candidateId
                    );

                }
            );

        });

}


function sortCandidates(a, b) {

    const chestA =
        parseInt(
            a.chestNumber ||
            a.chest ||
            a.number ||
            "999999",
            10
        );

    const chestB =
        parseInt(
            b.chestNumber ||
            b.chest ||
            b.number ||
            "999999",
            10
        );


    if (
        !Number.isNaN(chestA) &&
        !Number.isNaN(chestB) &&
        chestA !== chestB
    ) {
        return chestA - chestB;
    }


    return String(
        a.name || ""
    ).localeCompare(
        String(b.name || "")
    );

}


function createCandidateCard(
    candidate
) {

    const name =
        candidate.name ||
        "Candidate";


    const chest =
        candidate.chestNumber ||
        candidate.chest ||
        "—";


    const team =
        getCandidateTeamName(
            candidate
        );


    const category =
        candidate.category ||
        "General";


    const firstLetter =
        name
            .trim()
            .charAt(0)
            .toUpperCase();


    return `
        <article
            class="candidate-card"
            data-candidate-id="${escapeAttribute(
                getCandidateId(candidate)
            )}"
        >

            <div class="candidate-card-top">

                <div class="candidate-avatar">
                    ${escapeHTML(
                        firstLetter || "?"
                    )}
                </div>


                <div class="candidate-name">

                    <strong>
                        ${escapeHTML(name)}
                    </strong>

                    <span>
                        Chest No: ${escapeHTML(
                            chest
                        )}
                    </span>

                </div>

            </div>


            <div class="candidate-meta">

                <span class="candidate-team">
                    ${escapeHTML(
                        team || "Team not assigned"
                    )}
                </span>

                <span class="candidate-badge">
                    ${escapeHTML(category)}
                </span>

            </div>

        </article>
    `;

}


function getCandidateTeamName(
    candidate
) {

    const teamId =
        getCandidateTeamId(
            candidate
        );


    if (teamId) {

        const team =
            findTeamById(
                teamId
            );

        if (team) {
            return team.name;
        }

    }


    return (
        candidate.teamName ||
        candidate.group ||
        ""
    );

}


/* =========================================================
   RESULTS
========================================================= */

function renderResults() {

    const container =
        document.getElementById(
            "resultsContainer"
        );

    if (!container) {
        return;
    }


    let results =
        [...festCache.results];


    if (
        appState.resultFilter !==
        "all"
    ) {

        results =
            results.filter(
                result => {

                    const programme =
                        findProgrammeByResult(
                            result
                        );

                    const eventType =
                        normalizeEventType(
                            programme?.eventType ||
                            result.eventType
                        );

                    return (
                        eventType ===
                        appState.resultFilter
                    );

                }
            );

    }


    const search =
        appState.resultSearch;


    if (search) {

        results =
            results.filter(
                result =>
                    resultMatchesSearch(
                        result,
                        search
                    )
            );

    }


    results.sort(
        sortResults
    );


    if (!results.length) {

        container.innerHTML =
            emptyState(
                search
                    ? "No matching results found."
                    : "No results published yet."
            );

        return;
    }


    container.innerHTML =
        results
            .map(
                createResultCard
            )
            .join("");

}


function resultMatchesSearch(
    result,
    search
) {

    const programme =
        findProgrammeByResult(
            result
        );


    const places =
        getResultPlaces(
            result
        );


    const searchable =
        [
            programme?.title,
            programme?.category,
            result.programmeTitle,
            result.category,
            result.eventType,
            ...places.map(
                place =>
                    [
                        place.candidateName,
                        place.chestNumber,
                        place.teamName
                    ].join(" ")
            )
        ]
            .join(" ");


    return normalizeText(
        searchable
    ).includes(search);

}


function sortResults(a, b) {

    const programmeA =
        findProgrammeByResult(a);

    const programmeB =
        findProgrammeByResult(b);


    return String(
        programmeA?.title ||
        a.programmeTitle ||
        ""
    ).localeCompare(
        String(
            programmeB?.title ||
            b.programmeTitle ||
            ""
        )
    );

}


function createResultCard(
    result
) {

    const programme =
        findProgrammeByResult(
            result
        );


    const eventType =
        normalizeEventType(
            programme?.eventType ||
            result.eventType
        );


    const places =
        getResultPlaces(
            result
        ).sort(
            (a, b) =>
                Number(a.place || 0) -
                Number(b.place || 0)
        );


    const title =
        programme?.title ||
        result.programmeTitle ||
        "Programme";


    const category =
        programme?.category ||
        result.category ||
        "General";


    return `
        <article class="result-card">

            <div class="result-card-header">

                <div class="result-programme">

                    <h3>
                        ${escapeHTML(title)}
                    </h3>

                    <p>
                        ${escapeHTML(category)}
                    </p>

                </div>

                <span class="result-event-type">
                    ${
                        eventType === "group"
                            ? "Group"
                            : "Individual"
                    }
                </span>

            </div>


            <div class="result-place-list">

                ${
                    places.length
                        ? places
                            .map(
                                place =>
                                    createResultPlace(
                                        place,
                                        programme
                                    )
                            )
                            .join("")
                        : `
                            <div class="empty-state">
                                No published places.
                            </div>
                          `
                }

            </div>

        </article>
    `;

}


function createResultPlace(
    place,
    programme
) {

    const placeNumber =
        Number(place.place || 0);


    const placeClass =
        placeNumber === 1
            ? "first"
            : placeNumber === 2
                ? "second"
                : placeNumber === 3
                    ? "third"
                    : "";


    const candidate =
        place.candidateId
            ? findCandidateById(
                place.candidateId
            )
            : findCandidateByChest(
                place.chestNumber
            );


    const candidateName =
        candidate?.name ||
        place.candidateName ||
        "Candidate";


    const chest =
        candidate?.chestNumber ||
        place.chestNumber ||
        "—";


    const teamName =
        candidate
            ? getCandidateTeamName(candidate)
            : (
                place.teamName ||
                ""
            );


    const programmePoints =
        getProgrammePlacePoints(
            programme,
            placeNumber
        );


    const gradePoints =
        getGradePoints(
            place.grade
        );


    const total =
        programmePoints +
        gradePoints;


    return `
        <div
            class="result-place ${placeClass}"
        >

            <div class="place-number">
                ${placeNumber || "—"}
            </div>


            <div class="result-candidate">

                <strong>
                    ${escapeHTML(
                        candidateName
                    )}
                </strong>

                <span>
                    Chest ${escapeHTML(
                        chest
                    )}
                    ${
                        teamName
                            ? ` · ${escapeHTML(
                                teamName
                              )}`
                            : ""
                    }
                    ${
                        place.grade
                            ? ` · Grade ${escapeHTML(
                                String(
                                    place.grade
                                ).toUpperCase()
                              )}`
                            : ""
                    }
                </span>

            </div>


            <div class="result-score">

                <strong>
                    ${total}
                </strong>

                <span>
                    ${
                        programmePoints
                    } + ${
                        gradePoints
                    }
                </span>

            </div>

        </div>
    `;

}


/* =========================================================
   GALLERY
========================================================= */

function renderGallery() {

    const container =
        document.getElementById(
            "galleryGrid"
        );

    if (!container) {
        return;
    }


    const gallery =
        Array.isArray(
            festCache.gallery
        )
            ? festCache.gallery
            : [];


    /*
     * Gallery upload is optional.
     * If there is no uploaded gallery data,
     * retain the static placeholders.
     */

    if (!gallery.length) {
        return;
    }


    container.innerHTML =
        gallery
            .map(
                createGalleryItem
            )
            .join("");

}


function createGalleryItem(
    item
) {

    const url =
        item.url ||
        item.downloadURL ||
        "";


    if (!url) {
        return "";
    }


    const title =
        item.title ||
        item.name ||
        "";


    /*
     * URL is placed in CSS custom property
     * rather than raw HTML style syntax.
     */

    const safeURL =
        escapeCSSURL(
            url
        );


    return `
        <div
            class="gallery-item"
            style="--gallery-image: url('${safeURL}')"
        >
            <div
                class="gallery-image-layer"
                style="
                    position:absolute;
                    inset:0;
                    background-image:var(--gallery-image);
                    background-size:cover;
                    background-position:center;
                "
            ></div>

            ${
                title
                    ? `
                        <div class="gallery-item-overlay">
                            ${escapeHTML(title)}
                        </div>
                      `
                    : ""
            }

        </div>
    `;

}


/* =========================================================
   CANDIDATE MODAL
========================================================= */

function setupModal() {

    const modal =
        document.getElementById(
            "candidateModal"
        );

    if (!modal) {
        return;
    }


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {
                closeCandidateModal();
            }

        }
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeCandidateModal();

            }

        }
    );

}


function openCandidatePosterModal(
    candidateId
) {

    const candidate =
        findCandidateById(
            candidateId
        );


    if (!candidate) {
        return;
    }


    const modal =
        document.getElementById(
            "candidateModal"
        );


    if (!modal) {
        return;
    }


    const name =
        candidate.name ||
        "Candidate";


    const chest =
        candidate.chestNumber ||
        candidate.chest ||
        "—";


    const team =
        getCandidateTeamName(
            candidate
        );


    const category =
        candidate.category ||
        "General";


    const points =
        calculateCandidatePoints(
            getCandidateId(candidate)
        );


    setText(
        "candidateModalTitle",
        name
    );


    setText(
        "modalCandidateChest",
        `Chest No: ${chest}`
    );


    setText(
        "modalCandidateTeam",
        team || "—"
    );


    setText(
        "modalCandidateCategory",
        category
    );


    setText(
        "modalCandidatePoints",
        points
    );


    setText(
        "modalCandidateAvatar",
        name
            .trim()
            .charAt(0)
            .toUpperCase() || "?"
    );


    const achievements =
        getCandidateAchievements(
            candidate
        );


    const achievementContainer =
        document.getElementById(
            "modalCandidateAchievements"
        );


    if (achievementContainer) {

        if (!achievements.length) {

            achievementContainer.innerHTML =
                emptyState(
                    "No published individual results yet."
                );

        } else {

            achievementContainer.innerHTML =
                achievements
                    .map(
                        createAchievementItem
                    )
                    .join("");

        }

    }


    modal.classList.remove(
        "hidden"
    );


    document.body.style.overflow =
        "hidden";

}


function closeCandidateModal() {

    const modal =
        document.getElementById(
            "candidateModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );


    document.body.style.overflow =
        "";

}


function createAchievementItem(
    achievement
) {

    return `
        <div class="achievement-item">

            <div class="achievement-place">
                ${achievement.place}
            </div>

            <div class="achievement-info">

                <strong>
                    ${escapeHTML(
                        achievement.programmeTitle
                    )}
                </strong>

                <span>
                    ${
                        achievement.grade
                            ? `Grade ${escapeHTML(
                                achievement.grade
                              )} · `
                            : ""
                    }

                    ${
                        achievement.programmePoints
                    }
                    programme +

                    ${
                        achievement.gradePoints
                    }
                    grade
                </span>

            </div>

            <div class="achievement-points">
                +${achievement.totalPoints}
            </div>

        </div>
    `;

}


/* =========================================================
   NOTIFICATION BADGE
========================================================= */

function updateNotificationBadge() {

    const badge =
        document.getElementById(
            "notificationBadge"
        );

    if (!badge) {
        return;
    }


    const importantCount =
        festCache.updates.filter(
            update =>
                update.important === true
        ).length;


    if (importantCount <= 0) {

        badge.classList.add(
            "hidden"
        );

        badge.textContent = "0";

        return;
    }


    badge.classList.remove(
        "hidden"
    );


    badge.textContent =
        importantCount > 99
            ? "99+"
            : String(importantCount);

}


/* =========================================================
   LAST UPDATED
========================================================= */

function updateLastUpdated() {

    const element =
        document.getElementById(
            "leaderboardUpdated"
        );


    if (!element) {
        return;
    }


    if (!appState.lastServerUpdate) {

        element.textContent =
            "Live data";

        return;
    }


    element.textContent =
        `Last synced: ${formatDate(
            appState.lastServerUpdate
        )}`;

}


/* =========================================================
   UTILITY FUNCTIONS
========================================================= */

function normalizeText(value) {

    return String(
        value ?? ""
    )
        .trim()
        .toLowerCase();

}


function normalizeChestNumber(
    value
) {

    return String(
        value ?? ""
    )
        .trim()
        .toUpperCase();

}


function toNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;

}


function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );

    if (element) {
        element.textContent =
            String(value ?? "");
    }

}


function emptyState(message) {

    return `
        <div class="empty-state">
            ${escapeHTML(message)}
        </div>
    `;

}


/* =========================================================
   HTML ESCAPING
========================================================= */

function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function escapeAttribute(value) {

    return escapeHTML(value);

}


/* =========================================================
   CSS URL SANITIZATION
========================================================= */

function escapeCSSURL(value) {

    return String(
        value ?? ""
    )
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'")
        .replaceAll("\n", "")
        .replaceAll("\r", "");

}


/* =========================================================
   SLUGIFY
========================================================= */

function slugify(value) {

    return normalizeText(value)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(
            /^-+|-+$/g,
            ""
        );

}


/* =========================================================
   DATE HELPERS
========================================================= */

function toDateValue(value) {

    if (!value) {
        return 0;
    }


    if (
        typeof value === "object" &&
        typeof value.toDate === "function"
    ) {

        const date =
            value.toDate();

        return date.getTime();

    }


    if (
        typeof value === "number"
    ) {

        return value;

    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return 0;

    }


    return date.getTime();

}


function formatDate(value) {

    const timestamp =
        toDateValue(value);


    if (!timestamp) {
        return "Recently";
    }


    const date =
        new Date(timestamp);


    return date.toLocaleString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* =========================================================
   DEBOUNCE
========================================================= */

function debounce(
    callback,
    delay
) {

    let timer = null;


    return function (...args) {

        clearTimeout(timer);


        timer =
            setTimeout(
                () => {

                    callback.apply(
                        this,
                        args
                    );

                },
                delay
            );

    };

}


/* =========================================================
   PUBLIC CLEANUP
========================================================= */

/*
 * Available if the page is ever embedded or
 * the application needs to stop all listeners.
 *
 * Firestore recommends detaching listeners when
 * they are no longer needed.
 */

function stopPublicListeners() {

    while (
        publicListeners.length
    ) {

        const unsubscribe =
            publicListeners.pop();

        try {

            unsubscribe();

        } catch (error) {

            console.warn(
                "Listener cleanup failed:",
                error
            );

        }

    }

}


/* =========================================================
   GLOBAL EXPORTS
========================================================= */

window.switchView =
    switchView;

window.openCandidatePosterModal =
    openCandidatePosterModal;

window.closeCandidateModal =
    closeCandidateModal;

window.stopPublicListeners =
    stopPublicListeners;
