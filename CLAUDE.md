# Slate Writer

## Testing the Electron build — NEVER use the default userData dir

The packaged/dev Electron app and a Playwright-driven test launch of that
same app are indistinguishable to Electron: both call `app.setName('Slate
Writer')` (see `electron/main.cjs`), so both resolve to the exact same
userData directory, `~/Library/Application Support/Slate Writer`. That
directory holds the real SQLite database (`slate-writer.db`) the user
actually writes to.

A prior session ran automated tests directly against that directory and
`rm -rf`'d it between runs as "cleanup," without checking whether the user
had since opened the real app and written real content into it. That
destroyed roughly 10 minutes of the user's actual work. Do not repeat this.

**Every automated Electron launch (Playwright `_electron.launch`, or a
direct binary invocation) MUST pass an isolated profile directory**, e.g.:

```js
await electron.launch({
  args: ['.', `--user-data-dir=/private/tmp/.../isolated-profile`],
  cwd, env, executablePath,
});
```

`--user-data-dir` is a standard Electron/Chromium switch honored before any
app code runs — it redirects the *entire* userData tree (SQLite db,
localStorage, cache, everything), verified empirically: the real directory's
mtime is untouched by a launch using this flag. Use a scratch path under
`/private/tmp/...` (or the session's own scratchpad dir), never the app's
real path, and it's safe to `rm -rf` that scratch path freely since it's
never the user's real data.

If a test ever needs to start from the user's *actual* current state
(rare), copy the real directory to a scratch location first and test
against the copy — never operate on the original, even read-only tests,
since a test crash or an errant write is not worth the risk.
