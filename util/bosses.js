import constants from './constants.js';
import utils from './utils.js';
import data from './data.js';
import { MessageEmbed } from 'discord.js';


const BOSS_REWARDS_POOL = [
    {crowns: 10},
    {crowns: 20},
    {crowns: 40},
    {crowns: 80},
    {crowns: 160}
];
const BOSS_HEALTH_MULTIPLIER = 100;

export default class Boss {
  static instance = null;
  static REWARDS_POOL = BOSS_REWARDS_POOL;
  static HEALTH_MULTIPLIER = BOSS_HEALTH_MULTIPLIER;
  static BOSS_BREAKPOINTS = [
    0.40,
    0.70,
    0.95,
    0.99,
    1.00
  ];

  static load() {
    if (!Boss.instance) {
      const boss = data.getBoss();
      if (boss) {
         const me = Boss.instance = new Boss();
         me.active = boss.active;
         me.health = boss.health;
         me.level = boss.level;
         me.participants = boss.participants;
         me.rewards = boss.rewards;
         me.totalHealth = boss.totalHealth;
         me.levelText = '⭐'.repeat(me.level);
      }
    }
  }

  static instantiate() {
    if (!Boss.instance) {
      Boss.instance = new Boss();
    }
    return Boss.instance;
  }

  embed() {
    return new MessageEmbed()
      .setColor('#0099ff')
      .setTitle('Boss battle!')
      .setDescription('Count numbers to attack the boss! All participants will receive a reward!')
      .addField('Level', this.levelText, true)
      .addField('Health', `${this.health} ❤`, true);
  }

  constructor() {
    if (!Boss.instance) {
      const odds = Math.random();
      let bp = 0;
      while (odds > Boss.BOSS_BREAKPOINTS[bp]) bp += 1;
      this.level = bp + 1;
      this.levelText = '⭐'.repeat(this.level);
      this.rewards = Boss.REWARDS_POOL[bp];
      this.health = this.level * Boss.HEALTH_MULTIPLIER;
      this.totalHealth = this.health;
      this.health = Boss.HEALTH_MULTIPLIER * this.level;
      this.participants = {};
      this.active = true;
      Boss.instance = this;
    }
  }

  calculateReward(userId) {
    const ratio = this.participants[userId] / this.totalHealth;
    const result = {};
    for (const reward of Object.keys(this.rewards)) {
      result[reward] = Math.ceil(ratio * this.rewards[reward]);
    }
    return result;
  }

  distributeRewards() {
    for (const userId of Object.keys(this.participants)) {
      const reward = this.calculateReward(userId);
      if (utils.hasProperty(reward, 'crowns')) {
        data.addCrowns(userId, reward.crowns);
      }
      if (utils.hasProperty(reward, 'coins')) {
        data.addCoins(userid, reward.coins);
      }
    }
  }

  handleWin(userId) {
    this.distributeRewards();
    data.addCrowns(userId, 1); // bonus for last hit
    this.active = false;
    Boss.instance = null;
  }

  hit(userId) {
    const user = this.participants[userId];
    if (user) {
      this.participants[userId] += 1;
    } else {
      this.participants[userId] = 1;
    }
    this.health -= 1;
    if (this.health <= 0) {
      // winner!
      this.handleWin(userId);
      return true;
    }
    if (this.health % 10 === 0) {
      data.persistBoss(JSON.stringify(this));
    }
    return false;
  }
};
