import { startStaticServer, stopStaticServer } from './static-server.mjs';

const root = process.cwd();
const port = Number.parseInt(process.argv[2] || process.env.PORT || '8000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid port: ${process.argv[2] || process.env.PORT}`);
}

const server = await startStaticServer({ root, port });
console.log(`Serving ${root} at http://127.0.0.1:${port}`);

async function shutdown() {
  await stopStaticServer(server);
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
process.once('SIGHUP', shutdown);
