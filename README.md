# pi-jjcommit

`pi-jjcommit` is a Pi package that adds `/jj-commit`.

- `/jj-commit` generates a commit message from current `jj` changes and commits.
- `/jj-commit provider/model` uses a specific model for that run.

## Install from Git

Global install (writes to `~/.pi/agent/settings.json`):

```bash
pi install git:github.com/yippiez/pi-jjcommit
```

Local/project install (writes to `.pi/settings.json` in the current repo):

```bash
pi install -l git:github.com/yippiez/pi-jjcommit
```

## Change default model

To change the fallback model used by `/jj-commit`, edit these constants in `extensions/jj-commit.ts`:

- `DEFAULT_MODEL_PROVIDER`
- `DEFAULT_MODEL_ID`

## Optional: Pin to a ref

Pin global install to `main`:

```bash
pi install git:github.com/yippiez/pi-jjcommit@main
```

Pin local install to `main`:

```bash
pi install -l git:github.com/yippiez/pi-jjcommit@main
```
