import { adminId } from '../config.js';
import Command from './Command.js';

class AdminCommand extends Command {
  execute(message) {
    if (message.author.id === adminId) {
      super.execute(message);
    }
  }
}

export default AdminCommand;
