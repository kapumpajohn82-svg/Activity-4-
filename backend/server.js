const express = require("express");
const path = require("path");
const db = require("./db.js");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Error response helper
function sendError(res, status, message) {
    return res.status(status).json({ error: message });
}

// Validate record ID
function validId(id) {
    return /^\d+$/.test(String(id)) && Number(id) > 0;
}

// Validate date in YYYY-MM-DD format
function validDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
    }

    const parsed = new Date(date + "T00:00:00Z");

    return !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date;
}

// Convert a database player into an API player
function formatPlayer(row) {
    return {
        id: row.id,
        name: row.player_name,
        position: row.position,
        number: row.jersey_number == null
            ? ""
            : String(row.jersey_number)
    };
}

// Convert a database fixture into an API fixture
function formatFixture(row) {
    return {
        id: row.id,
        home: row.home_team || "Home Team",
        away: row.away_team || row.opponent || "Away Team",
        date: row.match_date || "",
        venue: row.venue || "",
        status: row.status || "Upcoming",
        homeScore: row.home_score ?? "",
        awayScore: row.away_score ?? ""
    };
}

// Validate player details
function readPlayer(body, res) {
    const name = String(body.name || "").trim();
    const position = String(body.position || "").trim();
    const numberText = String(body.number ?? "").trim();
    const number = Number(numberText);

    if (!name || !position || !numberText) {
        sendError(
            res,
            400,
            "Enter the player's name, position and jersey number."
        );
        return null;
    }

    if (!Number.isInteger(number) || number < 1) {
        sendError(
            res,
            400,
            "Jersey number must be a positive whole number."
        );
        return null;
    }

    return { name, position, number };
}

// Validate fixture details
function readFixture(body, res) {
    const home = String(body.home || "").trim();
    const away = String(body.away || "").trim();
    const date = String(body.date || "").trim();
    const venue = String(body.venue || "").trim();
    const status = String(body.status || "Upcoming").trim();

    if (!home || !away || !date || !venue) {
        sendError(
            res,
            400,
            "Enter both teams, the date and the venue."
        );
        return null;
    }

    if (home.toLowerCase() === away.toLowerCase()) {
        sendError(
            res,
            400,
            "Home and away teams must be different."
        );
        return null;
    }

    if (!validDate(date)) {
        sendError(
            res,
            400,
            "Enter a valid date in YYYY-MM-DD format."
        );
        return null;
    }

    if (!["Upcoming", "Completed", "Cancelled"].includes(status)) {
        sendError(
            res,
            400,
            "Status must be Upcoming, Completed or Cancelled."
        );
        return null;
    }

    let homeScore = null;
    let awayScore = null;

    if (status === "Completed") {
        const scoreTextHome = String(body.homeScore ?? "").trim();
        const scoreTextAway = String(body.awayScore ?? "").trim();

        if (scoreTextHome === "" || scoreTextAway === "") {
            sendError(
                res,
                400,
                "Enter both scores for a completed fixture."
            );
            return null;
        }

        homeScore = Number(scoreTextHome);
        awayScore = Number(scoreTextAway);

        if (
            !Number.isInteger(homeScore) ||
            !Number.isInteger(awayScore) ||
            homeScore < 0 ||
            awayScore < 0
        ) {
            sendError(
                res,
                400,
                "Scores must be non-negative whole numbers."
            );
            return null;
        }
    }

    return {
        home,
        away,
        date,
        venue,
        status,
        homeScore,
        awayScore
    };
}

// HEALTH CHECK
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Sports API is running."
    });
});

// ================================
// PLAYERS: READ ALL
// ================================
app.get("/api/players", (req, res) => {
    try {
        const rows = db.prepare(
            "SELECT * FROM sports WHERE record_type = 'player' ORDER BY id DESC"
        ).all();

        res.json(rows.map(formatPlayer));
    } catch (err) {
        console.error("Load players error:", err);
        sendError(res, 500, "Could not load players.");
    }
});

// PLAYERS: READ ONE
app.get("/api/players/:id", (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return sendError(res, 400, "Invalid player ID.");
        }

        const row = db.prepare(
            "SELECT * FROM sports WHERE id = ? AND record_type = 'player'"
        ).get(Number(req.params.id));

        if (!row) {
            return sendError(res, 404, "Player not found.");
        }

        res.json(formatPlayer(row));
    } catch (err) {
        console.error("Get player error:", err);
        sendError(res, 500, "Could not retrieve player.");
    }
});

// PLAYERS: CREATE
app.post("/api/players", (req, res) => {
    try {
        const p = readPlayer(req.body, res);
        if (!p) return;

        const result = db.prepare(`
            INSERT INTO sports (
                record_type,
                player_name,
                position,
                jersey_number
            )
            VALUES ('player', ?, ?, ?)
        `).run(p.name, p.position, p.number);

        const row = db.prepare(
            "SELECT * FROM sports WHERE id = ?"
        ).get(result.lastInsertRowid);

        res.status(201).json(formatPlayer(row));
    } catch (err) {
        console.error("Create player error:", err);
        sendError(res, 500, "Could not save player. Check the database schema.");
    }
});

