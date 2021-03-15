import { adminId } from '../config';
import Command from './Command';

class AdminCommand extends Command {
  execute(message) {
    if (message.author.id === adminId) {
      super.execute(message);
    }
  }
}

export default AdminCommand;
