export interface UserData {
  count: number;
  wins: number;
  crowns: number;
  coins: number;
  miscount: number;
  boss: number;
  reactions: Record<string, boolean>;
  critBonus?: number;
  acrobatics?: number;
  royalty?: number;
}

export interface PersistedBoss {
  active: boolean;
  health: number;
  level: number;
  participants: Record<string, number>;
  rewards: BossReward;
  totalHealth: number;
  imagePath: string;
  imageName: string;
  bossName: string;
  levelText: string;
}

export interface DataSchema {
  number: number;
  users: Record<string, UserData>;
  last: string | null;
  channel: string | null;
  win: number;
  correctEmoji: string;
  incorrectEmoji: string;
  timeoutEmoji: string;
  boss: PersistedBoss | null;
}

export interface BossReward {
  crowns?: number;
  coins?: number;
}

export interface SkinConfig {
  price: number;
  description: string;
  enabled: boolean;
  emoji: string;
}

export interface PowerupConfig {
  price: number;
  description: string;
  quantified?: boolean;
  enabled: boolean;
}

export type Callback = (msg: string) => void;
export type ErrorCallback = (msg: string) => void;
