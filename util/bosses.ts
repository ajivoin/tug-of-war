import _ from 'underscore';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';

import utils from './utils.js';
import data from './data.js';
import constants from './constants.js';
import { BossReward, PersistedBoss } from './types.js';

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

const BOSS_REWARDS_POOL: BossReward[] = [
  { crowns: 15 },
  { crowns: 30 },
  { crowns: 45 },
  { crowns: 60 },
  { crowns: 75 },
  { crowns: 100 },
];
const BOSS_HEALTH_MULTIPLIER = 100 * constants.BASE_DAMAGE;

export default class Boss {
  static instance: Boss | null = null;

  static REWARDS_POOL: BossReward[] = BOSS_REWARDS_POOL;

  static HEALTH_MULTIPLIER: number = BOSS_HEALTH_MULTIPLIER;

  static BOSS_BREAKPOINTS: number[] = [
    0.30,
    0.55,
    0.80,
    0.95,
    0.99,
    1.0,
  ];

  active: boolean = false;

  health: number = 0;

  level: number = 0;

  totalHealth: number = 0;

  participants: Record<string, number> = {};

  rewards: BossReward = {};

  imagePath: string = '';

  imageName: string = '';

  bossName: string = '';

  levelText: string = '';

  static kill(): void {
    Boss.instance?.handleWin(null);
  }

  static load(): void {
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

  static instantiate(): Boss {
    if (!Boss.instance) {
      Boss.instance = new Boss();
    }
    return Boss.instance;
  }

  get embed(): { embeds: EmbedBuilder[]; files: AttachmentBuilder[] } {
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
    this.imagePath = _.sample(IMAGE_PATH[bp]) as string;
    [, , this.imageName] = this.imagePath.split('/');
    const [, bossName] = this.imageName.split(/[_|.]/);
    this.bossName = bossName[0].toUpperCase() + bossName.slice(1);
  }

  toPersisted(): PersistedBoss {
    return {
      active: this.active,
      health: this.health,
      level: this.level,
      participants: this.participants,
      rewards: this.rewards,
      totalHealth: this.totalHealth,
      imagePath: this.imagePath,
      imageName: this.imageName,
      bossName: this.bossName,
      levelText: this.levelText,
    };
  }

  calculateReward(userId: string): BossReward {
    const ratio = this.participants[userId] / this.totalHealth;
    const result: BossReward = {};
    (Object.keys(this.rewards) as (keyof BossReward)[]).forEach((reward) => {
      result[reward] = Math.ceil(ratio * (this.rewards[reward] ?? 0));
    });
    return result;
  }

  distributeRewards(): void {
    Object.keys(this.participants).forEach((userId) => {
      const reward = this.calculateReward(userId);
      if (utils.hasProperty(reward, 'crowns') && reward.crowns !== undefined) {
        data.addCrowns(userId, reward.crowns);
      }
      if (utils.hasProperty(reward, 'coins') && reward.coins !== undefined) {
        data.addCoins(userId, reward.coins);
      }
    });
  }

  handleWin(userId: string | null): void {
    this.distributeRewards();
    if (userId) data.addCrowns(userId, 5 + data.getRoyalty(userId)); // bonus for last hit
    this.active = false;
    Boss.instance = null;
  }

  bomb(userId: string): boolean {
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
    data.persistBoss(this.toPersisted());
    return false;
  }

  hit(userId: string, critCallback: () => void): boolean {
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
      this.handleWin(userId);
      return true;
    }
    if (crit) critCallback();
    data.persistBoss(this.toPersisted());
    return false;
  }
}
