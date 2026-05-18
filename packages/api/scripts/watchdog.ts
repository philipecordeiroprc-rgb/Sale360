/**
 * Dev server watchdog — keeps the API alive across crashes and restarts.
 * Spawns tsx watch and restarts it if it dies unexpectedly.
 */
import { spawn, execSync } from 'child_process';

const MAX_RESTARTS = 10;
const RESTART_DELAY = 2000; // 2s between restarts
const RESTART_WINDOW = 30000; // 30s window for rate limiting

let restarts = 0;
let windowStart = Date.now();
let shuttingDown = false;

// Only stop the watchdog when the user explicitly asked to stop (Ctrl+C)
process.on('SIGTERM', () => { shuttingDown = true; });
process.on('SIGINT', () => { shuttingDown = true; });

function runPredev() {
  try {
    console.log('[watchdog] Running prisma generate...');
    execSync('pnpm --filter @sale360/db db:generate', {
      stdio: 'inherit',
      cwd: new URL('..', import.meta.url).pathname,
    });
  } catch {
    console.error('[watchdog] prisma generate failed — retrying in 3s...');
    // Windows file lock race — retry once after a delay
    setTimeout(() => {
      try {
        execSync('pnpm --filter @sale360/db db:generate', { stdio: 'inherit' });
      } catch {
        console.error('[watchdog] prisma generate failed again — continuing anyway');
      }
    }, 3000);
  }
}

function spawnWatch() {
  if (Date.now() - windowStart > RESTART_WINDOW) {
    restarts = 0;
    windowStart = Date.now();
  }

  if (restarts >= MAX_RESTARTS) {
    console.error(`[watchdog] ${MAX_RESTARTS} restarts in ${RESTART_WINDOW / 1000}s — giving up.`);
    process.exit(1);
  }

  restarts++;
  console.log(`[watchdog] Starting tsx watch (attempt ${restarts}/${MAX_RESTARTS})...`);

  const child = spawn('npx', ['tsx', 'watch', 'src/index.ts'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  child.on('exit', (code, signal) => {
    if (signal === 'SIGTERM' || signal === 'SIGINT' || code === 0) {
      console.log('[watchdog] Clean exit. Stopping.');
      process.exit(0);
    }
    console.error(`[watchdog] tsx watch exited with code ${code}, signal ${signal}`);
    console.log(`[watchdog] Restarting in ${RESTART_DELAY / 1000}s...`);
    setTimeout(spawnWatch, RESTART_DELAY);
  });

  child.on('error', (err) => {
    console.error('[watchdog] Failed to spawn tsx:', err.message);
    setTimeout(spawnWatch, RESTART_DELAY);
  });
}

// Run predev first, then spawn watch
runPredev();
spawnWatch();
