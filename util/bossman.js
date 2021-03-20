import Boss from './bosses';
import data from './data';

export default class BossManager {
  static manInstance;

  static get instance() {
    return BossManager.manInstance || BossManager.init();
  }

  static init() {
    BossManager.manInstance = new BossManager();
    BossManager.manInstance.load();
    return BossManager.manInstance;
  }

  constructor() {
    this.bosses = {};
  }

  static load() {
    // add boss from json for guild each guild
    BossManager.manInstance = new BossManager();
    Object.keys(data.getBosses()).forEach((guildId) => {
      BossManager.instance.bosses[guildId] = new Boss(guildId).load();
    });
  }

  static add(guildId) {
    const newBoss = new Boss(guildId);
    BossManager.instance.bosses[guildId] = newBoss;
    return newBoss;
  }

  static get(guildId) {
    return BossManager.instance.bosses[guildId];
  }

  static kill(guildId) {
    BossManager.instance.bosses[guildId].kill();
  }

  static spawn(guildId) {
    BossManager.instance.add(guildId);
  }

  static persist() {
    Object.values(BossManager.instance.bosses).forEach((boss) => {
      data.persistBoss(boss.guildId, boss);
    });
  }
}
