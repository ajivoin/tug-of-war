import _ from 'underscore';
import { MessageEmbed } from 'discord.js';

import utils from './utils';
import data from './data';
import constants from './constants';

// const IMAGE_PATH = [
//   [
//     'util/boss_images/5_clown.png',
//     'util/boss_images/401_joker.png',
//     'util/boss_images/401_prankster.png',
//   ],
//   [
//     'util/boss_images/5_clown.png',
//     'util/boss_images/401_joker.png',
//     'util/boss_images/401_prankster.png',
//   ],
//   [
//     'util/boss_images/10_bezos.png',
//     'util/boss_images/401_joker.png',
//     'util/boss_images/401_prankster.png',
//   ],
//   [
//     'util/boss_images/6_poop.png',
//     'util/boss_images/401_joker.png',
//     'util/boss_images/401_prankster.png',
//   ],
//   [
//     'util/boss_images/8_goblin.png',
//     'util/boss_images/401_joker.png',
//     'util/boss_images/401_prankster.png',
//   ],
// ];

const IMAGE_PATH = [
  [
    'util/boss_images/0_sunglasses.png',
    'util/boss_images/5_clown.png',
    'util/boss_images/6_poop.png',
  ],
  [
    'util/boss_images/1_ogre.png',
    'util/boss_images/2_monster.png',
    'util/boss_images/3_ghost.png',
  ],
  [
    'util/boss_images/9_cowboy.png',
    'util/boss_images/10_bezos.png',
    'util/boss_images/15_rock.png',
    // 'util/boss_images/11_santa.png',
    // 'util/boss_images/14_snowman.png',
  ],
  [
    'util/boss_images/7_devil.png',
    'util/boss_images/8_goblin.png',
    'util/boss_images/401_prankster.png',
  ],
  [
    'util/boss_images/12_sun.png',
    'util/boss_images/13_moon.png',
    'util/boss_images/4_dragon.png',
  ],
];

const BOSS_REWARDS_POOL = [
  { crowns: 20 },
  { crowns: 30 },
  { crowns: 50 },
  { crowns: 75 },
  { crowns: 150 },
];
const BOSS_HEALTH_MULTIPLIER = 75 * constants.BASE_DAMAGE;

export default class Boss {
  static instance;

  static REWARDS_POOL = BOSS_REWARDS_POOL;

  static HEALTH_MULTIPLIER = BOSS_HEALTH_MULTIPLIER;

  static BOSS_BREAKPOINTS = [
    0.3,
    0.5,
    0.7,
    0.9,
    1.0,
  ];

  static kill() {
    Boss.instance.handleWin(null);
  }

  static load() {
    if (!Boss.instance) {
      const boss = data.getBoss();
      console.log(`Boss load: ${JSON.stringify(boss)}`);
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
        Boss.instance.bossName = boss.bossName;
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

  get embed() {
    return new MessageEmbed()
      .setColor('#0099ff')
      .setTitle('Boss battle!')
      .setDescription('Count numbers to attack the boss! All participants will receive a reward!')
      .addField('Name', this.bossName, true)
      .addField('Level', this.levelText, true)
      .addField('Health', `${this.health} ❤`, true)
      .attachFiles([this.imagePath])
      .setImage(`attachment://${this.imageName}`);
  }

  constructor() {
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
    this.imagePath = _.sample(IMAGE_PATH[bp]);
    [,, this.imageName] = this.imagePath.split('/');
    const [, bossName] = this.imageName.split(/[_|.]/);
    this.bossName = bossName[0].toUpperCase() + bossName.slice(1);
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
    if (userId) data.addCrowns(userId, 5); // bonus for last hit
    this.active = false;
    Boss.instance = null;
  }

  bomb(userId) {
    const user = this.participants[userId];
    if (user) {
      this.participants[userId] += constants.BOMB_DAMAGE;
    } else {
      this.participants[userId] = constants.BOMB_DAMAGE;
    }
    this.health -= constants.BOMB_DAMAGE;
    if (this.health <= 0) {
      this.handleWin(userId);
      data.persistBoss(null);
      return true;
    }
    data.persistBoss(Boss.instance);
    return false;
  }

  hit(userId, critCallback) {
    const crit = Math.random() < constants.CRIT_RATE * Math.sqrt(this.level);
    const damage = constants.BASE_DAMAGE * (crit ? constants.CRIT_MULTIPLIER : 1);
    const user = this.participants[userId];
    if (user) {
      this.participants[userId] += damage;
    } else {
      this.participants[userId] = damage;
    }
    this.health -= damage;
    if (this.health <= 0) {
      // winner!
      this.handleWin(userId);
      return true;
    }
    if (crit) critCallback();
    data.persistBoss(Boss.instance);
    return false;
  }
}
