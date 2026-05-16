import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    // cubing/search excluded so its Worker URL resolves relative to node_modules
    // (pre-bundling would move it to .vite/deps/ where search-worker-entry.js doesn't exist)
    //
    // random-uint-below also excluded: even with it in `include`, Vite triggers a dep
    // re-optimisation reload when the cubing search Worker first requests the @fs/ chunk
    // files that import it, killing the Worker before it posts "comlink-exposed".
    // Excluding it entirely prevents Vite from ever queuing a reload for this dep.
    exclude: ['cubing/search', 'random-uint-below'],
    // Pre-bundle cubing/alg for the main-thread module graph (CubeState, AlgParser).
    // It is only imported via relative chunk paths inside the Worker, so it never
    // triggers a Vite reload in that context.
    include: ['cubing/alg'],
  },
});
