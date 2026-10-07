-- This is not actually used, this is only here for reference of the database architecture

CREATE TABLE IF NOT EXISTS SongList (
    song_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    artist TEXT NOT NULL,
    suggestor TEXT NOT NULL,
    genius_link TEXT NOT NULL
)

CREATE TABLE IF NOT EXISTS Iterests (
    song_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    instrument TEXT NOT NULL,
    PRIMARY KEY (song_id, username, instrument)
)