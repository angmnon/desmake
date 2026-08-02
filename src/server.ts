import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

// Production mode is enabled when NODE_ENV=production (set by `next build`
// and by scripts/start.sh). COZE_PROJECT_ENV=PROD is kept for backwards
// compatibility with the Coze deploy environment.
const dev = process.env.NODE_ENV !== 'production' && process.env.COZE_PROJECT_ENV !== 'PROD';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '5000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('Internal server error');
      }
    });
    server.once('error', err => {
      console.error(err);
      process.exit(1);
    });

    // R2/M15: without SIGTERM/SIGINT handling the process is SIGKILLed by the
    // orchestrator after the grace period, cutting in-flight requests mid-response.
    const shutdown = (signal: string) => {
      console.log(`> ${signal} received, closing server…`);
      server.close(err => {
        if (err) {
          console.error('Error during shutdown', err);
          process.exit(1);
        }
        process.exit(0);
      });
      // Hard cap: never hang forever waiting on keep-alive sockets.
      setTimeout(() => process.exit(0), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    server.listen(port, () => {
      console.log(
        `> Server listening at http://${hostname}:${port} as ${
          dev ? 'development' : process.env.COZE_PROJECT_ENV
        }`,
      );
    });
  })
  // R2/M15: a rejected app.prepare() used to surface only as an unhandled promise
  // rejection — the process stayed alive with no server listening.
  .catch(err => {
    console.error('Failed to prepare Next.js app', err);
    process.exit(1);
  });
