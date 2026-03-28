import { Message } from 'discord.js';

// Commands only run in guilds (Message<true> guarantees guild text channels with .send())
export type ExecuteFunction = (message: Message<true>) => void;

class Command {
  name: string;

  description: string;

  executeFunction: ExecuteFunction;

  aliases?: string[];

  constructor(
    name: string,
    description: string,
    execute: ExecuteFunction,
    aliases?: string[],
  ) {
    this.name = name;
    this.description = description;
    this.executeFunction = execute;
    if (aliases) this.aliases = aliases;
  }

  execute(message: Message<true>): void {
    this.executeFunction(message);
  }
}

export default Command;
