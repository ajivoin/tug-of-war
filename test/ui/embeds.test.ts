import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createStore } from '../../src/store/store.ts';
import { createState } from '../../src/store/schema.ts';
import {
  inventoryEmbed, shopEmbed, userEmbed, infoEmbed, leaderboardEmbed,
  buildEmbeds, MAX_EMBED_FIELDS, MAX_DESCRIPTION,
} from '../../src/ui/embeds.ts';
import { skins } from '../../src/shop/skins.ts';

describe('embeds', () => {
  test('B10 regression: a user owning every skin renders without throwing', () => {
    const store = createStore(createState());
    store.ensureUser('collector');
    Object.keys(skins).forEach((s) => store.selectReaction('collector', s));
    assert.ok(Object.keys(skins).length > MAX_EMBED_FIELDS, 'catalog exceeds the cap');
    const embeds = inventoryEmbed(store, 'collector', 't?');
    embeds.forEach((e) => assert.ok((e.data.fields?.length ?? 0) <= MAX_EMBED_FIELDS));
    assert.ok((embeds[0]?.data.description?.length ?? 0) <= MAX_DESCRIPTION);
  });

  test('B10 regression: the inventory description lists every owned skin', () => {
    const store = createStore(createState());
    store.ensureUser('c');
    Object.keys(skins).forEach((s) => store.selectReaction('c', s));
    const description = inventoryEmbed(store, 'c', 't?')[0]?.data.description ?? '';
    Object.keys(skins).forEach((id) => {
      assert.ok(description.includes(`\`${id}\``), `missing ${id} from inventory`);
    });
  });

  test('B10 regression: the shop stays under the cap even with every skin enabled', () => {
    const embeds = shopEmbed('t?');
    embeds.forEach((e) => assert.ok((e.data.fields?.length ?? 0) <= MAX_EMBED_FIELDS));
    // Skins live in the description now, so the field count tracks powerups only.
    assert.ok((embeds[0]?.data.fields?.length ?? 0) <= 11, 'fields no longer scale with the skin catalog');
  });

  test('buildEmbeds chunks a field list beyond the cap', () => {
    const fields = Array.from({ length: 60 }, (_, i) => ({ name: `f${i}`, value: 'v', inline: true }));
    const embeds = buildEmbeds({ title: 'T', fields });
    assert.equal(embeds.length, 3);
    embeds.forEach((e) => assert.ok((e.data.fields?.length ?? 0) <= MAX_EMBED_FIELDS));
    assert.equal(embeds[0]?.data.title, 'T');
    assert.equal(embeds[1]?.data.title, 'T (cont.)');
  });

  test('an empty inventory renders a friendly message rather than an empty embed', () => {
    const store = createStore(createState());
    const embeds = inventoryEmbed(store, 'ghost', 't?');
    assert.equal(embeds.length, 1);
    assert.match(embeds[0]?.data.description ?? '', /Nothing yet/);
  });

  test('accuracy does not divide by zero for a brand new user', () => {
    const store = createStore(createState());
    const user = store.ensureUser('new');
    const embeds = userEmbed(user, 'New');
    const accuracy = embeds[0]!.data.fields?.find((f) => f.name === 'Accuracy');
    assert.equal(accuracy?.value, '—', 'legacy rendered NaN% here');
  });

  test('infoEmbed includes boss fields and a thumbnail when a boss is active', () => {
    const store = createStore(createState());
    store.setBoss({
      level: 2,
      health: 500,
      totalHealth: 1000,
      rewards: { crowns: 30, coins: 0 },
      participants: {},
      imagePath: path.join(import.meta.dirname, '..', '..', 'assets', 'boss-images', '501_bat.png'),
      imageName: '501_bat.png',
      bossName: 'Bat',
    });
    const { embeds, files } = infoEmbed(store);
    const first = embeds[0];
    assert.ok(first);
    assert.equal(files.length, 1);
    assert.equal(first.data.thumbnail?.url, 'attachment://501_bat.png');
    assert.ok(first.data.fields?.some((f) => f.value === 'Bat'));
  });

  test('infoEmbed degrades to text when the boss art file is missing', () => {
    const store = createStore(createState());
    store.setBoss({
      level: 2,
      health: 500,
      totalHealth: 1000,
      rewards: { crowns: 30, coins: 0 },
      participants: {},
      imagePath: '/nope/does-not-exist.png',
      imageName: 'does-not-exist.png',
      bossName: 'Bat',
    });
    const { embeds, files } = infoEmbed(store);
    assert.equal(files.length, 0, 'a missing file must not be handed to discord.js');
    assert.equal(embeds[0]?.data.thumbnail, undefined);
    assert.ok(embeds[0]?.data.fields?.some((f) => f.value === 'Bat'), 'the boss is still reported');
  });

  test('infoEmbed carries no attachment when there is no boss', () => {
    const store = createStore(createState());
    const { embeds, files } = infoEmbed(store);
    assert.equal(files.length, 0);
    assert.equal(embeds[0]?.data.fields?.length, 3);
  });

  test('leaderboard handles an empty server', () => {
    const store = createStore(createState());
    const embeds = leaderboardEmbed(store);
    assert.match(embeds[0]?.data.fields?.[0]?.value ?? '', /No scores yet/);
  });

  test('leaderboard ranks by the requested property', () => {
    const store = createStore(createState());
    store.ensureUser('a');
    store.ensureUser('b');
    store.incrementWins('a');
    store.incrementWins('a');
    store.incrementWins('b');
    const value = leaderboardEmbed(store, 'wins')[0]?.data.fields?.[0]?.value ?? '';
    assert.match(value, /1\. <@a>: 2/);
    assert.match(value, /2\. <@b>: 1/);
  });
});
