import { startStaticServer, stopStaticServer } from '../../scripts/static-server.mjs';

const PORT = 8123;
const URL = `http://127.0.0.1:${PORT}/index.html`;

export default async function globalSetup() {
  // 手元ですでに開発サーバーが動いている場合は、それを再利用する。
  try {
    const response = await fetch(URL);
    if (response.ok) return undefined;
  } catch (error) {
    // 未起動なら、このテストプロセス内で下のサーバーを立てる。
  }

  const server = await startStaticServer({ root: process.cwd(), port: PORT });
  return async () => stopStaticServer(server);
}
