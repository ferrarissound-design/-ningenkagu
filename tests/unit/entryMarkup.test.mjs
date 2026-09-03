import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlUrl = new URL('../../index.html', import.meta.url);

test('stage buttons are not duplicated in static HTML', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  assert.doesNotMatch(html, /data-stage=/, 'stage buttons should be generated from the stage registry');
});

test('entry page does not load furnitureTraits as a separate side-effect module', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  assert.doesNotMatch(html, /src=["']js\/furnitureTraits\.js["']/);
  assert.match(html, /src=["']js\/main\.js["']/);
});

test('training mode is present but locked by default', async () => {
  const html = await readFile(htmlUrl, 'utf8');
  assert.match(html, /id="btnTraining"[^>]*class="mbtn hidden"/);
  for (const id of ['watcher', 'charger', 'suspicious']) {
    assert.match(html, new RegExp(`data-oni-training="${id}"`));
  }
});
