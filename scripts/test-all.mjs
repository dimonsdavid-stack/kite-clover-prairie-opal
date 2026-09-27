import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
function discover(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? discover(path) : /\.test\.(mjs|ts)$/.test(path) ? [path] : [];
  });
}
const files = [...discover('scripts'), ...discover('src')].sort();
if (!files.length) throw new Error('No tests discovered');
console.log(`Running every application test file (${files.length})`);
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...files], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
process.exit(result.status ?? 1);
