
CREATE TABLE IF NOT EXISTS sports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    record_type TEXT NOT NULL
        CHECK (record_type IN ('player', 'fixture')),

    -- Player information
    player_name TEXT,
    position TEXT,
    jersey_number INTEGER,

    -- Fixture information
    home_team TEXT,
    away_team TEXT,
    opponent TEXT,
    match_date TEXT,
    venue TEXT,

    -- Match result
    status TEXT NOT NULL DEFAULT 'Upcoming'
        CHECK (status IN ('Upcoming', 'Completed', 'Cancelled')),
    home_score INTEGER,
    away_score INTEGER,

    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    -- Basic record validation
    CHECK (
        jersey_number IS NULL OR jersey_number >= 1
    ),
    CHECK (
        home_score IS NULL OR home_score >= 0
    ),
    CHECK (
        away_score IS NULL OR away_score >= 0
    )
);
