import { createClient, type Client } from "@libsql/client";
import * as Genius from "../utils/genius";
import Database from "../utils/database_setup";

const client: Client = Database.instance;

/**
 * The instrument a member wants to play for a suggested song.
 * Values are stored as strings in the database.
 */
export enum Instrument {
    Guitar    = "guitar",
    Bass      = "bass",
    Drums     = "drums",
    Keyboard  = "keyboard",
    Vocals    = "vocals",
    Other     = "other",
}

type Name = string;

export interface SongEntry {
    song_id:     number;
    name:        string;
    artist:      string;
    suggestor:   Name;
    genius_link: string;
    /** Map of user ID → list of instruments they want to play */
    interested:  Map<Name, Instrument[]>;
}

export function interestedSize(song: SongEntry): number {
    let sum = 0;
    for (const instruments of song.interested.values()) {
        sum += instruments.length;
    }
    return sum;
}

/**
 * Formats interested members grouped by instrument instead of per user.
 * For example:
 * Vocals: <@123>
 * Guitar: <@456>, <@789>
 */
export function formatInterestedByInstrument(source: SongEntry | Map<Name, Instrument[]>, personal: boolean = false): string {
    const interested = source instanceof Map ? source : source.interested;
    const instrumentUsers = new Map<string, string[]>();

    for (const [userId, instruments] of interested.entries()) {
        for (const inst of instruments) {
            const formatted = inst.charAt(0).toUpperCase() + inst.slice(1).toLowerCase();
            if (!instrumentUsers.has(formatted)) {
                instrumentUsers.set(formatted, []);
            }
            const mention = `<@${userId}>`;
            const list = instrumentUsers.get(formatted)!;
            if (!list.includes(mention)) {
                list.push(mention);
            }
        }
    }

    if (instrumentUsers.size === 0) {
        return "none";
    }

    const preferredOrder = ["Vocals", "Guitar", "Bass", "Drums", "Keyboard", "Other"];
    const sorted = [...instrumentUsers.entries()].sort(([a], [b]) => {
        const indexA = preferredOrder.indexOf(a);
        const indexB = preferredOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    return sorted
        .map(([instrument, users]) => `${Database.roleIDs.has(instrument.toLocaleLowerCase()) ? `<@&${Database.roleIDs.get(instrument.toLowerCase())}>`: instrument}: ${personal ? users.join(", ") : users.length}`)
        .join("\n");
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all rows from SongList joined with Iterests and reassemble them
 * into {@link SongEntry} objects.
 */
async function fetchSongs(whereSql = "", args: any[] = []): Promise<SongEntry[]> {
    const songRows = await client.execute({
        sql: `SELECT song_id, name, artist, suggestor, genius_link
              FROM SongList ${whereSql}
              ORDER BY song_id`,
        args,
    });

    if (songRows.rows.length === 0) return [];

    const songIds = songRows.rows.map((r) => r.song_id as number);

    // Fetch all interest rows for the matched songs in one round-trip.
    const placeholders = songIds.map(() => "?").join(",");
    const interestRows = await client.execute({
        sql: `SELECT song_id, username, instrument FROM Iterests WHERE song_id IN (${placeholders})`,
        args: songIds,
    });

    // Build a lookup: song_id → Map<userId, Instrument[]>
    // A single user may have multiple rows (one per instrument).
    const interestMap = new Map<number, Map<Name, Instrument[]>>();
    for (const row of interestRows.rows) {
        const id = row.song_id as number;
        if (!interestMap.has(id)) interestMap.set(id, new Map());
        const userMap = interestMap.get(id)!;
        const userId = row.username as string;
        if (!userMap.has(userId)) userMap.set(userId, []);
        userMap.get(userId)!.push(row.instrument as Instrument);
    }

    return songRows.rows.map((r) => ({
        song_id:     r.song_id    as number,
        name:        r.name       as string,
        artist:      r.artist     as string,
        suggestor:   r.suggestor  as string,
        genius_link: r.genius_link as string,
        interested:  interestMap.get(r.song_id as number) ?? new Map(),
    }));
}

// ---------------------------------------------------------------------------
// SuggestionTable
// ---------------------------------------------------------------------------

/**
 * Creates an interface between the Discord user and the song suggestions list.
 */
export class SuggestionTable {
    private _user: Name;

    /**
     * @param userId The Discord user ID (snowflake) of the acting user.
     */
    constructor(userId: string) {
        this._user = userId;
    }

    // -----------------------------------------------------------------------
    // Type guard
    // -----------------------------------------------------------------------

    /** Returns true if {@link value} is a valid {@link Instrument} string. */
    static isInstrument(value: string): value is Instrument {
        return Object.values(Instrument).includes(value as Instrument);
    }

    // -----------------------------------------------------------------------
    // Read
    // -----------------------------------------------------------------------

    /**
     * Returns every song in the suggestion database.
     */
    static async suggestedSongs(): Promise<SongEntry[]> {
        return fetchSongs();
    }

    /**
     * Returns only the songs that this user has expressed interest in.
     */
    async songsSuggestedByUser(): Promise<SongEntry[]> {
        return fetchSongs(
            `WHERE song_id IN (SELECT song_id FROM Iterests WHERE username = ?)`,
            [this._user],
        );
    }

    // -----------------------------------------------------------------------
    // Write
    // -----------------------------------------------------------------------

    /**
     * Adds the user's interest in a song.
     *
     * - If the song doesn't exist yet, it is inserted into SongList (with the
     *   current user as suggestor) and a Genius link is automatically looked up.
     * - If the song already exists, only an interest row is upserted.
     *
     * @returns `true` on success, `false` if a database error occurred.
     */
    async addSong(name: string, artist: string, instrument: Instrument): Promise<{success: boolean, name?: string, artist?: string}> {
        try {
            const search = await Genius.SearchSongs(`${name} ${artist}`, 1);
            let name_auto = search.data[0].name;
            let artist_auto = search.data[0].artist;
            // Check whether this song is already in the list.
            const existing = await client.execute({
                sql: `SELECT song_id FROM SongList WHERE LOWER(name) = LOWER(?) AND LOWER(artist) = LOWER(?) LIMIT 1`,
                args: [name_auto, artist_auto],
            });

            let songId: number;

            if (existing.rows.length === 0) {
                // New song — look up Genius link first.
                let geniusLink = "";
                let songmeta;
                if (search.success && search.data.length > 0) {
                    geniusLink = `https://genius.com/songs/${search.data[0].id}`;
                }

                const insert = await client.execute({
                    sql: `INSERT INTO SongList (name, artist, suggestor, genius_link)
                          VALUES (?, ?, ?, ?)`,
                    args: [name_auto, artist_auto, this._user, geniusLink],
                });

                songId = Number(insert.lastInsertRowid);
            } else {
                songId = existing.rows[0].song_id as number;
            }

            // Insert the interest row. The PK is (song_id, username, instrument),
            // so the same user can hold multiple instruments. Inserting the same
            // combination twice is silently ignored (idempotent).
            await client.execute({
                sql: `INSERT INTO Iterests (song_id, username, instrument)
                      VALUES (?, ?, ?)
                      ON CONFLICT(song_id, username, instrument) DO NOTHING`,
                args: [songId, this._user, instrument],
            });

            return {success: true, name: name_auto, artist: artist_auto};
        } catch (err) {
            console.error("SuggestionTable.addSong error:", err);
            return {success: false};
        }
    }

    /**
     * Removes this user's interest in a song.
     *
     * - If the user was the suggestor, ownership transfers to the next person
     *   who expressed interest (earliest row).
     * - If nobody else is interested after removal, the song is deleted entirely.
     *
     * @returns `true` if an interest row was removed, `false` if the user had
     *          no recorded interest in that song.
     */
    async removeInterest(name: string, artist: string): Promise<boolean> {
        try {
            // Find the song.
            const songRows = await client.execute({
                sql: `SELECT song_id, suggestor FROM SongList
                      WHERE LOWER(name) = LOWER(?) AND LOWER(artist) = LOWER(?) LIMIT 1`,
                args: [name, artist],
            });

            if (songRows.rows.length === 0) return false;

            const { song_id: songId, suggestor } = songRows.rows[0];

            // Confirm this user actually has an interest row.
            const interestRows = await client.execute({
                sql: `SELECT username FROM Iterests WHERE song_id = ? ORDER BY rowid`,
                args: [songId],
            });

            const usernames = interestRows.rows.map((r) => r.username as string);
            if (!usernames.includes(this._user)) return false;

            // Remove the user's interest.
            await client.execute({
                sql: `DELETE FROM Iterests WHERE song_id = ? AND username = ?`,
                args: [songId, this._user],
            });

            const remaining = usernames.filter((u) => u !== this._user);

            if (remaining.length === 0) {
                // No one else cares — delete the song entirely.
                await client.execute({
                    sql: `DELETE FROM SongList WHERE song_id = ?`,
                    args: [songId],
                });
            } else if (suggestor === this._user) {
                // Transfer suggestor to the next interested member.
                await client.execute({
                    sql: `UPDATE SongList SET suggestor = ? WHERE song_id = ?`,
                    args: [remaining[0], songId],
                });
            }

            return true;
        } catch (err) {
            console.error("SuggestionTable.removeInterest error:", err);
            return false;
        }
    }
}
