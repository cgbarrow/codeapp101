# How to build a Power Apps code app with React, Dataverse and the `pa` CLI

*A working log of building "Simple Todo", a personal task app hosted on Microsoft Power Platform.*

Last updated: 2026-09-17 · Status: **Part 1 of 4 complete** (planning and data layer)

---

## Overview

Power Apps **code apps** let you write an ordinary React single-page application, deploy it into a Power Platform environment, and get Microsoft Entra authentication, Dataverse access and your organisation's governance policies without building any of it yourself. You keep full control of the UI. The platform handles identity, hosting and data.

This article is the running log of building one such app end to end. The app is a personal todo list: fast capture with natural-language dates, multiple lists, due dates and reminders, recurring tasks, subtasks, and a Today view. It stores everything in three custom Dataverse tables and runs in a browser on phone, tablet and desktop.

The log is written as we go, so it records what actually happened, including the two failed imports and what fixed them. Where a step went wrong, the fix is in Troubleshooting rather than quietly smoothed out of the procedure.

**Who this is for.** Developers comfortable with React and TypeScript who have not shipped a Power Platform app before. No low-code experience is assumed. Power Platform administrators will find the environment and permission sections useful on their own.

> **Where this build ran, and why it matters.** Everything below was done in a personal Microsoft 365 developer tenant, in a Power Platform environment with no data loss prevention policies, no environment group rules, no Managed Environment controls and no conditional access. Every setting was mine to change and every connector was available.
>
> That is not where most teams work. In a corporate tenant the same steps run into governance controls that are working exactly as intended, and the fix is a conversation with your platform team rather than a change you make yourself. The section below names each control, says where it bites, and gives you the specific ask to raise.



**What this article covers so far:**

| Part | Scope | Status |
|---|---|---|
| 1 | Specification, plan, Dataverse schema, environment setup | Complete |
| 2 | Project scaffold, design system, data layer, CLI wiring | Not started |
| 3 | Feature build: lists, tasks, capture, Today, recurrence, reminders | Not started |
| 4 | Publish, share, smoke test, and what comes after | Not started |

**A note on terminology.** Two different command-line tools sound alike. `pac` is the older .NET Power Platform CLI, distributed as an MSI on Windows and through a Visual Studio Code extension elsewhere. `pa` is the newer npm-based Power Apps CLI that became generally available in August 2026 and replaced the `pac code` command group entirely. Code apps use `pa`. Because it is an npm package, it runs anywhere Node.js does, including macOS, with no extension required. Articles written before mid-2026 will show `pac code` commands that no longer exist.

---

## Prerequisites

### Accounts and licensing

- A Microsoft 365 tenant. A Microsoft 365 developer tenant works and is what this build used.
- A **Power Apps Premium** licence for every user who will run the finished app. Developer tenants normally include enough seats for testing.
- The **System Administrator** security role on the target Power Platform environment. Importing a solution creates tables, and table creation requires it. Most developers building code apps already hold this role, so this is usually a box already ticked rather than a step. Confirm it before you start, because the failure arrives forty seconds into an import rather than up front.

  Note that this is an environment-level Dataverse role, not a tenant administrator role. The two are independent: a Microsoft 365 Global Administrator can enable code apps on an environment and still be unable to import a solution into it.

### Environment

