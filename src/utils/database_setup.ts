import { createClient, type Client } from "@libsql/client";
import { SuggestionTable } from "../services/song_suggestions";

export default class Database {
    private static client: Client;

    static get instance(): Client {
        if (!Database.client) {
            Database.client = createClient({
                url: process.env.TURSO_DATABASE_URL?.trim() || "file:setlist.db",
                authToken: process.env.TURSO_AUTH_TOKEN,
            });

            // Initialise the schema on startup so the bot works out of the box.
            Database.client.executeMultiple(`
            CREATE TABLE IF NOT EXISTS SongList (
                song_id   INTEGER PRIMARY KEY AUTOINCREMENT,
                name      TEXT NOT NULL,
                artist    TEXT NOT NULL,
                suggestor TEXT NOT NULL,
                genius_link TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS Iterests (
                song_id    INTEGER NOT NULL,
                username   TEXT NOT NULL,
                instrument TEXT NOT NULL,
                PRIMARY KEY (song_id, username, instrument)
            );
        `);
        }

        return Database.client;
    }
 
    static roleIDs: Map<string, string> = new Map();

    static async  updateRoleMapping(roles: any) {
        let instruments = await roles.map(role => {
            // Assign Role ID to instrument to mapping
            if (!Database.roleIDs.has(role.name) || Database.roleIDs.get(role.name) != role.id) {
                Database.roleIDs.set(role.name, role.id); 
            }

            return role.name;
        });

        return instruments.filter(role => SuggestionTable.isInstrument(role));
    }
}