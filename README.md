# pi-jjcommit

`pi-jjcommit` is a Pi package that adds lightweight commit workflow commands:

- `/jj-commit` asks the current agent to commit the current changes with `jj` in logical chunks.
- `/git-commit` asks the current agent to commit the current changes with `git` in logical chunks.

These commands do not generate or run commits themselves. They simply send a detailed workflow prompt to the current Pi agent, including example command snippets.

You can add extra instructions after either command:

```text
/jj-commit only commit the docs changes
/git-commit split tests and implementation into separate commits
```

## Install both commands from Git

Global install (writes to `~/.pi/agent/settings.json`):

```bash
pi install git:github.com/yippiez/pi-jjcommit
```

Local/project install (writes to `.pi/settings.json` in the current repo):

```bash
pi install -l git:github.com/yippiez/pi-jjcommit
```

The package manifest loads the whole `extensions/` directory, so both extension files are installed together:

- `extensions/jj-commit.ts` → `/jj-commit`
- `extensions/git-commit.ts` → `/git-commit`

## Optional: Pin to a ref

Pin global install to `main`:

```bash
pi install git:github.com/yippiez/pi-jjcommit@main
```

Pin local install to `main`:

```bash
pi install -l git:github.com/yippiez/pi-jjcommit@main
```
