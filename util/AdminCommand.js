const { adminId } = require('../config.json');
const Command = require('./Command');

class AdminCommand extends Command {
  execute(message) {
    if (message.author.id === adminId) {
      super.execute(message);
    }
  }
}

module.exports = AdminCommand;
