/**
 * URL for the HeadTTS worker module, served from public/headtts/.
 *
 * HeadTTS internally does `new Worker(new URL("./worker-tts.mjs", import.meta.url))`
 * but Vite can't process that pattern inside node_modules because:
 * 1. Vite pre-bundles deps, mangling import.meta.url
 * 2. The worker's relative imports (./utils.mjs, ./language-*.mjs) can't resolve
 *
 * Solution: copy the worker files to public/headtts/ and pass this URL via
 * HeadTTS's `workerModule` config. HeadTTS creates a blob worker that does
 * `import "<url>"`, and since the URL is a full path, the worker's relative
 * imports resolve correctly against the public directory.
 */
const workerUrl = '/headtts/worker-tts.mjs';
export default workerUrl;
