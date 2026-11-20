import { cp, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const scripts = ['main', 'model', 'cloud', 'ui', 'views'].map(name => 'app/' + name + '.js');
for (const file of [...scripts, 'sw.js']) {
  const check = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (check.status !== 0) process.exit(1);
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const file of ['index.html','icon.svg','manifest.webmanifest','sw.js','app','assets']) {
  await cp(file, 'dist/' + file, { recursive: true });
}
