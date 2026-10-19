
/* ==========================================
   ICT251 ACTIVITY 4
   Sports Team Roster & Fixtures CRUD System
   SQLite API frontend
   ========================================== */

"use strict";

let players = [];
let fixtures = [];

const getElement = id => document.getElementById(id);

function showMessage(message, type = "success") {
    const feedback = getElement("form-feedback");

    if (feedback) {
        feedback.textContent = message;
        feedback.className = `feedback ${type}`;
    } else {
        alert(message);
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// All database communication goes through server.js.
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result.error || result.message || `Request failed (${response.status})`
        );
    }

    return result;
}

function showError(error) {
    console.error(error);
    showMessage(error.message || "Something went wrong.", "error");
}

// ==========================================
// PLAYER MANAGEMENT
// ==========================================

async function loadPlayers() {
    players = await apiRequest("/api/players");
    renderPlayers();
}

function renderPlayers() {
    const table = getElement("players-list");
    if (!table) return;

    if (!players.length) {
        table.innerHTML =
            '<tr><td colspan="4">No players found. Add your first player.</td></tr>';
        return;
    }

    table.innerHTML = players.map(player => `
        <tr>
            <td>${escapeHTML(player.number)}</td>
            <td>${escapeHTML(player.name)}</td>
            <td>${escapeHTML(player.position)}</td>
            <td>
                <button type="button"
                    data-action="edit-player"
                    data-id="${escapeHTML(player.id)}">Edit</button>
                <button type="button"
                    data-action="delete-player"
                    data-id="${escapeHTML(player.id)}">Delete</button>
            </td>
        </tr>
    `).join("");
}

async function addPlayer(event) {
    event?.preventDefault();

    const name = getElement("player-name")?.value.trim();
    const position = getElement("player-position")?.value.trim();
    const number = getElement("player-number")?.value.trim();

    if (!name || !position || !number) {
        showMessage("Enter the player's name, position and number.", "error");
        return;
    }

    try {
        const result = await apiRequest("/api/players", {
            method: "POST",
            body: JSON.stringify({ name, position, number })
        });

        await loadPlayers();
        getElement("player-form")?.reset();
        showMessage(result.message || "Player added successfully.");
    } catch (error) {
        showError(error);
    }
}

