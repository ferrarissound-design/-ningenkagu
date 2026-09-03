// セーブデータの書き出し／読み込み（バックアップ・機種変更対応）のE2Eスモークテスト。
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test.describe('セーブデータの書き出し／読み込み', () => {
  test('書き出したファイルには進行データが入り、読み込むと別ブラウザ相当でも復元できる', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    // 実際に遊ばなくても再現できるよう、進行データを直接仕込む
    await page.evaluate(() => {
      localStorage.setItem('ningenkagu.rank.living', 'S');
      localStorage.setItem('ningenkagu.best.living', '2500');
      localStorage.setItem('ningenkagu.mission.living', '1');
    });

    await page.click('#btnConfig');
    await expect(page.locator('#btnExportSave')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#btnExportSave'),
    ]);
    expect(download.suggestedFilename()).toMatch(/^ningenkagu-save-\d{8}\.json$/);

    const path = await download.path();
    const content = JSON.parse(await fs.readFile(path, 'utf8'));
    expect(content.app).toBe('ningenkagu');
    expect(content.data['ningenkagu.rank.living']).toBe('S');
    expect(content.data['ningenkagu.best.living']).toBe('2500');

    // 別端末側にバックアップには存在しない冠がある状態から復元する。
    // 読み込み後に古い冠だけが合成されず、バックアップ時点へ正確に戻ることも確かめる。
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('ningenkagu.oniClear.living.watcher', '1');
    });

    // 確認ダイアログと完了アラートの両方を受け入れる
    page.on('dialog', (dialog) => dialog.accept());
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btnImportSave'),
    ]);
    await fileChooser.setFiles(path);

    await page.waitForEvent('load');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
    const restored = await page.evaluate(() => ({
      rank: localStorage.getItem('ningenkagu.rank.living'),
      best: localStorage.getItem('ningenkagu.best.living'),
      mission: localStorage.getItem('ningenkagu.mission.living'),
      staleCrown: localStorage.getItem('ningenkagu.oniClear.living.watcher'),
    }));
    expect(restored).toEqual({ rank: 'S', best: '2500', mission: '1', staleCrown: null });
  });

  test('別アプリのファイルや壊れたJSONは拒否され、既存データを上書きしない', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
    await page.evaluate(() => localStorage.setItem('ningenkagu.rank.living', 'A'));

    const badPath = path.join(os.tmpdir(), `ningenkagu-bad-save-${Date.now()}.json`);
    await fs.writeFile(badPath, JSON.stringify({ app: 'someOtherApp', data: { x: 1 } }));

    await page.click('#btnConfig');

    const messages = [];
    page.on('dialog', async (dialog) => {
      messages.push(dialog.message());
      await dialog.accept();
    });

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btnImportSave'),
    ]);
    await fileChooser.setFiles(badPath);

    await expect.poll(() => messages.length).toBeGreaterThan(0);
    expect(messages[0]).toContain('読み込めませんでした');

    // 拒否されたのでリロードは起きず、既存の値がそのまま残る
    await expect(page.locator('#cardConfig')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.rank.living'))).toBe('A');
  });
});
