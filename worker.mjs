import { Container, getContainer } from "@cloudflare/containers";

// The container runs `node dist/server.js` (the custom Next.js server) and
// listens on PORT (3000). We pin every request to one container instance so the
// process-memory session/order store is shared for the whole site.
export class DesmakeContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "10m";
}

export default {
  async fetch(request, env) {
    const container = getContainer(env.DESMAKE, "desmake");
    return container.fetch(request);
  },
};
