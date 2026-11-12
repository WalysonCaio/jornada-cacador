import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const files = readdirSync(new URL('.', import.meta.url)).filter(f => /^(test-|validate-).*\.mjs$/.test(f) && f !== 'test-all.mjs').sort();
let failures = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(file, import.meta.url))], {stdio: 'inherit'});
  if (result.error || result.status !== 0) failures++;
}
console.log(`${files.length - failures}/${files.length} scripts passaram.`);
process.exitCode = failures ? 1 : 0;
