import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Interaction,
  Events,
  ActivityType,
  Collection,
} from "discord.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A slash command definition bundled with its execute handler.
 */
export interface SlashCommand {
  /** The discord.js builder that defines the command name, description, and options. */
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  /** Called whenever a user invokes this command. */
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// ---------------------------------------------------------------------------
// DiscordBot
// ---------------------------------------------------------------------------

/**
 * Core wrapper around a discord.js {@link Client}.
 *
 * Usage:
 * ```ts
 * const bot = new DiscordBot(token, clientId, guildId);
 * bot.registerCommand(pingCommand);
 * await bot.start();
 * ```
 */
export class DiscordBot {
  /** The underlying discord.js client instance. */
  public readonly client: Client;

  /** Slash commands indexed by their name for O(1) dispatch. */
  private readonly commands: Collection<string, SlashCommand> = new Collection();

  private readonly token: string;
  private readonly clientId: string;

  /**
   * @param token    - Discord bot token (from the Developer Portal).
   * @param clientId - The bot application / client ID.
   * @param guildId  - Optional guild ID. When provided, commands are registered as
   *                   guild commands (instant updates, great for development).
   *                   Omit for global command registration.
   */
  constructor(token: string, clientId: string, private readonly guildId?: string) {
    this.token = token;
    this.clientId = clientId;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Message, Partials.Channel],
    });

    this.registerEventListeners();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Add a slash command to the bot command registry.
   * Call this before {@link start} so that all commands are deployed on boot.
   */
  public registerCommand(command: SlashCommand): this {
    this.commands.set(command.data.name, command);
    return this; // fluent API
  }

  /**
   * Login to Discord, deploy slash commands via the REST API, and begin
   * listening for events.
   */
  public async start(): Promise<void> {
    await this.deployCommands();
    await this.client.login(this.token);
  }

  /**
   * Gracefully shut down the bot.
   */
  public async stop(): Promise<void> {
    console.log("Shutting down bot...");
    this.client.destroy();
  }

  // -------------------------------------------------------------------------
  // Event listeners
  // -------------------------------------------------------------------------

  private registerEventListeners(): void {
    this.client.once(Events.ClientReady, (readyClient) => this.onReady(readyClient));
    this.client.on(Events.InteractionCreate, (interaction) => this.onInteraction(interaction));
    this.client.on(Events.Error, (error) => console.error("Discord client error:", error));
  }

  private onReady(readyClient: Client<true>): void {
    console.log(`Logged in as ${readyClient.user.tag}`);
    readyClient.user.setActivity("Contemplating Slipknot's most recent release", { type: ActivityType.Custom });
  }

  private async onInteraction(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand()) {
      await this.handleSlashCommand(interaction);
      return;
    }
    // Future interaction types (buttons, modals, select menus, etc.) can be
    // dispatched here in additional if branches.
  }

  // -------------------------------------------------------------------------
  // Slash command dispatch
  // -------------------------------------------------------------------------

  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);

    if (!command) {
      console.warn(`Unknown command received: /${interaction.commandName}`);
      await interaction.reply({ content: "Unknown command.", ephemeral: true });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing /${interaction.commandName}:`, error);
      const errorMessage = "An error occurred while running that command.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Command deployment
  // -------------------------------------------------------------------------

  /**
   * Push all registered commands to Discord via the REST API.
   * Guild commands update instantly; global commands can take up to an hour.
   */
  private async deployCommands(): Promise<void> {
    const commandData = this.commands.map((cmd) => cmd.data.toJSON());

    if (commandData.length === 0) {
      console.warn("No commands registered - skipping deployment.");
      return;
    }

    const rest = new REST().setToken(this.token);

    try {
      const route = this.guildId
        ? Routes.applicationGuildCommands(this.clientId, this.guildId)
        : Routes.applicationCommands(this.clientId);

      const scope = this.guildId ? `guild ${this.guildId}` : "global";
      console.log(`Deploying ${commandData.length} slash command(s) (${scope})...`);

      await rest.put(route, { body: commandData });
      console.log("Successfully deployed slash commands.");
    } catch (error) {
      console.error("Failed to deploy slash commands:", error);
      throw error;
    }
  }
}
