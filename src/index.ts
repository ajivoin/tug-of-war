import { ActivityType } from 'discord.js';
import { config } from './config.ts';
import { createClient } from './bot/client.ts';
import { handleMessage } from './bot/router.ts';
import { createStore } from './store/store.ts';
import { loadState } from './store/json-file.ts';
import { getRandomInt } from './lib/random.ts';
import { constants } from './game/constants.ts';

const store = createStore(loadState(config.dataFile), { file: config.dataFile });
const client = createClient();

client.once('clientReady', () => {
  if (!Number.isInteger(store.getTarget())) {
    store.setTarget(getRandomInt(0, constants.WIN));
  }
  console.log('Logged in.');
  client.user?.setActivity(`${config.prefix}help`, { type: ActivityType.Listening });
});

client.on('messageCreate', (message) => {
  void handleMessage(client, store, message, config.prefix);
});

const shutdown = (): void => {
  store.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
// Docker sends SIGTERM on `compose down`; the legacy handler only caught SIGINT,
// so a container stop discarded up to five minutes of play.
process.on('SIGTERM', shutdown);

await client.login(config.token);
