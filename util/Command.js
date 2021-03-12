class Command {
  /**
   * @param {string} name
   * @param {string} description
   * @param {function} execute
   * @param {Array.<String>?} aliases
   */
  constructor(name, description, execute, aliases) {
    this.name = name;
    this.description = description;
    this.executeFunction = execute;
    if (aliases) this.aliases = aliases;
  }

  execute(message) {
    this.executeFunction(message);
  }
}

export default Command;
