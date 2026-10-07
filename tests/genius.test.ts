import { describe, test, expect } from "vitest";
import { GetSongMetadata, SearchSongs } from "../src/utils/genius";

describe("Genius API Tests", () => {
    test("Search Songs", async () => {
        const result = await SearchSongs("Never Gonna Give You Up");
        console.log(result.data);
        expect(result.success).toBe(true);
    });

    test("Use ID to fetch song link", async () => {
        const result = await SearchSongs("Never Gonna Give You Up");
        const songMeta = await GetSongMetadata(result.data[0].id);
        console.log(songMeta);
        expect(songMeta.success).toBe(true);
    })
});