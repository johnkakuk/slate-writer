// macOS integration test for the shared Swift file-coordination implementation.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = await mkdtemp('/private/tmp/slate-native-sync-');
const helper = spawn('./electron/bin/slate-folder-sync', [], { stdio: ['pipe', 'pipe', 'inherit'] });
const lines = createInterface({input:helper.stdout})[Symbol.asyncIterator]();
async function exchange(request={}) {
  helper.stdin.write(JSON.stringify({folder:root,known:[],records:[],...request})+'\n');
  const line=await lines.next();assert.equal(line.done,false);return JSON.parse(line.value);
}
try {
  assert.ok((await exchange()).result);
  assert.ok((await exchange()).result); // Existing directories must remain writable.
  const json=JSON.stringify({id:'test',writing:'Kept exactly'});
  const written=await exchange({records:[{id:'test',json}],presence:{device:'test-device',key:'scene',expiresAt:123}});
  assert.deepEqual(written.result.records,[json]);assert.equal(written.result.leases.length,1);
  assert.deepEqual((await exchange({known:['test']})).result.records,[]);
  assert.ok((await exchange({records:[{id:'test',json}]})).result); // Retry is idempotent.
  assert.ok((await exchange({records:[{id:'test',json:'changed'}]})).error);
  assert.equal(await readFile(`${root}/Slate Revisions/test.json`,'utf8'),json);
  assert.ok((await exchange({records:[{id:'../escape',json}]})).error);
  const legacy='{"id":"older-project"}';await writeFile(`${root}/older.slatewriter`,legacy);
  assert.deepEqual((await exchange({includeLegacy:true})).result.legacy,[legacy]);
  assert.equal(await readFile(`${root}/older.slatewriter`,'utf8'),legacy);
  console.log(`Native coordinated writes, reads, retries, legacy preservation, and path checks passed: ${root}`);
} finally {helper.stdin.end();helper.kill();}
