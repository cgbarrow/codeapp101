# ADR 0001 · Use the npm `pa` CLI on macOS, not `pac`

**Status:** Accepted, 17 September 2026 · **Context:** tasks 1 and 4

## Context

Power Apps code apps are created and pushed with a command-line tool. Most published material,
including Microsoft Learn pages written for the preview, tells you to install the .NET-based
**Power Platform CLI** (`pac`) and run `pac code init`. That tool is Windows-first, and its `code`
verb no longer exists. The build machine for this project is a Mac.

## Decision

Use **`@microsoft/power-apps-cli`**, invoked as **`pa`**, installed from npm as a dev dependency and
pinned (1.0.2). Every code-app command in this repository is a `pa` command:

```bash
npx pa auth login
npx pa app init --display-name "Simple Todo" --environment-id <environment>
npx pa app add data-source --connector dataverse --table <table>
npx pa app push
```

## Consequences

- The toolchain is npm-only. No .NET SDK, no Windows VM, and CI can install it with `npm ci`.
- Instructions found online that use `pac code …` do not work and must be translated. The how-to
  article says so in its troubleshooting section, because this cost real time.
- `pa auth login` opens a browser, so the first sign-in is manual. Everything after it is scriptable.
- The CLI resolves an environment by its **environment id**, not the tenant id. The id used here is
  `Default-dc087386-56cb-4425-82f3-4b2dd04d62d8`; the bare GUID is the tenant and fails to resolve.
- Pinning matters: this CLI is young, and an unpinned upgrade can change generated output.
