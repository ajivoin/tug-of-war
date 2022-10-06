import _ from 'underscore';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';

import utils from './utils';
import data from './data';
import constants from './constants';

// const IMAGE_PATH = [ // old images
//   [
//     'util/boss_images/0_sunglasses.png',
//     'util/boss_images/5_clown.png',
//     'util/boss_images/6_poop.png',
//   ],
//   [
//     'util/boss_images/1_ogre.png',
//     'util/boss_images/2_monster.png',
//     'util/boss_images/3_ghost.png',
//   ],
//   [
//     'util/boss_images/9_cowboy.png',
//     'util/boss_images/10_bezos.png',
//     'util/boss_images/15_rock.png',
//     // 'util/boss_images/11_santa.png',
//     // 'util/boss_images/14_snowman.png',
//   ],
//   [
//     'util/boss_images/7_devil.png',
//     'util/boss_images/8_goblin.png',
//     'util/boss_images/401_prankster.png',
//   ],
//   [
//     'util/boss_images/4_dragon.png',
//     'util/boss_images/7_devil.png',
//   ],
//   [
//     'util/boss_images/12_sun.png',
//     'util/boss_images/13_moon.png',
//   ],
// ];
// const IMAGE_PATH = [
//   [
//     'util/boss_images/17_snail.png',
//     'util/boss_images/19_bloon.png',
//     'util/boss_images/24_blurtle.png',
//   ],
//   [
//     'util/boss_images/21_scorpion.png',
//     'util/boss_images/30_monke.png',
//     'util/boss_images/20_crab.png',
//   ],
//   [
//     'util/boss_images/27_poodle.png',
//     'util/boss_images/25_whale.png',
//     'util/boss_images/29_fox.png',
//   ],
//   [
//     'util/boss_images/16_crocodile.png',
//     'util/boss_images/23_octopus.png',
//   ],
//   [
//     'util/boss_images/2_monster.png',
//     'util/boss_images/26_eagle.png',
//   ],
//   [
//     'util/boss_images/22_whale.png',
//     'util/boss_images/4_dragon.png',
//   ],
// ];
const IMAGE_PATH = [
  [
    'util/boss_images/503_roach.png',
    'util/boss_images/505_worm.png',
  ],
  [
    'util/boss_images/501_bat.png',
    'util/boss_images/502_owl.png',
    'util/boss_images/504_spider.png',
  ],
  [
    'util/boss_images/500_troll.png',
    'util/boss_images/506_skeleton.png',
    'util/boss_images/507_ogre.png',
    'util/boss_images/510_zombie.png',
  ],
  [
    'util/boss_images/508_ghost.png',
    'util/boss_images/509_alien.png',
    'util/boss_images/512_cat.png',
    'util/boss_images/513_jack.png',
  ],
  [
    'util/boss_images/511_floater.png',
  ],
];

const BOSS_REWARDS_POOL = [
  { crowns: 15 },
  { crowns: 30 },
  { crowns: 45 },
  { crowns: 60 },
  { crowns: 75 },
  { crowns: 100 },
];
const BOSS_HEALTH_MULTIPLIER = 100 * constants.BASE_DAMAGE;

export default class Boss {
  static instance;

  static REWARDS_POOL = BOSS_REWARDS_POOL;

  static HEALTH_MULTIPLIER = BOSS_HEALTH_MULTIPLIER;

  static BOSS_BREAKPOINTS = [
    0.30,
    0.55,
    0.80,
    0.95,
    0.99,
    1.0,
  ];

  static kill() {
    Boss.instance.handleWin(null);
  }

  static load() {
    if (!Boss.instance) {
      const boss = data.getBoss();
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
        Boss.instance.levelText = '🦴'.repeat(boss.level);
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
    const file = new AttachmentBuilder(this.imagePath);
    const embedBuilder = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Boss battle!')
      .setDescription(`Count numbers to pet the ${this.bossName}! All participants will receive a reward!`)
      .addFields([
        {
          name: 'Name',
          value: this.bossName,
        },
        {
          name: 'Level',
          value: this.levelText,
        },
        {
          name: 'Anger',
          value: `${this.health} 💢`,
        },
      ])
      .setImage(`attachment://${this.imageName}`);
    return { embeds: [embedBuilder], files: [file] };
  }

  constructor() {
    const odds = Math.random();
    let bp = 0;
    while (odds > Boss.BOSS_BREAKPOINTS[bp]) bp += 1;
    this.level = bp + 1;
    this.rewards = Boss.REWARDS_POOL[bp];
    if (this.level <= 5) {
      this.levelText = '⭐'.repeat(this.level);
      this.health = this.level * Boss.HEALTH_MULTIPLIER;
    } else if (this.level <= 10) {
      this.levelText = '💀'.repeat(this.level - 5);
      this.health = this.level * Boss.HEALTH_MULTIPLIER * 1.5;
    }
    this.totalHealth = this.health;
    this.participants = {};
    this.active = true;
    this.imagePath = _.sample(IMAGE_PATH[bp]);
    [, , this.imageName] = this.imagePath.split('/');
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
    if (userId) data.addCrowns(userId, 5 + data.getRoyalty(userId)); // bonus for last hit
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
    const crit = Math.random() < (constants.CRIT_RATE
      + (data.getCritBonus(userId) ?? 0) * constants.CRIT_BONUS);
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
