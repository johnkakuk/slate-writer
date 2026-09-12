// Run after npm run build && npm run sync:helper. See SYNC.md for prerequisites.
const { _electron: electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { mkdtemp, mkdir, readdir, copyFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';
import { createLibrary, enableSync, checkpoint } from '../src/sync/model.js';
globalThis.crypto ??= webcrypto;
const repository = process.cwd();
const root = await mkdtemp('/private/tmp/slate-sync-integration-');
const project = { id:'test-project',name:'Sync Test',titlePage:{title:'Sync Test'},acts:[{id:'act1',title:'ACT I',cards:[{id:'card1',title:'Shared scene',description:'',isFlagged:false,sceneDoc:{type:'doc',content:[{type:'action',attrs:{id:'block1'},content:[{type:'text',text:'Original writing'}]}]}}]}],docTypes:[{id:'notes',pluralLabel:'Notes',singularLabel:'Note',template:'',docs:[{id:'note1',content:'# Shared note\n\nOriginal note'}]}]};
const initial = checkpoint(enableSync(createLibrary({[project.id]:project})), 'Seed', ()=> 'seed-revision');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const apps=[],errors=[];
async function launch(name) {
 const profile=`${root}/${name}-profile`,folder=`${root}/${name}-folder`;
 await mkdir(profile);await mkdir(folder);
 const state={projects:initial.projects,sync:{...initial.sync,deviceId:crypto.randomUUID()},currentProjectId:project.id};
 const seed=`${root}/${name}.json`;await writeFile(seed,JSON.stringify(state));
 execFileSync('python3',['-c',`import sqlite3,sys\nc=sqlite3.connect(sys.argv[1]);c.execute('CREATE TABLE kv(key TEXT PRIMARY KEY,value TEXT)');c.executemany('INSERT INTO kv VALUES(?,?)',[('state',open(sys.argv[2]).read()),('icloudFolder',sys.argv[3])]);c.commit()`,`${profile}/slate-writer.db`,seed,folder]);
 const app=await electron.launch({executablePath:process.env.SLATE_ELECTRON_EXECUTABLE || `${repository}/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`,args:[...(process.env.SLATE_ELECTRON_EXECUTABLE ? [] : ['.']),`--user-data-dir=${profile}`],cwd:repository,env});apps.push(app);
 assert.equal(await app.evaluate(({app})=>app.getPath('userData')),profile);
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));
 await page.locator('.app').waitFor();
 await page.waitForFunction(()=>document.querySelector('.sidebar-sync-status')?.textContent === 'Folder up to date',{},{timeout:15000});
 assert.match(await page.locator('.sidebar-foot').innerText(), /Autosaved/);
 assert.equal(await page.locator('.sync-notice').count(), 0);
 return {app,page,profile,folder};
}
async function state(device) { return device.page.evaluate(()=>JSON.parse(window.slateStorage.loadSync())); }
async function openScene(d) {await d.page.locator('[title="Open in Editor"]').first().click();await d.page.locator('.ProseMirror').waitFor();}
async function append(d,text){ const pm=d.page.locator('.ProseMirror');await pm.click();await d.page.keyboard.press('Meta+End');await d.page.keyboard.insertText(text); }
async function waitText(d,text){await d.page.waitForFunction(t=>JSON.parse(window.slateStorage.loadSync()).projects['test-project'].acts[0].cards[0].sceneDoc.content.some(n=>n.content?.some(c=>c.text?.includes(t))),text);}
async function replicate(from,to) {for(const name of await readdir(`${from.folder}/Slate Revisions`)) await copyFile(`${from.folder}/Slate Revisions/${name}`,`${to.folder}/Slate Revisions/${name}`);}
try {
 const a=await launch('A'),b=await launch('B');console.log('Both isolated apps loaded and native helpers exchanged revisions');
 await openScene(a);await append(a,' from iPad');await waitText(a,'from iPad');
 await openScene(b);await append(b,' from Mac');await waitText(b,'from Mac');
 await a.page.waitForFunction(()=>Object.keys(JSON.parse(window.slateStorage.loadSync()).sync.pending).length===0);
 await b.page.waitForFunction(()=>Object.keys(JSON.parse(window.slateStorage.loadSync()).sync.pending).length===0);
 // Wait until those immutable checkpoints have reached their separate folders.
 await new Promise(r=>setTimeout(r,2500));await replicate(a,b);await replicate(b,a);
 await a.page.locator('.sync-notice button').filter({hasText:'conflicting document'}).waitFor({timeout:15000});
 await b.page.locator('.sync-notice button').filter({hasText:'conflicting document'}).waitFor({timeout:15000});
 assert.match(await a.page.locator('.ProseMirror').innerText(),/from iPad/);assert.match(await b.page.locator('.ProseMirror').innerText(),/from Mac/);
 assert.equal(await a.page.locator('.sync-view').getAttribute('inert'),'');
 console.log('Concurrent edits retained both versions and guarded the conflicted editor');
 await a.page.locator('.nav-settings .nav-item').click();
 const branch=a.page.locator('.sync-conflict .sync-revision').filter({has: a.page.locator('pre').filter({hasText:'from Mac'})});
 await branch.getByRole('button',{name:'Use This and Keep Both',exact:true}).click();
 await a.page.waitForFunction(()=>Object.keys(JSON.parse(window.slateStorage.loadSync()).projects).length===2);
 await a.page.waitForFunction(()=>Object.keys(JSON.parse(window.slateStorage.loadSync()).sync.pending).length===0);
 await new Promise(r=>setTimeout(r,2500));await replicate(a,b);
 await b.page.waitForFunction(()=>!document.querySelector('.sync-notice')?.textContent.includes('conflicting document'),{},{timeout:15000});
 assert.match(await b.page.locator('.ProseMirror').innerText(),/from Mac/);
 assert.equal(Object.keys((await state(b)).projects).length,2);
 console.log('Keep Both resolved the conflict, propagated the chosen scene, and retained a recovered copy');
 // Reconnect B to A's actual folder through the native picker IPC, mocked only at dialog selection.
 await b.app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},a.folder);
 await b.page.locator('.nav-settings .nav-item').click();await b.page.getByRole('button',{name:'Change Folder…'}).click();
 await b.page.waitForFunction(folder=>document.querySelector('.sync-folder')?.textContent.includes(folder),a.folder);
 // Navigate both devices back to the same scene via Outline.
 await a.page.getByText('Outline / Beats',{exact:true}).first().click();await openScene(a);
 await b.page.getByText('Outline / Beats',{exact:true}).first().click();await openScene(b);
 await b.page.getByRole('button',{name:'Continue Here'}).waitFor({timeout:15000});
 await b.page.getByRole('button',{name:'Continue Here'}).click();
 await a.page.getByRole('button',{name:'Continue Here'}).waitFor({timeout:15000});
 await b.page.waitForFunction(()=>!document.querySelector('.sync-view')?.hasAttribute('inert'));
 await append(b,' handoff');await waitText(b,'handoff');
 await a.page.waitForFunction(()=>document.querySelector('.ProseMirror')?.textContent.includes('handoff'),{},{timeout:15000});
 console.log('Presence warning, explicit takeover, and remote editor refresh passed');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({root,rendererErrors:errors,projects:Object.keys((await state(a)).projects).length}));
} finally {for(const app of apps.reverse())await app.close();}
