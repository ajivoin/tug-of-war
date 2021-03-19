import Command from './Command';

class AdminCommand extends Command {
  execute(message) {
    if (message.member.id === '110521207291428864') {
      super.execute(message);
    }
  }
}

export default AdminCommand;
