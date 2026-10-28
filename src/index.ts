import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  Events,
} from "discord.js";
import { config } from "./config.js";

declare module "discord.js" {
  export interface Client {
    commands: Collection<string, any>;
  }
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

client.commands = new Collection();
function getFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFiles(fullPath));
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}
async function loadModules() {
  console.log("-----------------------------------------");
  console.log("🚀 Starte Loader...");
  console.log("-----------------------------------------");
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = getFiles(commandsPath);

  if (commandFiles.length === 0) {
    console.log("📁 [Commands] Keine Commands gefunden (Ordner ist leer).");
  } else {
    for (const file of commandFiles) {
      try {
        const fileUrl = pathToFileURL(file).href;
        const module = await import(fileUrl);
        const command = module.default || module;

        const commandName = command.data?.name || command.name;
        if (commandName && (command.execute || typeof command === "function")) {
          client.commands.set(commandName, command);
          console.log(`✅ [Command] Geladen: ${commandName}`);
        } else {
          console.warn(`⚠️ [Command] Datei übersprungen (fehlender Name oder execute): ${path.basename(file)}`);
        }
      } catch (error) {
        console.error(`❌ [Command] Fehler beim Laden von ${path.basename(file)}:`, error);
      }
    }
    console.log(`📦 [Commands] Gesamt geladen: ${client.commands.size}`);
  }

  const eventsPath = path.join(__dirname, "events");
  const eventFiles = getFiles(eventsPath);

  let loadedEventsCount = 0;
  if (eventFiles.length === 0) {
    console.log("📁 [Events] Keine Events gefunden (Ordner ist leer).");
  } else {
    for (const file of eventFiles) {
      try {
        const fileUrl = pathToFileURL(file).href;
        const module = await import(fileUrl);
        const event = module.default || module;

        if (event.name && typeof event.execute === "function") {
          if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
          } else {
            client.on(event.name, (...args) => event.execute(...args, client));
          }
          loadedEventsCount++;
          console.log(`✅ [Event] Registriert: ${event.name} (${event.once ? "once" : "on"})`);
        } else {
          console.warn(`⚠️ [Event] Datei übersprungen (fehlender Name oder execute): ${path.basename(file)}`);
        }
      } catch (error) {
        console.error(`❌ [Event] Fehler beim Laden von ${path.basename(file)}:`, error);
      }
    }
    console.log(`📦 [Events] Gesamt geladen: ${loadedEventsCount}`);
  }
  const logicPath = path.join(__dirname, "logic");
  const logicFiles = getFiles(logicPath);

  let loadedLogicCount = 0;
  if (logicFiles.length === 0) {
    console.log("📁 [Logic] Keine Logic-Module gefunden (Ordner ist leer).");
  } else {
    for (const file of logicFiles) {
      try {
        const fileUrl = pathToFileURL(file).href;
        const module = await import(fileUrl);
        if (typeof module.default === "function") {
          await module.default(client);
          loadedLogicCount++;
          console.log(`✅ [Logic] Initialisiert: ${path.basename(file)}`);
        } else if (typeof module.init === "function") {
          await module.init(client);
          loadedLogicCount++;
          console.log(`✅ [Logic] Initialisiert (init): ${path.basename(file)}`);
        } else {
          console.log(`ℹ️ [Logic] Geladen: ${path.basename(file)}`);
          loadedLogicCount++;
        }
      } catch (error) {
        console.error(`❌ [Logic] Fehler beim Laden von ${path.basename(file)}:`, error);
      }
    }
    console.log(`📦 [Logic] Gesamt initialisiert: ${loadedLogicCount}`);
  }

  if (client.listenerCount(Events.InteractionCreate) === 0) {
    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`[Command] Kein Handler für /${interaction.commandName} gefunden.`);
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`[Command Error] Fehler bei Ausführung von /${interaction.commandName}:`, error);
        const replyPayload = {
          content: "❌ Beim Ausführen dieses Befehls ist ein Fehler aufgetreten!",
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyPayload);
        } else {
          await interaction.reply(replyPayload);
        }
      }
    });
  }
  if (client.listenerCount(Events.ClientReady) === 0) {
    client.once(Events.ClientReady, (c) => {
      console.log("-----------------------------------------");
      console.log(`🟢 Eingeloggt als: ${c.user.tag}`);
      console.log("-----------------------------------------");
    });
  }

  console.log("-----------------------------------------");
}
async function main() {
  await loadModules();

  const token = config.token;
  if (!token || token.trim() === "" || token === "DEIN_BOT_TOKEN_HIER") {
    console.warn("⚠️  HINWEIS: Es wurde kein gültiger Token in src/config.ts gefunden.");
    console.warn("👉 Trage deinen Bot-Token in src/config.ts ein, um den Bot online zu bringen.");
    return;
  }

  try {
    await client.login(token);
  } catch (error) {
    console.error("❌ Fehler beim Einloggen in Discord:", error);
  }
}
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unbehandelte Ablehnung (Unhandled Rejection):", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Unbehandelte Ausnahme (Uncaught Exception):", error);
});

main();