async function editPlayer(id) {
    const player = players.find(item => String(item.id) === String(id));
    if (!player) return;

    const name = prompt("Player name:", player.name);
    if (name === null) return;

    const position = prompt("Player position:", player.position);
    if (position === null) return;

    const number = prompt("Player number:", player.number);
    if (number === null) return;

    if (!name.trim() || !position.trim() || !number.trim()) {
        showMessage("All player fields are required.", "error");
        return;
    }

    try {
        const result = await apiRequest(`/api/players/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                name: name.trim(),
                position: position.trim(),
                number: number.trim()
            })
        });

        await loadPlayers();
        showMessage(result.message || "Player updated successfully.");
    } catch (error) {
        showError(error);
    }
}

async function deletePlayer(id) {
    const player = players.find(item => String(item.id) === String(id));
    if (!player) return;

    if (!confirm(`Delete ${player.name} from the roster?`)) return;

    try {
        const result = await apiRequest(`/api/players/${id}`, {
            method: "DELETE"
        });

        await loadPlayers();
        showMessage(result.message || "Player deleted successfully.");
    } catch (error) {
        showError(error);
    }
}

// ==========================================
// FIXTURE MANAGEMENT
// ==========================================

async function loadFixtures() {
    fixtures = await apiRequest("/api/fixtures");
    renderFixtures();
}

function renderFixtures() {
    const table = getElement("fixtures-list");
    if (!table) return;

    if (!fixtures.length) {
        table.innerHTML =
            '<tr><td colspan="6">No fixtures found. Add a fixture.</td></tr>';
        return;
    }

    table.innerHTML = fixtures.map(fixture => {
        const score = fixture.status === "Completed"
            ? ` (${fixture.homeScore}–${fixture.awayScore})`
            : "";

        return `
            <tr>
                <td>${escapeHTML(fixture.home)}</td>
                <td>${escapeHTML(fixture.away)}</td>
                <td>${escapeHTML(fixture.date)}</td>
                <td>${escapeHTML(fixture.venue)}</td>
                <td>${escapeHTML(fixture.status + score)}</td>
                <td>
                    <button type="button"
                        data-action="edit-fixture"
                        data-id="${escapeHTML(fixture.id)}">Edit</button>
                    <button type="button"
                        data-action="delete-fixture"
                        data-id="${escapeHTML(fixture.id)}">Delete</button>
                </td>
            </tr>
        `;
    }).join("");
}

async function addFixture(event) {
    event?.preventDefault();

    const home = getElement("home-team")?.value.trim();
    const away = getElement("away-team")?.value.trim();
    const date = getElement("fixture-date")?.value;
    const venue = getElement("fixture-venue")?.value.trim();

    if (!home || !away || !date || !venue) {
        showMessage("Please complete all fixture fields.", "error");
        return;
    }

    if (home.toLowerCase() === away.toLowerCase()) {
        showMessage("A team cannot play against itself.", "error");
        return;
    }

    try {
        const result = await apiRequest("/api/fixtures", {
            method: "POST",
            body: JSON.stringify({ home, away, date, venue })
        });

        await loadFixtures();
        getElement("fixture-form")?.reset();
        showMessage(result.message || "Fixture added successfully.");
    } catch (error) {
        showError(error);
    }
}

async function editFixture(id) {
    const fixture = fixtures.find(item => String(item.id) === String(id));
    if (!fixture) return;

    const enteredStatus = prompt(
        "Status: Upcoming, Completed or Cancelled",
        fixture.status
    );

    if (enteredStatus === null) return;

    const statuses = ["Upcoming", "Completed", "Cancelled"];
    const status = statuses.find(
        item => item.toLowerCase() === enteredStatus.trim().toLowerCase()
    );

    if (!status) {
        showMessage("Enter Upcoming, Completed or Cancelled.", "error");
        return;
    }

    let homeScore = null;
    let awayScore = null;

    if (status === "Completed") {
        const enteredHomeScore = prompt(
            "Home team score:",
            fixture.homeScore ?? ""
        );
        if (enteredHomeScore === null) return;

        const enteredAwayScore = prompt(
            "Away team score:",
            fixture.awayScore ?? ""
        );
        if (enteredAwayScore === null) return;

        if (
            enteredHomeScore.trim() === "" ||
            enteredAwayScore.trim() === "" ||
            !Number.isInteger(Number(enteredHomeScore)) ||
            !Number.isInteger(Number(enteredAwayScore)) ||
            Number(enteredHomeScore) < 0 ||
            Number(enteredAwayScore) < 0
        ) {
            showMessage("Enter valid non-negative whole-number scores.", "error");
            return;
        }

        homeScore = Number(enteredHomeScore);
        awayScore = Number(enteredAwayScore);
    }

    try {
        const result = await apiRequest(`/api/fixtures/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                home: fixture.home,
                away: fixture.away,
                date: fixture.date,
                venue: fixture.venue,
                status,
                homeScore,
                awayScore
            })
        });

        await loadFixtures();
        showMessage(result.message || "Fixture updated successfully.");
    } catch (error) {
        showError(error);
    }
}

async function deleteFixture(id) {
    const fixture = fixtures.find(item => String(item.id) === String(id));
    if (!fixture) return;

    if (!confirm(`Delete ${fixture.home} vs ${fixture.away}?`)) return;

    try {
        const result = await apiRequest(`/api/fixtures/${id}`, {
            method: "DELETE"
        });

        await loadFixtures();
        showMessage(result.message || "Fixture deleted successfully.");
    } catch (error) {
        showError(error);
    }
}

// ==========================================
// BUTTON EVENTS
// ==========================================

document.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const { action, id } = button.dataset;

    switch (action) {
        case "edit-player":
            editPlayer(id);
            break;
        case "delete-player":
            deletePlayer(id);
            break;
        case "edit-fixture":
            editFixture(id);
            break;
        case "delete-fixture":
            deleteFixture(id);
            break;
    }
});

// ==========================================
// INITIALISE APPLICATION
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    getElement("player-form")?.addEventListener("submit", addPlayer);
    getElement("fixture-form")?.addEventListener("submit", addFixture);

    try {
        await Promise.all([loadPlayers(), loadFixtures()]);
        console.log("Sports application connected to SQLite API.");
    } catch (error) {
        console.error("Could not load application data:", error);
        showMessage(
            "Could not load records. Check that the server is running.",
            "error"
        );
    }
});
