// Fail fast when someone installs with npm/yarn instead of pnpm.
//
// Wired as the `preinstall` script. Deliberately dependency-free (a plain node
// one-liner wrapped in a file) rather than `npx only-allow pnpm`: `preinstall`
// runs BEFORE dependencies are installed, so `npx` would have to download
// only-allow from the network on a cold install — an extra failure mode in CI.

const ua = process.env.npm_config_user_agent || "";
const isPnpm = /(^|\s)pnpm\//.test(ua);

if (!isPnpm && ua) {
  console.error(
    "\nThis project uses pnpm. Run `pnpm install` instead of npm/yarn.\n" +
      "(Set the package manager to pnpm — a mixed package-lock.json/pnpm-lock.yaml\n" +
      "state causes the Cloudflare build to resolve different dependency trees.)\n",
  );
  process.exit(1);
}
