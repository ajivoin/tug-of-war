import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.DISCORD_TOKEN = 'test-token';
const { skins } = await import('../../util/shop/items/skins.js');
const embeds = (await import('../../util/embeds.js')).default;

describe('legacy embeds', () => {
  test('B10: inventory throws for a user owning more than 25 reactions', () => {
    const reactions = {};
    Object.keys(skins).forEach((k) => { reactions[k] = false; });
    reactions.default = true;
    assert.ok(Object.keys(reactions).length > 25, 'catalog is large enough to overflow');
    assert.throws(
      () => embeds.inventoryEmbedForUser({ reactions }),
      /lessThanOrEqual|Invalid number value/,
      'documents the production crash',
    );
  });

  test('the shop embed is currently under the cap but has little headroom', () => {
    const built = embeds.shopEmbed.data.fields.length;
    assert.ok(built <= 25);
    assert.ok(built >= 15, `at ${built} of 25 - enabling retired skins would break t?shop`);
  });
});
