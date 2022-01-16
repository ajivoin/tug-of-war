import Command from './Command';

class AdminCommand extends Command {
  execute(message) {
    if (message.member.permissions.has('MANAGE_GUILD')) {
      super.execute(message);
    }
  }
}

export default AdminCommand;
