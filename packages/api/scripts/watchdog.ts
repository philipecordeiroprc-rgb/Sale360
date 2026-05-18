/**
 * Dev server watchdog — keeps the API alive across crashes and restarts.
 * Spawns tsx watch and restarts it if it dies unexpectedly.
 */
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MAX_RESTARTS = 10;
const RESTART_DELAY = 2000; // 2s between restarts
const RESTART_WINDOW = 30000; // 30s window for rate limiting

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const apiRoot = path.resolve(__dirname, '..');

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
      cwd: repoRoot,
    });
  } catch (err) {
    const msg = (err as any)?.stderr || (err as any)?.message || String(err);
    // EPERM on Windows: DLL locked by a running Node.js process — kill stale processes first
    if (msg.includes('EPERM') || msg.includes('operation not permitted')) {
      console.error('[watchdog] DLL locked by running process — killing stale node processes...');
      try {
        if (process.platform === 'win32') {
          // Find and kill only the process on port 3001
          const { stdout } = require('child_process').execSync(
            'netstat -ano | findstr ":3001" | findstr LISTENING',
            { stdio: 'pipe' }
          );
          const pid = String(stdout).trim().split(/\s+/).pop();
          if (pid && /^\d+$/.test(pid)) {
            execSync(`taskkill //F //PID ${pid}`, { stdio: 'ignore' });
          }
        } else {
          execSync('pkill -f "tsx watch.*src/index.ts" 2>/dev/null || true', { stdio: 'ignore' });
        }
        // Retry after killing
        setTimeout(() => {
          try {
            console.log('[watchdog] Retrying prisma generate...');
            execSync('pnpm --filter @sale360/db db:generate', { stdio: 'inherit', cwd: repoRoot });
          } catch {
            console.error('[watchdog] prisma generate failed again — continuing anyway');
          }
        }, 2000);
        return;
      } catch { /* best-effort */ }
    }
    console.error('[watchdog] prisma generate failed — retrying in 3s...');
    // Windows file lock race — retry once after a delay
    setTimeout(() => {
      try {
        execSync('pnpm --filter @sale360/db db:generate', { stdio: 'inherit', cwd: repoRoot });
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
    cwd: apiRoot,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  child.on('exit', (code, signal) => {
    // Only stop if the user intentionally pressed Ctrl+C (SIGINT/SIGTERM on the watchdog itself).
    // Any other exit (including code 0 from process.exit deep in the server) is a crash.
    if (shuttingDown) {
      console.log('[watchdog] Shutting down by user request.');
      process.exit(0);
    }
    console.error(`[watchdog] tsx watch exited unexpectedly (code=${code}, signal=${signal})`);
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
