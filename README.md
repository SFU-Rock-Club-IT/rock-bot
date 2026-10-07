# SFU Rock Club Discord Bot

The source code to the SFU Rock Club song suggestion system.

## Usage

This project uses `typescript` and `bun` to run. `discord.js` and `@libsql/client`
are used as the main libraries to store everything within a SQLite database.

> ### Docker Setup
>
> There is a docker-compose.yml file that is used to start the bot. The rest will
> be taken care of by the container.
>
> ```bash
> docker compose up
> ```

To manually setup and start the bot, you will be required to create a `.env`
file with the following variables:

```bash
# Required
DISCORD_API_TOKEN="<DISCORD_API_TOKEN>"
DISCORD_API_CLIENT="<DISCORD_API_CLIENT>"
GENIUS_API_KEY="<GENIUS_API_KEY>"

# Optional; If not included, will fall back to local database files.
TURSO_DATABASE_URL="<TURSO_DATABASE_URL>"
TURSO_AUTH_TOKEN="<TURSO_AUTH_TOKEN>"
```

With `bun` run `bun install` and you can then start the bot with `bun run index.ts`

### Contribution

You are recommended to use `bun` (version 1.3.11 or newer) for contributing to
the source code, but the source code should also work with `npm`.

```bash
bun install || npm install
```

To start the bot locally:

```bash
bun start || npm start
```

Test files are always appreciated. To run tests, you can use `bun run test` or `npm run test`. We use `vitest` as our testing framework for the convenience of being able to test as you are editing the source code.