// PLAYERS: UPDATE
app.put("/api/players/:id", (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return sendError(res, 400, "Invalid player ID.");
        }

        const p = readPlayer(req.body, res);
        if (!p) return;

        const id = Number(req.params.id);

        const result = db.prepare(`
            UPDATE sports
            SET player_name = ?,
                position = ?,
                jersey_number = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND record_type = 'player'
        `).run(p.name, p.position, p.number, id);

        if (result.changes === 0) {
            return sendError(res, 404, "Player not found.");
        }

        const row = db.prepare(
            "SELECT * FROM sports WHERE id = ?"
        ).get(id);

        res.json(formatPlayer(row));
    } catch (err) {
        console.error("Update player error:", err);
        sendError(res, 500, "Could not update player.");
    }
});

// PLAYERS: DELETE
app.delete("/api/players/:id", (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return sendError(res, 400, "Invalid player ID.");
        }

        const result = db.prepare(
            "DELETE FROM sports WHERE id = ? AND record_type = 'player'"
        ).run(Number(req.params.id));

        if (result.changes === 0) {
            return sendError(res, 404, "Player not found.");
        }

        res.json({
            success: true,
            message: "Player deleted."
        });
    } catch (err) {
        console.error("Delete player error:", err);
        sendError(res, 500, "Could not delete player.");
    }
});

// ================================
// FIXTURES: READ ALL
// ================================
app.get("/api/fixtures", (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT *
            FROM sports
            WHERE record_type = 'fixture'
            ORDER BY match_date ASC, id ASC
        `).all();

        res.json(rows.map(formatFixture));
    } catch (err) {
        console.error("Load fixtures error:", err);
        sendError(res, 500, "Could not load fixtures.");
    }
});

// FIXTURES: READ ONE
app.get("/api/fixtures/:id", (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return sendError(res, 400, "Invalid fixture ID.");
        }

        const row = db.prepare(
            "SELECT * FROM sports WHERE id = ? AND record_type = 'fixture'"
        ).get(Number(req.params.id));

        if (!row) {
            return sendError(res, 404, "Fixture not found.");
        }

        res.json(formatFixture(row));
    } catch (err) {
        console.error("Get fixture error:", err);
        sendError(res, 500, "Could not retrieve fixture.");
    }
});

// FIXTURES: CREATE
app.post("/api/fixtures", (req, res) => {
    try {
        const f = readFixture(req.body, res);
        if (!f) return;

        const result = db.prepare(`
            INSERT INTO sports (
                record_type,
                home_team,
                away_team,
                opponent,
                match_date,
                venue,
                status,
                home_score,
                away_score
            )
            VALUES ('fixture', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            f.home,
            f.away,
            f.away,
            f.date,
            f.venue,
            f.status,
            f.homeScore,
            f.awayScore
        );

        const row = db.prepare(
            "SELECT * FROM sports WHERE id = ?"
        ).get(result.lastInsertRowid);

        res.status(201).json(formatFixture(row));
    } catch (err) {
        console.error("Create fixture error:", err);
        sendError(res, 500, "Could not save fixture. Check the database schema.");
    }
});

// FIXTURES: UPDATE
app.put("/api/fixtures/:id", (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return sendError(res, 400, "Invalid fixture ID.");
        }

        const f = readFixture(req.body, res);
        if (!f) return;

        const id = Number(req.params.id);

        const result = db.prepare(`
            UPDATE sports
            SET home_team = ?,
                away_team = ?,
                opponent = ?,
                match_date = ?,
                venue = ?,
                status = ?,
                home_score = ?,
                away_score = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND record_type = 'fixture'
        `).run(
            f.home,
            f.away,
            f.away,
            f.date,
            f.venue,
            f.status,
            f.homeScore,
            f.awayScore,
            id
        );

        if (result.changes === 0) {
            return sendError(res, 404, "Fixture not found.");
        }

        const row = db.prepare(
            "SELECT * FROM sports WHERE id = ?"
        ).get(id);

        res.json(formatFixture(row));
    } catch (err) {
        console.error("Update fixture error:", err);
        sendError(res, 500, "Could not update fixture.");
    }
});

// FIXTURES: DELETE
app.delete("/api/fixtures/:id", (req, res) => {
    try {
        if (!validId(req.params.id)) {
            return sendError(res, 400, "Invalid fixture ID.");
        }

        const result = db.prepare(
            "DELETE FROM sports WHERE id = ? AND record_type = 'fixture'"
        ).run(Number(req.params.id));

        if (result.changes === 0) {
            return sendError(res, 404, "Fixture not found.");
        }

        res.json({
            success: true,
            message: "Fixture deleted."
        });
    } catch (err) {
        console.error("Delete fixture error:", err);
        sendError(res, 500, "Could not delete fixture.");
    }
});

// LIST ALL SPORTS RECORDS
app.get("/api/sports", (req, res) => {
    try {
        const rows = db.prepare(
            "SELECT * FROM sports ORDER BY id DESC"
        ).all();

        res.json(rows);
    } catch (err) {
        console.error("Load sports records error:", err);
        sendError(res, 500, "Could not load sports records.");
    }
});

// Handle malformed JSON requests
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return sendError(res, 400, "Invalid JSON in request body.");
    }

    next(err);
});

// START SERVER
app.listen(PORT, () => {
    console.log(`Sports API running at http://localhost:${PORT}`);
});