- A Power Platform environment with Dataverse provisioned.
- **Code apps enabled** on that environment. An administrator turns this on at [admin.powerplatform.microsoft.com](https://admin.powerplatform.microsoft.com) under Manage → Environments → *your environment* → Settings → Product → Features → **Enable code apps**.

A word on which environment to use. The Default environment is shared by everyone in the tenant and is a poor home for a real app, so the conventional advice is to create a dedicated one. On a developer tenant that advice often fails: Sandbox and Production environments draw on tenant capacity, and a developer tenant rarely has the 1 GB free to spare. A **Developer** type environment is the usual workaround, since it carries its own capacity, but apps in a Developer environment cannot be shared with other users. This build stayed in the Default environment for that reason.

### Working in a governed tenant

In a developer tenant you are the administrator and nothing stands in your way. In a corporate tenant, several controls sit between you and a running code app. None of them is a defect. They exist to keep data where it belongs, and the delay they introduce is usually the approval, not the technical change.

In the OPS these requests go to **AccelerateON**, the enterprise service that manages Microsoft Power Platform and delivers robotic process automation. Raise them early, in parallel with writing your specification, rather than discovering them on the day you first try to deploy.

AccelerateON is also worth talking to before you commit to a code app at all. Part of the service's purpose is bringing automation to the OPS, and a good deal of what people reach for a custom React app to do is already solved by a canvas app, a Power Automate flow, or an existing solution in the service catalogue. A code app is the right answer when you genuinely need custom UI, custom logic or a component model that low code cannot express. It is the wrong answer when it is chosen out of unfamiliarity with what the platform already offers, and that choice carries a maintenance cost the team inherits.

| Control | Where it stops you | What to ask for |
|---|---|---|
| **Code apps not enabled on the environment** | The very first `pa app init`, and every import. It is an explicit per-environment toggle that defaults to off | Code apps enabled on the named environment. At scale this is set through environment groups and rules rather than per environment, so the answer may be "your environment needs to move groups" |
| **Environment creation restricted** | You cannot create a dedicated environment and are pushed towards a shared or Default one | A dedicated environment for the project, with Dataverse provisioned. Name the purpose and expected data. Ask for Sandbox for development with a path to Production |
| **Data loss prevention (DLP) policy** | Enforced when the app launches, not when you write the code. An app built against a blocked connector will pass every local test and fail for real users | The connectors your app needs classified as business data in the policy that applies to your environment. Dataverse is usually already allowed; anything beyond it is the risk. Ask before you build the integration, not after |
| **Managed Environment controls** | Sharing limits cap how many users you can share with, and solution checker enforcement can block a publish outright | Your app added to any exemption that applies, or confirmation of the sharing limit so you plan rollout around it. Code apps follow canvas app sharing rules |
| **Conditional Access** | Sign-in fails for users on unmanaged devices or from certain locations, often only for some of your testers | Confirmation of which policies apply to Power Platform, so you test with an account inside the policy rather than debugging a phantom auth bug |
| **Tenant isolation** | Guest and cross-tenant users cannot open the app | An exception, or a decision that external access is out of scope |
| **Power Apps licensing** | Every end user needs a Power Apps Per User licence to run a code app. Microsoft documentation calls this Power Apps Premium; in the OPS it is known by the older name. Licence procurement is usually slower than the build | Licences for your pilot group, requested at the start. This is the single most common reason a finished app sits unused |
| **Power Automate licensing** | A flow that runs outside the app, on a schedule or from an external trigger, is not covered by the app's licence. Nor are premium connectors | Power Automate Premium for the flow owner, where the flow runs standalone or touches a premium connector. Confirm scope with AccelerateON before you design around a flow |
| **Entra app registration for automated deployment** | Publishing from a pipeline needs a service principal, and creating app registrations is almost always restricted | A service principal with the environment access it needs, plus `edit` access on the app once it exists. Only needed for CI/CD, so it can follow the first manual deploy |
| **Publisher prefix and solution naming** | Not a blocker, but a rename later means recreating tables | The organisation's naming convention for publishers and solutions, before you generate anything |

The line between the two licences catches people out. A flow that runs inside an app's context can be covered by the app's own licensing, but the moment the same flow runs on a schedule, responds to an external event, or reaches a premium connector, it needs Power Automate Premium in its own right. That is the situation for the reminder flow planned for phase two of this project: it runs on a schedule regardless of whether anyone has the app open, so it sits outside the app's licence. Licensing terms change, so treat this as the question to ask rather than the answer.

Two related limitations are worth knowing early, because they are platform behaviour rather than policy and no approval will lift them. Code apps do not yet support Secure Implicit Connections, so each user consents to connections themselves. And code app assets are served from a public endpoint that does not honour the storage SAS IP restriction setting, which means IP-based restriction has to be done with Conditional Access location policies instead. If your security team asks how the app is restricted by network, that is the honest answer.

### Local tooling

- Node.js LTS. Version 24 was used here.
- Git.
- Python 3, only if you want to regenerate the Dataverse schema package. Any tool that can produce a zip would do.
- The `pa` CLI, installed globally or invoked through `npx`:

```bash
npm install --global @microsoft/power-apps-cli
```

Verify it:

```bash
pa --version
```

At the time of writing this reports `1.0.2`.

---

## Procedure

### Part 1 · Planning and the data layer

#### Step 1: Write the specification before any code

The temptation with a familiar app shape like a todo list is to start typing. Resist it. A todo list is deceptively underspecified: does completing a recurring task create the next one immediately or on a schedule? Does completing every subtask complete the parent? Is "sync" a websocket or a refetch? Each of those is a fork in the implementation, and picking wrong costs a rewrite.

The specification for this build covers six areas, which is a useful minimum for any project:

1. **Objective** — what is being built, for whom, and what success looks like in measurable terms.
2. **Tech stack** — every dependency with a version and a one-line justification.
3. **Commands** — the full executable command for build, test, lint, dev and deploy. Not "run the tests" but the exact string.
4. **Project structure** — where each kind of file lives.
5. **Code style** — one real code sample beats three paragraphs of description.
6. **Boundaries** — three tiers: always do, ask first, never do.

Two techniques mattered more than the template.

**Surface assumptions explicitly and make them a numbered table.** Ten assumptions were listed before a line of the spec was written, each with a reason it mattered. Several were wrong in interesting ways, and finding that out took one exchange rather than a week of building. The most consequential: the brief asked for push notifications, and code apps have no push channel. Naming the gap early turned it into a scoped decision (browser notifications while the tab is open, with an Outlook flow deferred to a later phase) instead of a late surprise.

**Reframe vague requirements as testable criteria.** "Fast task capture" became: pressing `n` focuses an input within 100 ms, Enter saves optimistically, and typing `Buy milk on Friday` produces a task titled "Buy milk" due next Friday. That is something you can write a test against. "Fast" is not.

The result lives at [`SPEC.md`](../SPEC.md) in the repository root, in version control alongside the code, updated in the same pull request whenever a decision changes.

#### Step 2: Break the specification into ordered, verifiable tasks

The plan slices the work **vertically**. Rather than building all the data access, then all the UI, each task after the foundation delivers one complete user-visible capability: the schema it needs, the data calls, the components and the tests. Every task leaves the application in a working state.

Seventeen tasks were produced, each with acceptance criteria, a verification command, its dependencies and the files it is expected to touch. Any task that would touch more than about five files was split.

The single most valuable structural decision in the plan was a **repository interface** sitting between the application and Dataverse:

```
src/data/repo.ts          ← the contract: ListRepo, TaskRepo, SubtaskRepo
src/data/mock/            ← in-memory implementation
src/data/dataverse/       ← the real implementation over generated services
```

Because every component talks to the interface and never to Dataverse directly, fifteen of the seventeen tasks can be built and tested with no tenant connection at all. Only the wiring task and the publish task need the real environment. That decoupling also keeps Dataverse column names such as `cb_duedate` out of the React components entirely.

The plan and task list are at [`tasks/plan.md`](../tasks/plan.md) and [`tasks/todo.md`](../tasks/todo.md).

#### Step 3: Define the Dataverse schema as code

Dataverse tables are normally created by clicking through the maker portal. That works, but the schema then exists only in the tenant. It cannot be diffed, reviewed in a pull request, or recreated in a second environment without repeating every click.

The alternative is to author an **unmanaged solution package** and import it. A solution package is a zip containing three XML files:

```
solution.xml          → manifest: name, version, publisher, root components
customizations.xml    → the actual schema: entities, attributes, relationships, roles
[Content_Types].xml   → a fixed boilerplate file
```

In this build a Python script, [`solution/generate.py`](../solution/generate.py), emits all three and zips them. The script is the schema of record; the zip is a build artifact. Changing a column means editing a Python function and regenerating, which produces a readable diff.

The schema itself is three user-owned tables:

| Table | Purpose | Notable columns |
|---|---|---|
| `cb_todolist` | A bucket such as Work or Groceries | `cb_isinbox`, `cb_sortorder` |
| `cb_todotask` | A task in a list | `cb_duedate`, `cb_hastime`, `cb_recurrence`, `cb_reminderat` |
| `cb_todosubtask` | A checklist step inside a task | `cb_isdone`, `cb_sortorder` |

Plus three relationships and a `Todo User` security role granting user-level create, read, write and delete on all three.

Four details are easy to get wrong when hand-authoring the XML.

**Lookups are defined as relationships, not as columns.** You do not write a lookup attribute. You write an `EntityRelationship` of type `OneToMany` with a `<field>` element, and Dataverse creates the lookup column on the referencing table from it.

**Choice values carry the publisher's option-value prefix.** With a prefix of `10000`, the four recurrence options are 100000000 through 100000003 rather than 0 through 3. The application maps them to a plain string union at the data boundary so the rest of the code never sees the numbers.

**Element order inside an attribute is not free.** Dataverse expects `<Type>` first, then names and flags, then the type-specific elements such as `<Format>` or `<optionset>`. Putting the type-specific block immediately after `<Type>`, which reads more naturally, is rejected.

**Relationship roles are asymmetric.** This one cost an import. Details in Troubleshooting.

Choose your publisher prefix before generating anything. Every schema name is built from it, and renaming afterwards means recreating the tables. This build used `cb` and a dedicated publisher rather than one of the two defaults that ship with a tenant, whose prefixes are auto-generated strings like `cr04d74`.

#### Step 4: Import the solution

1. Open [make.powerapps.com](https://make.powerapps.com) and select the target environment in the picker at the top right. Getting this wrong imports into the wrong environment, and nothing later will warn you.
2. Choose **Solutions** in the left navigation, then **Import solution**.
3. Browse to the generated zip and continue.
4. Confirm the details page shows the expected solution name, version and publisher, then choose **Import**.
5. Wait for the success banner. A three-table import takes roughly forty seconds.

> **Screenshot placeholder** — `docs/images/import-solution.png`: the Import solution dialog with the package selected and the publisher shown.

If it fails, download the log file from the failure banner before doing anything else. It is an Excel-format XML file with two sheets: a summary with the first fatal error, and a component-by-component list showing exactly which component failed and which were never reached. It is far more useful than the message in the browser.

#### Step 5: Assign the security role

Importing the role does not assign it. In the admin center, open the environment, then Users, select the user, then Manage security roles, and tick the role. Repeat for any test accounts.

Note that a System Administrator already holds every privilege the custom role grants, so assigning it to yourself changes nothing functionally. It matters for verifying that a user with *only* the app's role can run the finished app, which is the honest test of whether your role definition is complete.

### Part 2 · Scaffolding the project (draft notes)

*Running notes from task 1. Task 17 turns these into finished prose.*

- `npx degit github:microsoft/PowerAppsCodeApps/templates/vite .` refuses to write into a non-empty directory. The repo already held the spec and docs, so the template went into a scratch folder and only these files were copied: `index.html`, `package.json`, `tsconfig*.json`, `eslint.config.js`, `vite.config.ts`, `src/main.tsx`, `public/vite.svg`. The template's `README.md`, `.gitignore`, demo `App.tsx`, CSS and `src/assets` were left behind.
- The template's `index.css` and `App.css` contain raw colour values. They were dropped rather than kept, because the design tokens arrive in task 2 and no colour may live outside `tokens.css`.
- `npm install` in September 2026 resolved React 19.3, Vite 7.3, `@microsoft/power-apps` 1.4.0 and `@microsoft/power-apps-vite` 1.0.13, newer than the template's ranges.
- Test tooling added as dev dependencies: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@playwright/test`, `prettier`, `eslint-config-prettier`.
- Vitest has its own `vitest.config.ts` without the `powerApps()` plugin. Tests do not need the Power Apps host bootstrap.
- The `@/` alias has to be declared twice: in `resolve.alias` for Vite and Vitest, and in `paths` in `tsconfig.app.json` for the type checker.
- Playwright browsers are a separate download: `npx playwright install chromium webkit`, about 250 MB. The config runs two projects, desktop Chromium and iPhone 13 WebKit, and starts the Vite dev server itself on port 5174 with `VITE_USE_MOCKS=true`.
- Until `pa app init` runs in task 4, every `npm run dev` prints this, and it is harmless:

  ```
  [powerApps] Error loading power.config.json:
  ⤷Missing file. Ensure you have run 'pac code init' first.
  ```

  The message still says `pac code init`, although that command no longer exists. The replacement is `pa app init`.
- CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, typecheck, test and build on Node 24 for every pull request and push to `main`. Playwright is not in CI yet.

### Part 2 · Design foundation and app shell (draft notes)

*Running notes from task 2.*

- Fonts are self-hosted with Fontsource (`@fontsource-variable/geist`, `@fontsource-variable/geist-mono`) instead of a Google Fonts `<link>`. A code app runs inside the Power Apps host, and its content security policy can block third-party font CDNs; bundled `.woff2` files are served from the app's own origin. The Fontsource family names carry a `Variable` suffix: `"Geist Variable"`, not `"Geist"`.
- All colours and font names live in `src/styles/tokens.css`. A Vitest test (`src/styles/tokens.node.test.ts`) walks `src/` and fails if a hex, `oklch()`, `rgb()` or `hsl()` value, or a `font-family` that is not a `var()`, appears anywhere else. It is cheaper than relying on review.
- That test reads files with `node:fs`, so it needs Node types, and the app's `tsconfig.app.json` deliberately has none. The fix was a naming convention: `*.node.test.ts` files are excluded from `tsconfig.app.json` and included in `tsconfig.node.json`. Reading the CSS through Vite's `import.meta.glob(..., { query: "?raw" })` does not work under Vitest: CSS is stubbed, and the raw import comes back empty.
- The first draft of the font-family regex, `/font-family:\s*(?!var\()/`, flagged every valid line. `\s*` backtracks to zero characters, so the lookahead sees ` var(` and matches. Put the whitespace inside the lookahead: `/font-family:(?!\s*var\()/`. Planting a deliberate violation before trusting the test is what caught it.
- Contrast was checked numerically from the OKLCH values, not by eye. Two tokens failed and were changed: text on a coral fill came out at 3.8:1, so the accent was darkened to `oklch(56% 0.17 35)` for 4.9:1; control borders were 1.9:1, so `--color-rule-2` went to `oklch(60% 0.01 70)` for at least 3.1:1.
- The shell's mobile bottom sheet is hidden with `visibility: hidden` as well as a transform. That removes the closed sheet from the tab order and the accessibility tree without JavaScript media queries, and the same markup becomes the persistent sidebar from 48rem.
- `e2e/shell.spec.ts` asserts `scrollWidth - clientWidth === 0` at 320, 375, 414, 768, 1024 and 1440 px, and saves screenshots to `docs/design/` when `SHELL_SCREENSHOTS=1`. `page.evaluate` callbacks use `document`, so `tsconfig.node.json` needs `"DOM"` in `lib`.

### Part 2 · The repository layer (draft notes)

*Running notes from task 3.*

- The app never calls generated Dataverse services directly. `src/data/repo.ts` defines app-shaped types (`Task.dueDate` is `Date | null`) and three interfaces, `ListRepo`, `TaskRepo` and `SubtaskRepo`. An in-memory implementation exists first; the Dataverse one follows in task 4.
- The shared behaviour lives in `src/data/repoContract.ts` as a function, `runRepoContract(name, makeRepos)`, not in a `.test.ts` file. Importing one test file from another registers its tests twice. The mock runs the suite in `repoContract.test.ts`, and the Dataverse repo will call the same function.
- The contract copies Dataverse's cascade rules so that the mock cannot be more forgiving than the real thing: deleting a list deletes its tasks, and deleting a task deletes its subtasks. It also requires that dates come back as `Date` instances at the same instant.
- Mock repos copy every object that crosses the boundary, including `Date` objects. Without that, a component that mutated a returned task would silently change the "database" and hide bugs that only show against Dataverse.
- `npm run dev` runs `vite --mode mock`, which loads the committed `.env.mock` (`VITE_USE_MOCKS=true`). The repo's `.gitignore` ignores `.env.*`, so `.env.mock` is explicitly un-ignored; it holds no secrets. A build without mocks throws a clear error at startup rather than quietly falling back to sample data.
- Optimistic updates snapshot every cached query under a key prefix (`["tasks"]`), rewrite them, and restore the snapshot on error. Patching every task cache, not just the current list, means a task toggled from the Today view and from its list stays consistent. Every mutation invalidates the prefix when it settles, so the server's answer always wins in the end.
- To test optimism, the repo call is held open with a hand-settled promise (`deferred()` in `src/test/renderWithProviders.tsx`). The test checks that the cache has already changed while the mutation is still pending, then rejects the promise and checks the rollback.
- `eslint-plugin-react-refresh` warns when a file exports both a component and a hook, and the lint runs with `--max-warnings 0`. That is why the context and `useRepos` live in `useRepos.ts`, separate from `RepoProvider.tsx`.
- A second guard test, `src/data/boundaries.node.test.ts`, fails if anything outside `src/data` imports from `src/generated`.

### Part 2 · Initialising the code app and wiring Dataverse (draft notes)

*Running notes from task 4.*

- `pa auth login` opens the system browser and prints `Signed in as <account>.` when done. The CLI was not installed globally here, so every command ran as `npx @microsoft/power-apps-cli …`. `pa app init` then adds `@microsoft/power-apps-cli` to `devDependencies`, pinned to the running version, so run `npm install` afterwards to update the lockfile.
- **The environment ID of a tenant's default environment starts with `Default-`.** The GUID shown on its own is the tenant ID. Passing it to `pa app init` failed with this error:

  ```
  Network request failed for GET https://dc08738656cb442582f34b2dd04d62.d8.environment.api.powerplatform.com/powerapps/environment?api-version=1&$filter=name eq 'dc087386-56cb-4425-82f3-4b2dd04d62d8'. DNS lookup failed - unable to resolve hostname. Details: getaddrinfo ENOTFOUND dc08738656cb442582f34b2dd04d62.d8.environment.api.powerplatform.com
    → Check your network connection, VPN/proxy, and that the target service is reachable.
  ```

  It reads like a network problem, but it isn't one: the CLI builds the hostname from the ID, and only `default<guid>…` exists. `pa app init --environment-id Default-dc087386-…` worked. Nothing is written when init fails.
- `pa app init` only writes `power.config.json`, with `"appId": null`. Nothing appears in the environment until `pa app push`. It sets `localAppUrl` to `http://localhost:3000`.
- `pa app add data-source --connector dataverse --table cb_todolist` prompts `Please provide the organization URL:` for every table. The URL is **make.powerapps.com → Settings → Session details → Instance url**, or `--org-url` on the command. Each run printed `Data source added successfully.`
- The data sources are named after the entity set without the prefix: `todolists`, `todotasks`, `todosubtasks`. `pa app refresh data-source --name` takes those names, not the table's logical name.
- Generated output: `src/generated/models/Cb_todotasksModel.ts`, `src/generated/services/Cb_todotasksService.ts` and so on, plus `.power/schemas/`. The generated services import `.power/schemas/appschemas/dataSourcesInfo.ts`, so **commit `.power/` along with `src/generated/`**, and exclude both from ESLint and Prettier.
- What the generated models show:
  - Lookups are written through keys named after the **relationship**, for example `"cb_todolist_cb_todotask_list@odata.bind": "/cb_todolists(<guid>)"`.
  - Lookups are read back as `_cb_list_value`.
  - Choice columns are typed as their integer values (`100000002`).
  - `statecode` is required on create.
  - Dates are ISO strings.
- Service calls return `IOperationResult` (`success`, `data`, `error`, `skipToken`) instead of throwing on failure. The repositories check `success` and throw `error`, and follow `skipToken` until every page is read. The generated `delete` returns `void` and discards the result, so a delete that reports failure without rejecting is not detected.
- The generated update type allows `undefined` but not `null`. Dataverse clears a column when it is sent `null`, so the repository casts at that one call.
- The repositories read a record back with an explicit `select` after every create and update. That guarantees the lookup columns are present, whatever the create response contains; the cost is one extra request per write.
- IDs are checked against a GUID pattern before they go into a filter or a bind path, so an ID can never change an OData query.
- The Dataverse repositories run the same contract suite as the mock, against an in-memory fake of the generated services. The fake is strict:
  - reads without `select` fail;
  - unknown filter shapes fail;
  - lookups must be bound;
  - deletes cascade the way the solution's relationships do.
- **Local Play does not need `pa app run`.** The `@microsoft/power-apps-vite` plugin serves `power.config.json` from the Vite dev server and prints the URL itself: `➜  Local Play:   https://apps.powerapps.com/play/e/<environment>/a/local?_localAppUrl=…`. `npm run dev:dataverse` runs `vite --port 3000 --strictPort`, which matches `localAppUrl`.
- Vite watches the project root, so a coverage run restarted the dev server dozens of times. `server.watch.ignored` now excludes `coverage/`, `playwright-report/` and `test-results/`.
- The list and task UI arrives later, so task 4 was verified with a development-only smoke panel (`npm run dev:smoke`, which loads `.env.smoke`). It creates a list, creates a task in it, completes the task, then deletes both. All five steps passed against the environment; see `docs/smoke.md`. Dataverse stored the completion time without its milliseconds.

---

## Verify

Work through these before moving on to the application build.

**The solution imported completely.** Open the solution in the maker portal. You should see all three tables and the security role listed as components. A partially imported solution shows some components and no error, which is why the count matters.

**The relationships exist.** Open the task table, then its Relationships tab. Confirm each expected relationship is present and that its behaviour is right: parental where deleting the parent should delete the children, referential where it should not.

**The role grants what you intended.** Open the role and confirm the privileges are set to user level, the innermost quarter-circle, on each table. Organisation level here would let every user read everyone else's tasks.

**Data can actually be written.** In the maker portal, open the list table, choose the Data tab, and create a row by hand. If that succeeds, the schema and your permissions are both working. Delete the row afterwards.

**The CLI can authenticate.** Run `pa auth login`, which opens a browser, then:

```bash
pa auth status
pa app list
```

The second command confirms the CLI can reach the environment. An empty list is the correct result before anything has been published.

---

## Troubleshooting

### Import fails with `SecLib::CheckPrivilege failed ... PrivilegeName: prvCreateEntity`

**Cause.** Your account lacks the System Administrator role on this environment, so it cannot create tables. Most developers already hold the role and never see this. It typically appears on a Default environment, or on one created by somebody else, where membership was never granted explicitly. Enabling code apps does not help: that is a tenant-level toggle and grants nothing inside the environment's own security model.

**Fix.** Assign yourself System Administrator on the environment, then import again. The documented path is the admin center, then the environment, then Access → Users → Manage security roles.

If that page offers no way to change roles, look for **Membership** on the environment instead. The Users path can be unavailable to an account that is not already an environment administrator, which is circular; Membership is where the control lives in the current portal and worked in this build when the Users page did not.

If neither is available, you are not an administrator of that environment and someone who is must grant it. On a developer tenant that is usually the account you signed up with.

### Import fails with `The NavPaneDisplayOption attribute is required for the Referencing Role`

**Cause.** The two `EntityRelationshipRole` elements in a one-to-many relationship are not interchangeable, and the naming is counterintuitive. Role type **1** is the referencing role. It carries the three navigation-pane elements and its navigation property is the *relationship* name. Role type **0** is the referenced role, and its navigation property is the *lookup column* name. Swapping them produces this error.

Correct form:

```xml
<EntityRelationshipRoles>
  <EntityRelationshipRole>
    <NavPaneDisplayOption>UseCollectionName</NavPaneDisplayOption>
    <NavPaneArea>Details</NavPaneArea>
    <NavPaneOrder>10000</NavPaneOrder>
    <NavigationPropertyName>cb_todolist_cb_todotask_list</NavigationPropertyName>
    <RelationshipRoleType>1</RelationshipRoleType>
  </EntityRelationshipRole>
  <EntityRelationshipRole>
    <NavigationPropertyName>cb_List</NavigationPropertyName>
    <RelationshipRoleType>0</RelationshipRoleType>
  </EntityRelationshipRole>
</EntityRelationshipRoles>
```

**Fix.** Correct the role types, regenerate the package and import again.

### The app works locally but a connector fails for real users

**Cause.** Almost always a DLP policy. Policies are evaluated when the app launches in the environment, not when you develop against the connector locally, so a connector that works all through the build can be blocked the moment someone else opens the published app.

**Fix.** Ask the governance team which policy applies to your environment and how the connectors you use are classified. A connector in a different group from the rest of your app's connectors is the usual cause. Confirm this before building anything on a connector beyond Dataverse.

### Only some testers can sign in

**Cause.** Conditional Access, tenant isolation, or a missing Power Apps Premium licence. The symptoms overlap and none of them look like a licensing problem from the browser.

**Fix.** Check licence assignment first because it is the quickest to rule out. Then ask which Conditional Access policies apply to Power Platform. If the affected testers are guests from another tenant, tenant isolation is the likely cause and needs an explicit exception.

### A failed import left tables behind

Unmanaged solution imports are **not transactional**. The failed import above had already created all three tables and their system views before it stopped at the first relationship. The solution shows as failed while the tables exist in the environment.

This is not a problem. Re-importing the corrected package updates the existing tables in place and continues to the components that never ran. Do not delete the tables first. The component sheet in the log file tells you exactly how far the import got.

### The `pa` command is not found on macOS

You are probably thinking of `pac`, which does need an MSI on Windows or the Visual Studio Code extension elsewhere. The code apps CLI is `pa`, an npm package, and installs the same way on every platform:

```bash
npm install --global @microsoft/power-apps-cli
```

Or run it without installing:

```bash
npx @microsoft/power-apps-cli --version
```

### Cannot create a new environment: 1 GB of capacity required

The tenant has no free Dataverse capacity, which is normal on a developer tenant where the Default environment has consumed it. Options, in order of preference: create a **Developer** type environment, which carries its own capacity but cannot share apps with other users; free capacity by deleting an unused environment; or work in the Default environment, which is what this build did.

### Only default publishers appear in the publisher list

A new tenant has two: a CDS default publisher and an organisation default, both with auto-generated prefixes. Neither is a good choice, because the prefix becomes part of every schema name. Create your own publisher with a short meaningful prefix, or let a solution package create one on import, which is what this build did.

> **Screenshot placeholder** — `docs/images/publisher-list.png`: the publisher dropdown showing only the two defaults on a fresh tenant.

---

## Related information

**Microsoft documentation**

- [Power Apps code apps overview](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/overview) — features, prerequisites, licensing and the current limitations list
- [Quickstart: create a code app using the Power Apps CLI](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/create-an-app-from-scratch)
- [Connect your code app to Dataverse](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-dataverse) — generated services, supported operations, and what is not supported
- [Power Apps CLI command reference](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/reference/cli) — every `pa` command and parameter
- [Code apps architecture](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/architecture)
- [Customization solutions file schema](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/customization-solutions-file-schema) — the XML reference for hand-authoring a solution

**Packages**

- [`@microsoft/power-apps`](https://www.npmjs.com/package/@microsoft/power-apps) — the client library, sometimes called the Power Apps SDK
- [`@microsoft/power-apps-cli`](https://www.npmjs.com/package/@microsoft/power-apps-cli) — the `pa` CLI

**Community**

- [PowerAppsCodeApps repository](https://github.com/microsoft/PowerAppsCodeApps) — official templates and samples, including a Dataverse demo app
- [CLI general availability announcement](https://github.com/microsoft/PowerAppsCodeApps/discussions/438) — the `pac code` to `pa` migration, including renamed flags

**Governance reference**

- [Data loss prevention policies](https://learn.microsoft.com/en-us/power-platform/admin/wp-data-loss-prevention) — how connectors are grouped and how policies are evaluated
- [Environment groups and rules](https://learn.microsoft.com/en-us/power-platform/admin/environment-groups) — how code apps get enabled at scale
- [Managed Environment sharing limits](https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-sharing-limits)
- [Publish a code app with a service principal](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/use-service-principal) — the non-interactive deployment path

**Known limitations worth reading before you commit to code apps**

Code apps do not run in the Power Apps mobile player, so mobile means a mobile browser. They do not support Power Platform Git integration, SharePoint forms integration, or Power BI data integration, and they are not supported in Power Apps for Windows. There is no offline mode and no push notification channel. None of these blocked this project, but any one of them could block yours.

**In this repository**

- [`SPEC.md`](../SPEC.md) — the full specification
- [`tasks/plan.md`](../tasks/plan.md) and [`tasks/todo.md`](../tasks/todo.md) — implementation plan and task list
- [`docs/dataverse-setup.md`](dataverse-setup.md) — the operational runbook for the schema, including a click-by-click manual fallback
- [`solution/generate.py`](../solution/generate.py) — the schema generator

---

*Parts 2 to 4 will be appended to this article as the build progresses. Next up: scaffolding the React project from the official Vite template, establishing the design system, and wiring the repository layer to Dataverse.*
