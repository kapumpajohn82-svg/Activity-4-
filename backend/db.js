
"use strict";

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const dbPath = path.resolve(
    __dirname,
    process.env.DB_PATH || "sports.db"
);

const db = new Database(dbPath);

// Improve reliability when multiple operations occur.
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create the database table from schema.sql.
const schemaPath = path.join(__dirname, "schema.sql");
db.exec(fs.readFileSync(schemaPath, "utf8"));

// Upgrade an older database without deleting existing records.
const existingColumns = new Set(
    db.pragma("table_info(sports)").map(column => column.name)
);

const migrations = {
    home_team: "TEXT",
    away_team: "TEXT",
    venue: "TEXT",
    status: "TEXT NOT NULL DEFAULT 'Upcoming'",
    home_score: "INTEGER",
    away_score: "INTEGER"
};

for (const [column, definition] of Object.entries(migrations)) {
    if (!existingColumns.has(column)) {
        db.exec(
            `ALTER TABLE sports ADD COLUMN ${column} ${definition}`
        );
    }
}

// Make old fixture records displayable in the updated frontend.
db.prepare(`
    UPDATE sports
    SET home_team = COALESCE(home_team, 'Home Team'),
        away_team = COALESCE(away_team, opponent, 'Away Team')
    WHERE record_type = 'fixture'
      AND (home_team IS NULL OR away_team IS NULL)
`).run();

// Insert sample records only if the table is empty.
const total = db.prepare(
    "SELECT COUNT(*) AS total FROM sports"
).get().total;

if (total === 0) {
    const insert = db.prepare(`
        INSERT INTO sports (
            record_type,
            player_name,
            position,
            jersey_number,
            home_team,
            away_team,
            opponent,
            match_date,
            venue,
            status
        )
        VALUES (
            @record_type,
            @player_name,
            @position,
            @jersey_number,
            @home_team,
            @away_team,
            @opponent,
            @match_date,
            @venue,
            'Upcoming'
        )
    `);

    const samples = [
        {
            record_type: "player",
            player_name: "John Banda",
            position: "Goalkeeper",
            jersey_number: 1
        },
        {
            record_type: "player",
            player_name: "Peter Phiri",
            position: "Defender",
            jersey_number: 2
        },
        {
            record_type: "player",
            player_name: "James Zulu",
            position: "Defender",
            jersey_number: 3
        },
        {
            record_type: "player",
            player_name: "David Mwansa",
            position: "Midfielder",
            jersey_number: 6
        },
        {
            record_type: "player",
            player_name: "Brian Tembo",
            position: "Midfielder",
            jersey_number: 8
        },
        {
            record_type: "player",
            player_name: "Michael Chanda",
            position: "Forward",
            jersey_number: 9
        },
        {
            record_type: "player",
            player_name: "Joseph Sakala",
            position: "Forward",
            jersey_number: 10
        },
        {
            record_type: "player",
            player_name: "Andrew Mbewe",
            position: "Defender",
            jersey_number: 5
        },
        {
            record_type: "fixture",
            home_team: "Home Team",
            away_team: "Kabwe United",
            opponent: "Kabwe United",
            match_date: "2026-10-25",
            venue: "Main Stadium"
        },
        {
            record_type: "fixture",
            home_team: "Home Team",
            away_team: "Lusaka City",
            opponent: "Lusaka City",
            match_date: "2026-11-01",
            venue: "Main Stadium"
        },
        {
            record_type: "fixture",
            home_team: "Home Team",
            away_team: "Ndola Rangers",
            opponent: "Ndola Rangers",
            match_date: "2026-11-08",
            venue: "Main Stadium"
        },
        {
            record_type: "fixture",
            home_team: "Home Team",
            away_team: "Livingstone FC",
            opponent: "Livingstone FC",
            match_date: "2026-11-15",
            venue: "Main Stadium"
        }
    ];

    const seed = db.transaction(records => {
        for (const record of records) {
            insert.run({
                player_name: null,
                position: null,
                jersey_number: null,
                home_team: null,
                away_team: null,
                opponent: null,
                match_date: null,
                venue: null,
                ...record
            });
        }
    });

    seed(samples);
}

console.log("SQLite database is ready!");
console.log("Database location:", dbPath);
console.log(
    "Total records:",
    db.prepare("SELECT COUNT(*) AS total FROM sports").get().total
);

module.exports = db;
