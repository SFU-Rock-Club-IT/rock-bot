import { DiscordBot } from "./discord_bot";
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { SuggestionTable, Instrument, interestedSize } from "./services/song_suggestions";

const { DISCORD_API_TOKEN, DISCORD_API_CLIENT } = process.env;

if (!DISCORD_API_TOKEN || !DISCORD_API_CLIENT) {
    throw new Error("Missing required env vars: DISCORD_API_TOKEN and DISCORD_API_CLIENT");
}

const bot = new DiscordBot(DISCORD_API_TOKEN, DISCORD_API_CLIENT);

bot.registerCommand({
    data: new SlashCommandBuilder().setName("help").setDescription("List all available commands and learn more about the bot"),
    execute: async (interaction) => {
        interaction.reply("test");
    }
});

bot.registerCommand({
    data: new SlashCommandBuilder().setName("suggest").setDescription("Suggests a song you want to play and which instrument").addStringOption(option => option.setName("song").setDescription("Song to suggest")).addStringOption(option => option.setName("artist").setDescription("Artist to suggest")).addStringOption(option => option.setName("instrument").setDescription("Instrument you want to play")),

    execute: async (interaction) => {
        const database = new SuggestionTable(interaction.user.id);
        const song = interaction.options.getString("song");
        const artist = interaction.options.getString("artist");
        const instrument = interaction.options.getString("instrument")?.toLowerCase();

        if (!song || !artist || !instrument) {
            interaction.reply("Missing required fields");
            return;
        }

        if (!SuggestionTable.isInstrument(instrument)) {
            interaction.reply(`Invalid instrument ${instrument}. The following are the only allowed values: ${Object.values(Instrument).join(", ")}`);
            return;
        }

        const successData = await database.addSong(song, artist, instrument);
        if (successData.success) {
            interaction.reply(`Successfully added "${successData.name} by ${successData.artist}" to the suggestion list.`);
        } else {
            interaction.reply("Failed to suggest song");
        }
    }
});

bot.registerCommand({
    data: new SlashCommandBuilder().setName("list").setDescription("Lists all suggested songs").addBooleanOption(option => option.setName("suggested").setDescription("List only songs you have suggested")),
    execute: async (interaction) => {
        const database = new SuggestionTable(interaction.user.id);
        let songs = interaction.options.getBoolean("suggested")
            ? await database.songsSuggestedByUser()
            : await SuggestionTable.suggestedSongs();

        // Sort songs by number of interested members in descending order
        songs = songs.sort((a, b) => {
            return interestedSize(a) < interestedSize(b) ? 1 : -1;
        })

        if (songs.length === 0) {
            interaction.reply("No songs suggested yet");
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle("Suggested Songs")
            .setDescription("List of suggested songs")
            .setColor(0x00FF00);

        songs.forEach(song => {
            const interested = [...song.interested.entries()]
                .map(([userId, instruments]) => `<@${userId}> (${instruments.join(" & ")})`)
                .join("\n");
            embed.addFields({
                name: `${song.name} — ${song.artist}`,
                value: `Suggested by: <@${song.suggestor}>\nInterested:\n${interested || "none"}\n[Genius](${song.genius_link || "https://genius.com"})`,
                // Note: <@id> in embed fields shows a user's display name without pinging them.
                inline: false,
            });
        });

        interaction.reply({ embeds: [embed] });
    }
});

bot.registerCommand({
    data: new SlashCommandBuilder().setName("remove").setDescription("Removes your interest in a song").addStringOption(option => option.setName("song").setDescription("Song to remove")).addStringOption(option => option.setName("artist").setDescription("Artist of the song to remove")),
    execute: async (interaction) => {
        const database = new SuggestionTable(interaction.user.id);
        const song = interaction.options.getString("song");
        const artist = interaction.options.getString("artist");

        if (!song || !artist) {
            interaction.reply("Missing required fields");
            return;
        }

        if (await database.removeInterest(song, artist)) {
            interaction.reply("Song removed successfully");
        } else {
            interaction.reply("There is no interest in a song to remove");
        }
    }
});

bot.start();