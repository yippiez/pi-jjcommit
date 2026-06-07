# pi-jjcommit

`pi-jjcommit` is a Pi package that adds a lightweight jj commit workflow command:

- `/jj-commit` asks the current agent to commit the current changes with `jj` in logical chunks.

This command does not generate or run commits by itself. It sends a detailed workflow prompt to the current Pi agent, including example command snippets.

You can add extra instructions after the command:

```text
/jj-commit only commit the docs changes
```

## Install from Git

Global install (writes to `~/.pi/agent/settings.json`):

```bash
pi install git:github.com/yippiez/pi-jjcommit
```

Local/project install (writes to `.pi/settings.json` in the current repo):

```bash
pi install -l git:github.com/yippiez/pi-jjcommit
```

The package manifest loads the whole `extensions/` directory:

- `extensions/jj-commit.ts` → `/jj-commit`

## Optional: Pin to a ref

Pin global install to `main`:

```bash
pi install git:github.com/yippiez/pi-jjcommit@main
```

Pin local install to `main`:

```bash
pi install -l git:github.com/yippiez/pi-jjcommit@main
```
