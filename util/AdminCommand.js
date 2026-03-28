import { PermissionFlagsBits } from 'discord.js';
import Command from './Command.js';

class AdminCommand extends Command {
  execute(message) {
    if (message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      super.execute(message);
    }
  }
}

export default AdminCommand;
