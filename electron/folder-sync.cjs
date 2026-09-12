const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const path = require('node:path');
let child, pending, serial = Promise.resolve();
function request(message) {
  if (!child) {
    const executable = path.join(__dirname, 'bin/slate-folder-sync').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    const running = child;
    createInterface({ input: running.stdout }).on('line', line => {
      if (!pending) return;
      const { resolve, reject, timer } = pending; pending = null; clearTimeout(timer);
      try { const response = JSON.parse(line); response.error ? reject(new Error(response.error)) : resolve(response.result); }
      catch (error) { reject(error); }
    });
    const fail = error => {
      if (child === running) child = null;
      if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = null; }
    };
    running.on('error', fail);
    running.on('exit', () => fail(new Error('The sync helper stopped. Changes remain saved locally.')));
    running.stderr.on('data', data => console.error('Folder sync:', String(data)));
    running.stdin.on('error', fail);
  }
  return new Promise((resolve, reject) => {
    pending = { resolve, reject, timer: setTimeout(() => child?.kill(), 45000) };
    child.stdin.write(JSON.stringify(message) + '\n');
  });
}
exports.exchange = message => {
  const result = serial.then(() => request(message));
  serial = result.catch(() => {});
  return result;
};
exports.close = () => child?.kill();
