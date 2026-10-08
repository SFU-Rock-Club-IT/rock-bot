import { describe, test, expect } from "vitest";
import { formatInterestedByInstrument, Instrument, SongEntry } from "../src/services/song_suggestions";

describe("formatInterestedByInstrument", () => {
    test("returns 'none' when no one is interested", () => {
        const emptyMap = new Map();
        expect(formatInterestedByInstrument(emptyMap)).toBe("none");

        const song: SongEntry = {
            song_id: 1,
            name: "Test Song",
            artist: "Test Artist",
            suggestor: "111",
            genius_link: "https://genius.com",
            interested: new Map(),
        };
        expect(formatInterestedByInstrument(song)).toBe("none");
    });

    test("groups users by instrument correctly", () => {
        const interested = new Map<string, Instrument[]>([
            ["111", [Instrument.Vocals]],
            ["222", [Instrument.Guitar]],
            ["333", [Instrument.Guitar]],
        ]);

        const formatted = formatInterestedByInstrument(interested);
        expect(formatted).toBe("Vocals: <@111>\nGuitar: <@222>, <@333>");
    });

    test("handles a single user playing multiple instruments", () => {
        const interested = new Map<string, Instrument[]>([
            ["111", [Instrument.Vocals, Instrument.Guitar]],
            ["222", [Instrument.Guitar, Instrument.Bass]],
        ]);

        const formatted = formatInterestedByInstrument(interested);
        expect(formatted).toBe("Vocals: <@111>\nGuitar: <@111>, <@222>\nBass: <@222>");
    });

    test("orders standard instruments in preferred order", () => {
        const interested = new Map<string, Instrument[]>([
            ["333", [Instrument.Drums]],
            ["111", [Instrument.Guitar]],
            ["222", [Instrument.Vocals]],
        ]);

        const formatted = formatInterestedByInstrument(interested);
        expect(formatted).toBe("Vocals: <@222>\nGuitar: <@111>\nDrums: <@333>");
    });
});
