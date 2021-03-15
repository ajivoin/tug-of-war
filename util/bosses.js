import _ from 'underscore';
import { MessageEmbed } from 'discord.js';

import utils from './utils';
import data from './data';

const IMAGE_PATH = [
  'util/boss_images/0_sunglasses.png',
  'util/boss_images/1_ogre.png',
  'util/boss_images/2_monster.png',
  'util/boss_images/3_clown.png',
  'util/boss_images/4_dragon.png',
  'util/boss_images/5_clown.png',
  'util/boss_images/6_poop.png',
  'util/boss_images/7_devil.png',
  'util/boss_images/8_goblin.png',
  'util/boss_images/9_cowboy.png',
  'util/boss_images/10_bezos.png',
  'util/boss_images/11_santa.png',
  'util/boss_images/12_sun.png',
  'util/boss_images/13_moon.png',
  'util/boss_images/14_snowman.png',
  'util/boss_images/15_rock.png',
];

const BOSS_REWARDS_POOL = [
  { crowns: 10 },
  { crowns: 20 },
  { crowns: 40 },
  { crowns: 80 },
  { crowns: 160 },
];
const BOSS_HEALTH_MULTIPLIER = 100;

export default class Boss {
  static instance;

  static REWARDS_POOL = BOSS_REWARDS_POOL;

  static HEALTH_MULTIPLIER = BOSS_HEALTH_MULTIPLIER;

  static BOSS_BREAKPOINTS = [
    0.40,
    0.70,
    0.95,
    0.99,
    1.00,
  ];

  static kill() {
    Boss.instance = null;
  }

  static load() {
    if (!Boss.instance) {
      const boss = data.getBoss();
      console.log(`Boss load: ${boss}`);
      if (boss) {
        Boss.instance = new Boss();
        Boss.instance.active = boss.active;
        Boss.instance.health = boss.health;
        Boss.instance.level = boss.level;
        Boss.instance.participants = boss.participants;
        Boss.instance.rewards = boss.rewards;
        Boss.instance.totalHealth = boss.totalHealth;
        Boss.instance.imagePath = boss.imagePath;
        Boss.instance.imageName = boss.imageName;
        Boss.instance.levelText = '⭐'.repeat(boss.level);
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
      .addField('Health', `${this.health} ❤`, true)
      .attachFiles([this.imagePath])
      .setImage(`attachment://${this.imageName}`);
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
      this.imagePath = _.sample(IMAGE_PATH);
      [,, this.imageName] = this.imagePath.split('/');
      console.log(this.imageName);
      Boss.instance = this;
    }
  }

  calculateReward(userId) {
    const ratio = this.participants[userId] / this.totalHealth;
    const result = {};
    Object.keys(this.rewards).forEach((reward) => {
      result[reward] = Math.ceil(ratio * this.rewards[reward]);
    });
    return result;
  }

  distributeRewards() {
    Object.keys(this.participants).forEach((userId) => {
      const reward = this.calculateReward(userId);
      if (utils.hasProperty(reward, 'crowns')) {
        data.addCrowns(userId, reward.crowns);
      }
      if (utils.hasProperty(reward, 'coins')) {
        data.addCoins(userId, reward.coins);
      }
    });
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
    data.persistBoss(Boss.instance);
    return false;
  }
}
