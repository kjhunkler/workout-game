import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(`${directory}/${entry.name}`)
          : `${directory}/${entry.name}`,
      ),
    )
  ).flat();
}
const paths = (await files("dist")).sort();
const hash = createHash("sha256");
for (const path of paths) hash.update(await readFile(path));
const version = hash.digest("hex").slice(0, 12);
const assets = ["./", ...paths.map((path) => `./${path.slice(5)}`)];
await writeFile(
  "dist/sw.js",
  `
const CACHE = 'blob-club-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('blob-club-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => { if (event.data === 'activate') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request, { ignoreSearch: event.request.mode === 'navigate' });
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (error) {
      if (event.request.mode === 'navigate') return cache.match('./');
      throw error;
    }
  }));
});
`,
);
console.log(`Offline cache ${version}: ${assets.length} assets`);
