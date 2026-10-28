export interface BotConfig {
  token: string;
  clientId: string;
  guildId?: string;
  embedColor: number;
}

export const config: BotConfig = {
  // Discord Bot Token
  token: "",

  // Client / Application ID
  clientId: "",

  // Server (Guild) ID
  guildId: "",

  // Embed Coloe
  embedColor: 0x5865f2,
};
