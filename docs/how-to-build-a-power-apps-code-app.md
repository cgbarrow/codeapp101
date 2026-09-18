# How to build a Power Apps code app with React, Dataverse and the `pa` CLI

*A working log of building "Simple Todo", a personal task app hosted on Microsoft Power Platform.*

Last updated: 2026-09-18 · Status: **All four parts written.** The app is built, published and documented; the manual smoke test against the tenant is the one thing outstanding, and Part 4 says so where it matters.

---

## Overview

Power Apps **code apps** let you write an ordinary React single-page application, deploy it into a Power Platform environment, and get Microsoft Entra authentication, Dataverse access and your organisation's governance policies without building any of it yourself. You keep full control of the UI. The platform handles identity, hosting and data.

This article is the running log of building one such app end to end. The app is a personal todo list: fast capture with natural-language dates, multiple lists, due dates and reminders, recurring tasks, subtasks, and a Today view. It stores everything in three custom Dataverse tables and runs in a browser on phone, tablet and desktop.

The log is written as we go, so it records what actually happened, including the two failed imports, the environment ID that looked like a network outage, and what fixed each of them. Where a step went wrong, the fix is in Troubleshooting rather than quietly smoothed out of the procedure.

**Who this is for.** Developers comfortable with React and TypeScript who have not shipped a Power Platform app before. No low-code experience is assumed. Power Platform administrators will find the environment and permission sections useful on their own.

> **Where this build ran, and why it matters.** Everything below was done in a personal Microsoft 365 developer tenant, in a Power Platform environment with no data loss prevention policies, no environment group rules, no Managed Environment controls and no conditional access. Every setting was mine to change and every connector was available.
>
> That is not where most teams work. In a corporate tenant the same steps run into governance controls that are working exactly as intended, and the fix is a conversation with your platform team rather than a change you make yourself. The section below names each control, says where it bites, and gives you the specific ask to raise.



**What this article covers:**

| Part | Scope | Status |
|---|---|---|
| 1 | Specification, plan, Dataverse schema, environment setup | Complete |
| 2 | Project scaffold, design system, data layer, CLI wiring | Complete |
| 3 | Feature build: lists, tasks, capture, Today, recurrence, reminders | Complete |
| 4 | Publish, share, smoke test, and what comes after | Written; smoke test outstanding |

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
- About 250 MB of disk for the Playwright browsers used by the end-to-end tests.
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

### Part 2 · Project, design system and data layer

Part 2 turns the plan into a running application skeleton: a React project with its test tooling, a design system enforced by tests, a repository layer that the whole UI will depend on, and a verified connection to the Dataverse tables from Part 1. No features ship yet. What ships is the foundation every later task stands on, and a proof that it reaches real data.

#### Step 6: Scaffold the project from the official template

Microsoft publishes a Vite template for code apps. It is a standard React and TypeScript setup plus one addition that matters, the `@microsoft/power-apps-vite` plugin, which lets the Power Apps host load your local dev server.

```bash
npx degit github:microsoft/PowerAppsCodeApps/templates/vite .
npm install
```

That command expects an empty directory, and `degit` will not write into one that already has files. This repository already held the specification and docs, so the template was fetched into a scratch folder and only the files the app needs were copied across: `index.html`, `package.json`, the three `tsconfig` files, `eslint.config.js`, `vite.config.ts`, `src/main.tsx` and `public/vite.svg`. The template's demo component, its README and its two stylesheets stayed behind. The stylesheets contain raw colour values, and in this project colours live in exactly one file, which does not exist until Step 7.

In September 2026, `npm install` resolved React 19.3, Vite 7.3, `@microsoft/power-apps` 1.4.0 and `@microsoft/power-apps-vite` 1.0.13, all newer than the ranges in the template. Expect the same drift.

The template ships with no tests, so add them before the first line of application code:

```bash
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test prettier eslint-config-prettier
npx playwright install chromium webkit
```

The Playwright browsers are a separate download of roughly 250 MB. The configuration in this build runs every end-to-end spec twice, once in desktop Chromium and once in an iPhone 13 WebKit profile, because a code app on a phone is a mobile browser and nothing else.

Three configuration details are worth copying.

**Give Vitest its own config file.** `vitest.config.ts` includes the React plugin but not `powerApps()`. Tests have no Power Apps host to talk to and do not need the plugin's bootstrap.

**Declare the path alias twice.** An `@/` import alias for `src/` goes in `resolve.alias` for Vite and Vitest, and again in `paths` in `tsconfig.app.json` for the type checker. Either one alone gives you code that runs but does not typecheck, or the reverse.

**Make the four checks the definition of done.** The npm scripts are `lint` (ESLint with `--max-warnings 0`), `typecheck`, `test` and `build`, and a GitHub Actions workflow at `.github/workflows/ci.yml` runs all four on every pull request and push to `main`.

Until the code app is initialised in Step 9, every dev server start prints an error from the Power Apps plugin about a missing `power.config.json`. It is harmless. See Troubleshooting.

#### Step 7: Build the design foundation

A code app has no component library unless you add one, which is freedom and also a trap: without a system, every component invents its own colours and spacing. This build uses a small token system and lets a test enforce it.

**Tokens live in one file.** `src/styles/tokens.css` defines every colour, font, type size, spacing step, radius, easing and duration as a CSS custom property. Components reference them by name, `var(--color-accent)`, and never contain a colour value or a font name of their own. The theme here is warm-grey paper with one coral accent and Geist throughout; the reasoning and the full palette are in [`docs/design/theme.md`](design/theme.md).

**A test enforces the rule.** `src/styles/tokens.node.test.ts` walks `src/` and fails if a hex, `oklch()`, `rgb()` or `hsl()` value, or a `font-family` that is not a `var()`, appears anywhere except `tokens.css`. Review misses these. A test does not. Before trusting a guard test like this, plant a violation and watch it fail; that is how this build found its own regex was wrong (see Troubleshooting).

The test reads files with `node:fs`, which needs Node's type definitions, and the application's TypeScript config deliberately has none: browser code should not compile against Node globals. The solution is a naming convention. Files ending `.node.test.ts` are excluded from `tsconfig.app.json` and included in `tsconfig.node.json`, so each file is typechecked against the environment it actually runs in.

**Self-host the fonts.** A Google Fonts `<link>` is the usual way to load a web font, but a code app runs inside the Power Apps player, and the player's content security policy is not yours to set. Fontsource packages bundle the font files into your build so they load from the app's own origin:

```bash
npm install @fontsource-variable/geist @fontsource-variable/geist-mono
```

Note that the family name these packages register is `"Geist Variable"`, not `"Geist"`.

**Check contrast with numbers, not eyes.** Every text and border token was converted from OKLCH to sRGB and its WCAG contrast ratio computed. Two failed and were changed. White text on the coral fill came out at 3.8:1, below the 4.5:1 minimum, so the accent was darkened to `oklch(56% 0.17 35)` for 4.9:1. Control borders were 1.9:1, below the 3:1 required for component boundaries, so they were darkened to `oklch(60% 0.01 70)`.

**The app shell.** Below 768 px, the list sidebar is a bottom sheet behind a **Lists** button; from 768 px it is a permanent side rail. The same markup does both jobs. The closed sheet is hidden with `visibility: hidden` as well as a transform, which removes it from the tab order and from screen readers without any JavaScript media queries. It closes on Escape, on the backdrop and from its own close button, and returns focus to the button that opened it.

An end-to-end spec, `e2e/shell.spec.ts`, asserts there is no horizontal scroll at 320, 375, 414, 768, 1024 and 1440 px, and can save a screenshot at each width:

```bash
SHELL_SCREENSHOTS=1 npx playwright test e2e/shell.spec.ts --project desktop-chromium
```

![The app shell at 375 px with the list sheet open](design/shell-375-sheet-open.png)

#### Step 8: Put a repository layer between the app and Dataverse

This is the step that pays for itself for the rest of the build. Components never call Dataverse. They call three interfaces, and two implementations sit behind them.

`src/data/repo.ts` defines the domain types and the contracts. The types are shaped for the application, not for the database: a task's due date is a `Date | null`, not a `cb_duedate` ISO string, and its recurrence is `"weekly"`, not `100000002`.

```ts
export interface TaskRepo {
  getByList(listId: string): Promise<Task[]>;
  getOpenDueBefore(end: Date): Promise<Task[]>;
  create(input: NewTask): Promise<Task>;
  update(id: string, patch: TaskPatch): Promise<Task>;
  delete(id: string): Promise<void>;
}
```

The first implementation is in memory, in `src/data/mock/`, seeded with sample lists and tasks whose dates are relative to today so that there is always something overdue and something due. It powers local development and every test, which is why most of this app can be built with no tenant connection at all.

**Write the shared behaviour once, as a function.** `src/data/repoContract.ts` exports `runRepoContract(name, makeRepos)`, a suite of eighteen cases that any implementation must pass. It lives in an ordinary module rather than a `.test.ts` file because importing one test file from another registers its tests twice. The in-memory repositories run it now; the Dataverse repositories run the identical suite in Step 10.

**Make the fake as strict as the real thing.** The contract includes Dataverse's cascade behaviour from the Part 1 schema: deleting a list deletes its tasks, and deleting a task deletes its subtasks. The in-memory repositories also copy every object in and out, including `Date` objects. Without that, a component that mutated a task it had been given would silently change the "database", and the bug would only appear against Dataverse.

**Choose the implementation at startup.** `npm run dev` runs `vite --mode mock`, which loads a committed `.env.mock` file containing `VITE_USE_MOCKS=true`. `src/data/createRepos.ts` reads that flag and returns the in-memory or the Dataverse repositories. The file holds no secrets, and it has to be explicitly un-ignored if your `.gitignore` excludes `.env.*`, as this one does.

**Optimistic updates, with rollback.** TanStack Query hooks in `src/data/queries.ts` wrap every read and write. A mutation cancels in-flight fetches, snapshots every cached query under a key prefix such as `["tasks"]`, rewrites them all, and restores the snapshot if the write fails. Rewriting every task cache rather than only the current list means a task completed from the Today view is also completed in its own list. When the write settles, the prefix is invalidated and refetched, so the server always has the final word.

To test optimism, hold the repository call open. A small `deferred()` helper returns a promise the test settles by hand: the test fires the mutation, asserts the cache has already changed while the mutation is still pending, then rejects the promise and asserts the rollback.

Finally, a second guard test, `src/data/boundaries.node.test.ts`, fails if anything outside `src/data/` imports from `src/generated/`. The generated code does not exist yet. The rule is in place before it does.

#### Step 9: Initialise the code app and add the Dataverse tables

Now the project meets the environment. Sign in first. The command opens the system browser and prints the account when it finishes:

```bash
npx @microsoft/power-apps-cli auth login
```

```
Signed in as <you>@<tenant>.onmicrosoft.com.
```

Then initialise the app. **Use the environment ID exactly as the admin center shows it.** For a tenant's Default environment, that ID begins with `Default-`, followed by a GUID that is the tenant ID. Passing the bare GUID fails with a DNS error that looks like a network fault; see Troubleshooting.

```bash
npx @microsoft/power-apps-cli app init --display-name "Simple Todo" --environment-id Default-<tenant-id>
```

```
Created power.config.json for Simple Todo.
```

Initialising is local. It writes `power.config.json` with `"appId": null` and a `localAppUrl` of `http://localhost:3000`, and nothing appears in the environment until the app is first published. It also adds `@microsoft/power-apps-cli` to your `devDependencies`, pinned to the version you ran, so run `npm install` afterwards to bring the lockfile up to date. From then on, `npx pa` runs the project's copy.

Add each table by its logical name:

```bash
npx pa app add data-source --connector dataverse --table cb_todolist
npx pa app add data-source --connector dataverse --table cb_todotask
npx pa app add data-source --connector dataverse --table cb_todosubtask
```

Each command asks for the Dataverse organisation URL:

```
◆  Please provide the organization URL:
```

Find it at [make.powerapps.com](https://make.powerapps.com), with the environment selected, under **Settings → Session details → Instance url**. It has the form `https://org<id>.crm.dynamics.com/`. Pass `--org-url` to skip the prompt. Each successful run prints `Data source added successfully.`

The command reads each table's schema and generates code:

```
src/generated/models/Cb_todotasksModel.ts     → row types and choice values
src/generated/services/Cb_todotasksService.ts → create, get, getAll, update, delete
.power/schemas/                               → table schemas the services import
```

**Commit `.power/` along with `src/generated/`.** The generated services import `.power/schemas/appschemas/dataSourcesInfo.ts`, so a clone without it does not build. Exclude both folders from ESLint and Prettier, and never edit either by hand. To regenerate after a schema change, refresh by **data source name**, which is the entity set name without the prefix, as listed in `power.config.json`:

```bash
npx pa app refresh data-source --name todotasks
```

#### Step 10: Implement the Dataverse repositories

Read the generated models before writing any mapping code. They answer most of the questions the documentation leaves open:

- Lookups are **written** through a key named after the relationship, not the column: `"cb_todolist_cb_todotask_list@odata.bind": "/cb_todolists(<guid>)"`.
- Lookups are **read** back as `_cb_list_value`.
- Choice columns are typed as their integer values, `100000000` to `100000003`.
- `statecode` is required when creating a record.
- Dates are ISO strings.

All translation between those rows and the domain types lives in `src/data/dataverse/mappers.ts`, and nowhere else:

```ts
export function taskPatchRecord(patch: TaskPatch): TaskPatchRecord {
  const p = definedOnly(patch);
  const record: TaskPatchRecord = {};
  if (p.listId !== undefined) record[LIST_BIND] = `/cb_todolists(${odataId(p.listId)})`;
  if (p.isCompleted !== undefined) record.cb_iscompleted = p.isCompleted;
  if (p.completedOn !== undefined) record.cb_completedon = isoOrNull(p.completedOn);
  // …one line per column
  return record;
}
```

The repositories in `src/data/dataverse/dataverseRepos.ts` follow five rules.

1. **Always pass `select`.** Every read names its columns. Microsoft's guidance is explicit about this, and it keeps payloads small.
2. **Send only changed columns on update.** Sending unchanged values can trigger business logic and pollutes the audit history. The patch mapper above emits a column only when the patch contains it.
3. **Check results; don't expect exceptions.** Generated service calls return an `IOperationResult` with `success`, `data`, `error` and, for lists, `skipToken`. A failed call can resolve rather than reject. Each repository method checks `success` and throws `error`, and list reads follow `skipToken` until every page is loaded.
4. **Read back after writing.** After each create and update, the repository reads the record again with an explicit `select`. That guarantees lookup columns such as `_cb_list_value` are present whatever the write response contains, at the cost of one extra request per write. The optimistic UI hides the latency.
5. **Validate IDs before they reach a query.** Every ID is checked against a GUID pattern before it goes into a filter or a bind path. An ID can then never change the meaning of an OData filter.

Two details of the generated code need handling. The generated update types allow a column to be omitted but not set to `null`, and `null` is how Dataverse clears a date; the repository casts at that single call. And the generated `delete` returns `void` and discards the operation result, so a delete that reports failure without rejecting will not be noticed. There is no workaround short of editing generated code, so it is recorded as a known gap.

**Test against a strict fake of the generated services.** The repositories take the services as a parameter. In tests they receive `createFakeDataverse()`, an in-memory stand-in that is deliberately unforgiving: reads without `select` throw, filter shapes the repositories are not meant to send throw, lookups must arrive as valid binds, and deletes cascade as the real relationships do. The Dataverse repositories then run the same eighteen-case contract as the in-memory ones from Step 8, plus tests of the exact filter strings, the changed-columns rule, paging, and error handling.

#### Step 11: Prove it against the real environment in Local Play

Tests against a fake prove the code does what you think Dataverse wants. Only Dataverse proves Dataverse wants it. Three things in this build could only be confirmed for real: that the relationship-named bind keys work, that the player's connection works from a local dev server, and that the lookup column reads back.

**You do not need `pa app run` for this.** The Power Apps Vite plugin serves `power.config.json` from the dev server and prints a Local Play URL itself. Start Vite without mocks, on the port that `power.config.json` expects:

```bash
npm run dev:dataverse
```

```
  Power Apps Vite Plugin

  ➜  Local Play:   https://apps.powerapps.com/play/e/Default-<tenant-id>/a/local?_localAppUrl=http://localhost:3000/&_localConnectionUrl=http://localhost:3000/__vite_powerapps_plugin__/power.config.json
```

Open that URL in the browser profile that is signed in to the tenant. The player supplies real authentication and a real Dataverse connection, and your code talks to real tables.

**What Local Play is, and what it is not.** The URL explains it. Where a published app has its app ID, this one has `/a/local`, and `_localAppUrl=http://localhost:3000/` tells the player to fetch the app's code from the dev server on your machine. Four consequences follow:

- The URL works only while your dev server is running, and only on the machine it runs on. Sending it to a colleague achieves nothing.
- Nothing is registered in the environment. `power.config.json` still says `"appId": null`, and the app appears in neither the **Apps** list nor your solution.
- The data is not simulated. Every create, update and delete lands in the real tables, which is the point of the exercise.
- The app becomes a real, shareable app only when you publish it with `pa app push`. Publishing also gives `appId` a value. To have the app land inside your solution alongside the tables, pass the solution's ID; `pa solution list` shows it:

  ```bash
  npx pa solution list
  npx pa app push --solution-id <solution-id>
  ```

  Part 4 covers publishing and sharing.

At this stage there is no list or task UI to click; that arrives in Part 3. So the check was run through a small development-only panel that exercises the same repository code the app will use. `npm run dev:smoke` starts the same server in a mode that shows the panel, which steps through five operations and logs each result:

1. Create a list.
2. Create a task in that list, binding the lookup.
3. Mark the task complete.
4. Delete the task.
5. Delete the list.

> **Screenshot placeholder** — `docs/images/local-play-smoke.png`: the smoke panel in Local Play after all five steps, with the log visible.

All five passed on the first run. The logged task ID was reported back in the correct list, which confirmed the bind key and the lookup read in one step. The one surprise: Dataverse stored the completion time to the second. The app sent a timestamp with milliseconds, and it read back as `2026-09-17T12:45:11.000Z`. Nothing in this app depends on milliseconds, but a sort that does would need to know. The full record is in [`docs/smoke.md`](smoke.md).

### Part 3 · Features

Part 3 is where the app becomes an app. Eleven steps, one per capability, each leaving the build in a working state: lists, the task row and its checkmark, quick capture, the detail panel, keyboard navigation, Today, subtasks, recurrence, reminders, sync, and finally the end-to-end suite that proves the lot.

One thing is worth noticing before the detail. **Not one step in this part needs the tenant.** Every feature below was built and tested against the in-memory repositories from Step 8, and the Dataverse implementation that Step 10 already proved carried them without change. That is the repository layer paying for itself, and it is the single decision that most affects how a code app feels to build.

A second pattern runs through all eleven steps: the interesting bugs are not in the Dataverse calls. They are in optimistic state, in time, and in the gap between what a test environment can simulate and what a browser actually does. Each step below records the ones that bit.

#### Step 12: Lists, routing and the Inbox

**Use hash routing, not browser routing.** This is the first decision specific to the platform rather than to React. A published code app is served from a fixed file URL inside the Power Apps player, and nothing on that host rewrites `/list/abc` back to `index.html`. A path-based route survives navigation inside the app and then 404s the moment someone reloads. `main.tsx` uses `react-router` v7 in declarative mode with `<HashRouter>`, so URLs look like `#/list/abc` and never reach the server. `App` deliberately contains no router of its own, which lets tests wrap it in `<MemoryRouter>`.

**Create the Inbox exactly once.** Every user needs a default list, created on first run. The obvious implementation creates two. React StrictMode runs effects twice in development, and more than one component can want the Inbox at the same moment. `ensureInbox(repo)` in `src/features/lists/ensureInbox.ts` keeps the in-flight promise in a `WeakMap` keyed by repository, so concurrent callers share one `getAll` and one `create`; the entry is dropped when the promise settles, so a failed attempt can be retried rather than poisoning the cache. `useInbox()` wraps that in a single TanStack Query with `staleTime: Infinity`. Across page loads Dataverse itself is the guard — the next load finds the Inbox and creates nothing.

**Deleting a list must not take its tasks with it.** The Part 1 schema cascades a list delete to its tasks, which is correct for "delete everything" and catastrophic for the "move tasks to Inbox" option the specification asks for. `deleteList` reparents every task first, one at a time, and deletes the list only after every move has succeeded. If a move fails the list survives, nothing is lost, and the tasks already moved are sitting safely in the Inbox. Ordering those two operations the other way round would be a data-loss bug that no amount of optimistic-UI polish could hide.

**Derive counts from caches you already have.** The open-task count beside each list comes from the per-list task caches through `useQueries`, not from a new repository method. Later mutations update the counts as a side effect, with no extra code. The cost is one request per list on first load, which is the right trade at personal-list scale — and a cost worth remembering, because Step 21 finds it again multiplied by a polling interval.

**Write only what changed when reordering.** `reorderLists` renumbers the visible lists 0, 1, 2… and returns only the lists whose `sortOrder` actually moved. Dragging one list past its neighbour therefore sends two `PATCH` requests rather than one per list.

**Automated browsers do not fire native drag and drop.** A scripted mouse drag, whether from Playwright or from a DevTools-driven browser, does not produce HTML5 `dragstart` and `drop` events. The component test drives the drop directly with `fireEvent.dragStart`, `dragOver` and `drop`, and the up and down buttons in edit mode give keyboard and touch users the same capability — which is why the feature is testable at all, and why it is accessible.

#### Step 13: The task list, the checkmark and Undo

Completing a task is the most-used interaction in the app, so it gets the most care. It is also where optimistic updates first become genuinely hard.

**Undo without a flicker needs two separate guards.** Completing a task and then pressing Undo sends two writes in quick succession. Left alone, the first write's refetch lands while the Undo is still in flight and the row flashes back to completed before settling. Two mechanisms fix it, and both are needed.

First, every task mutation carries `mutationKey: ["tasks"]`, and its `onSettled` refetches only when `queryClient.isMutating({ mutationKey: ["tasks"] })` is 1 — that is, when no other task write is still pending. Second, toggles share `scope: { id: "toggle-task" }`, which makes TanStack Query run their network calls strictly one after another, so Dataverse cannot receive the Undo before the completion it reverses. `onMutate` still runs immediately even for a queued mutation, so the screen updates at once and only the network traffic is serialised. `src/data/queries.test.tsx` proves it by recording every cache state after an Undo and failing if the task ever reads as completed.

**Let the animation play before the row moves.** The optimistic update would move a completed task into the Completed section in the same frame, and the 200 ms tick animation would never be seen. `useTaskToggle` holds just-completed ids in a "lingering" set for 500 ms and `TaskList` orders those tasks as if they were still open, so the animation finishes where the user is looking.

**Time animations with a timer, not `animationend`.** jsdom has no `AnimationEvent`, so React listens for `webkitAnimationEnd` and a test's `fireEvent.animationEnd` never reaches the handler. Worse, in a real browser the event never fires at all when `prefers-reduced-motion` turns the animation off — so an implementation that waits for it hangs for exactly the users least able to tolerate it. A `setTimeout` matched to the CSS duration is correct in both environments.

**Pause toast timers on hover and focus.** A three-second Undo window is short for keyboard and screen-reader users. The countdown stops while the pointer or the focus is on the toast, which is WCAG 2.2.1 (timing adjustable) rather than a nicety. Errors do not auto-dismiss at all and use `role="alert"`; everything else is announced through a polite live region.

**The Completed view reuses the list caches.** `/completed` gathers every list's cached tasks with `useQueries` rather than adding a repository method — the same pattern as the sidebar counts in Step 12, and it appears twice more before Part 3 is over.

#### Step 14: Quick capture with natural-language dates

The specification's measurable goal was capture in under five seconds: press `n`, type `Buy milk on Friday`, press Enter. That turns into a parser problem and a latency problem.

**`chrono-node` needs guard rails before it can parse a todo title.** Given a reference date and `forwardDate: true`, its casual English parser handles `tomorrow 3pm`, `next week`, `in 3 days`, `Sep 30`, and both `30/9` and `9/30` — genuinely good coverage for one dependency. It also cheerfully reads ordinary words as dates. `parseQuickAdd` therefore rejects `Now`, bare durations such as `2 hours`, a month name with no day (`Book flight for march`), and `sat` or `sun` used as words rather than weekdays. The rule that emerged: a match must pin down a day, a weekday or an hour, or it is not a date.

**Parse recurrence before chrono sees the text.** chrono does not understand `every day` or `every month` at all, and reads `every Monday` as a single upcoming Monday. The parser strips `every day|week|month|<weekday>` first and handles it itself. A bare `weekly` is deliberately left in the title, because "Write weekly report" is not a repeating task.

**A bare hour from 1 to 7 means the afternoon.** chrono reads `Call mom at 5` as five in the morning. People mean five in the afternoon. A small rule with a large effect on how the feature feels.

**Measure the test table against mutations, not against itself.** All 38 phrases passed on the first run, which proves almost nothing — a table of examples tends to encode whatever the parser already does. Disabling the afternoon rule, and then the `Now` and `Sat` filters, made the relevant cases fail. That is what establishes the table is checking those rules rather than decorating them.

**Handle Enter in `onKeyDown`, not only through form submission.** A form's implicit submission depends on the key event carrying text, which held under Playwright and Testing Library and failed under a scripted key press in an embedded browser. The handler also ignores Enter while an input method editor is composing, so confirming a Japanese or Chinese candidate does not save a half-typed task.

**Prove the optimistic row with a measurement, not a guess.** `e2e/quickadd.spec.ts` records `performance.now()` on the Enter keydown and uses a `MutationObserver` to time when the new row appears, entirely inside the page. The mock data layer is configured to answer after 250 ms, so a row that appears within 100 ms can only be the optimistic one. The assertion runs in both desktop Chromium and iPhone 13 WebKit.

**Know the bundle cost.** `chrono-node` added about 60 kB raw, 19 kB gzipped, to the main bundle — flagged at the time as something to revisit if Lighthouse performance fell below 90 in Step 22. It did not.

**Keep every single-key shortcut in one hook.** `useKeyboardShortcuts` owns the "not while typing, not with a modifier" rule, and the number keys from Step 12 moved onto it as soon as it existed. One wrinkle: jsdom does not implement `isContentEditable`, so the hook checks the `contenteditable` attribute as well as the property.

#### Step 15: The task detail panel

**Send only what changed.** `TaskDetail` builds each save by comparing the edited values against the task and dropping the fields that are equal, comparing dates by time value rather than by identity. The tests wrap `repos.tasks.update` and assert the exact patch object, so a stray `notes: ""` fails a test rather than quietly overwriting an edit made on another device. This is the Step 10 rule about changed columns, enforced one layer up where the user actually is.

**Store reminders as a time, show them as an offset.** Dataverse has `cb_reminderat` and no offset column, which is the right schema — an absolute instant is unambiguous. The UI wants "10 minutes before". `reminderOffsetOf` works the preset back out from the due date and the reminder time, and anything that does not match a preset displays as Custom. Changing the due date or time moves the reminder with it. A date-only task is reminded about at 09:00 on its day, and the panel says so rather than leaving the user to guess.

**"One day before" is a calendar day, not 24 hours,** so a 15:00 reminder is still at 15:00 on the other side of a clock change. This is the first appearance of a rule that recurs for the rest of the build: build dates from calendar fields, never by adding milliseconds.

**Pin the test time zone.** The first daylight-saving test passed even with the rule deliberately broken. Its dates were European clock-change days, the machine runs in `America/Toronto`, and nothing changed on those days there — and GitHub's runners are UTC, which has no daylight saving at all, so CI would never have caught it either. `vitest.config.ts` now sets `test.env.TZ` to `America/Toronto` and the tests use that zone's real 2026 transition dates. After the change, breaking the rule fails the test. A time test that passes in every time zone is usually testing nothing.

**Delete immediately; undo by recreating.** Deleting sends the delete straight away, and Undo creates the task again from a snapshot, with a new id. The tempting alternative — hold the delete for three seconds and cancel it if Undo is pressed — hides the row only in the local cache, so any refetch inside that window, such as the one triggered by ticking another task, brings the "deleted" row straight back. Step 18 adds subtasks to that snapshot, because a delete that Undo cannot fully reverse is worse than no Undo at all.

**Use native date and time inputs.** Each platform then shows its own accessible picker, which is invariably better than a hand-rolled one. Values are read as local `YYYY-MM-DD` and `HH:MM` strings and saved on blur or Enter rather than on change, because typing a year into a desktop date input fires `change` for every digit.

**Listen for Escape on the document, not on the panel.** Escape was first handled on the panel element, so it stopped working the moment focus left it — which the Playwright spec caught after a field blurred. The panel now listens on the document while it is open, and fields that use Escape for their own purposes, such as quick add, stop it propagating.

**Scripted key presses do not reach native date inputs in an embedded browser,** the same class of limitation as Enter in Step 14. `e2e/taskdetail.spec.ts` therefore covers editing the date and time, the 44 px input height and the full-width bottom sheet in real browsers — desktop Chromium and iPhone 13 WebKit — rather than in the in-app one used for quick visual checks.

#### Step 16: Keyboard navigation

**Selection moves focus; it is not a separate concept.** `j` and `k` select the next or previous task in the order shown on screen, including completed tasks while their section is open, and focus that task's title. The screen reader announces it, the focus ring shows it, and `x`, `e` and Backspace act on whatever has focus. There is no second "selected but not focused" state to keep in sync, which removes an entire category of bug.

Selection is stored by task id rather than by index or by element, so it survives optimistic inserts and the moment an optimistic placeholder is swapped for the saved row. A test holds a create open and asserts the same title element keeps the selection across that swap.

**Delete selects a neighbour.** Backspace or Delete removes the selected task with an Undo toast and selects the next task, or the previous one if the deleted task was last, so repeated deletes work without reaching for the mouse.

**Use a native `<dialog>` for the shortcut list, and expect two traps.** `showModal()` gives a focus trap, Escape handling and an inert background page for free. The first trap is that jsdom does not implement it, so `src/test/setup.ts` provides a small stand-in that also moves focus inside the dialog as browsers do. The second only appeared in a real browser: the first Playwright run found that moving focus back to the page while the modal was still open did nothing at all, because a modal makes the rest of the document inert. Close the dialog first, then restore focus.

**Return focus to where it was, not to the trigger.** The "Keyboard shortcuts" button is hidden on touch-only devices via `hover: none`, and `?` can open the dialog from anywhere, so there is not always a trigger to return to. The dialog remembers the previously focused element instead.

#### Step 17: The Today view

Today is the default landing view, and it is the step where a decision made in Step 8 gets revisited in light of what the app actually does.

**Read the per-list caches, not a filtered query.** Step 8 added `useTodayTasks`, which asks the repository for open tasks due before tomorrow. The finished view does not use it. Quick add, toggles and deletes all update the per-list caches optimistically, and the sidebar counts and the reminder scheduler already load those caches, so `/today` gathers them with `useTasksInLists` and filters in `selectToday`. It costs no extra requests and a new task appears in Today in the same frame it appears in its list. `useCompletedTasks` moved onto the same hook. The lesson is not that the repository method was wrong to write, but that a cache you are already paying for beats a query you are not.

**End the day at the next local midnight.** Use `new Date(year, month, day + 1)`, never start of day plus 24 hours. On a 23-hour day the shortcut pulls tomorrow's date-only tasks into Today; on a 25-hour day it drops tasks due after 23:00. Two tests use Toronto's 2026 transition days, and swapping in the 24-hour version fails both.

**"Overdue" follows the row's own rule.** A timed task whose time has passed today sits under Overdue, matching the red due label from Step 13. Two definitions of overdue in one app is a bug report waiting to happen.

**Archived lists are left out** of Today, exactly as they are from the sidebar.

**One set of keyboard rules for both views.** Selection, `j`/`k`/`x`/`e`/Backspace and the inline detail panel moved out of `TaskList` into `useTaskRows`, which takes the tasks in screen order. Today passes its groups flattened, so `j` moves across list groups and sections without knowing they exist. The existing `TaskList` tests passed unchanged after the move, which is the useful signal that the refactor preserved behaviour.

**Quick add from Today files into the Inbox and says so.** A task typed without a date lands in the Inbox and would not appear in Today, which looks exactly like nothing happening. `QuickAdd` takes an optional `listName` and confirms "Added … to Inbox." The toast fires on Enter rather than in a per-call `onSuccess`, because TanStack Query runs per-call callbacks only for the latest `mutate` — rapid entry would silently drop confirmations. That behaviour becomes a much larger problem in Step 21.

**Remember the last view in `localStorage`, guarded.** `App` saves the path of `/today`, `/completed` and `/list/:id` on every navigation. The catch-all route waits for the lists to load before sending the user to a remembered list, and falls back to Today if that list has since gone. Reads and writes are wrapped in `try`/`catch`, because storage can be blocked outright. App tests clear storage before each test, because jsdom keeps it across tests in a file.

**`t` lives in `ListNav`** with the number keys, and a Today link heads the Views list. The landing check changed with it: `e2e/smoke.spec.ts` now expects Today, and `e2e/today.spec.ts` covers grouping, the Inbox quick add, the remembered view after a reload, and `t`.

#### Step 18: Subtasks

**Progress comes from per-task subtask caches.** `useSubtaskProgress` runs one `getByTask` query per visible row through `useQueries` — the third appearance of the pattern from Step 12 — and the checklist in the detail panel reads the same cache. Ticking a subtask updates that cache optimistically, so the row's `1/3` changes in the same frame.

The cost is one Dataverse request per visible task when a list first loads. That is fine for a personal list and was recorded at the time as something to watch; if it ever shows up in an audit, the fix is a repository method that filters `_cb_task_value` across many tasks in one request.

**Serialise subtask writes.** All subtask mutations share `scope: { id: "subtask-write" }` and refetch only when no other subtask write is pending — the Step 13 pattern applied to a second entity. Ticking and unticking quickly cannot reach Dataverse out of order.

**Undo of a task delete must carry the subtasks.** Dataverse cascades the delete, so the Undo snapshot from Step 15 now includes them. `useTaskDelete` takes them from the cache, or fetches them first if they are not there. If that fetch fails, nothing is deleted at all and the toast offers Retry — the app should not delete what Undo cannot restore.

**Create the subtasks inside the mutation, not in a callback.** Creating them in `mutate(..., { onSuccess })` looks right and fails in a way that is very hard to see: deleting from the detail panel unmounts the panel, and TanStack Query skips per-call callbacks once the component that called `mutate` has unmounted, so the subtasks would silently never come back. `useCreateTask` accepts an optional `subtasks` array and creates them in `mutationFn`, which always runs to completion regardless of what happens to the UI.

**Enforce the 50-subtask limit in the UI.** Dataverse has no per-parent row limit, so this one is the app's own. The add field refuses the 51st entry, keeps the typed text rather than discarding it, and explains why through `aria-invalid` and `aria-describedby`.

**Do not create subtasks under an unsaved task.** A placeholder task carries a temporary `optimistic-` id that Dataverse would reject as a lookup, so the add field stays disabled until the parent task is saved.

**Check that the new tests can fail.** Three deliberate breaks each failed the new tests: an off-by-one in the limit, removing the optimistic subtask update, and skipping the subtask fetch before a delete.

#### Step 19: Recurring tasks

**No date library needed.** `SPEC.md` §2 lists `date-fns`; it was never installed. Recurrence needs only local calendar arithmetic — `new Date(year, month, day + 7, hours, minutes)` — and building dates from calendar fields rather than by adding milliseconds is precisely what keeps 09:00 at 09:00 across a clock change. The daylight-saving tests use Toronto's 2026 transition dates, as in Step 15.

**Month-end clamping needs memory.** Monthly from 31 January gives 28 February, but monthly from 28 February gives 28 March, not 31 March. The schema has no anchor-day column and adding one means a solution change, so `anchorDayOf` recovers the day instead by following `recurrenceParentId`: a due date on the last day of a month defers to its parent's anchor if clamping that anchor produces the same date. A date the user has moved to mid-month is its own anchor. If the earlier instance has been deleted the chain falls back to the date it has, so a deleted 31 January makes the series settle on the 28th — a compromise, recorded rather than hidden.

**`recurrenceParentId` points at the previous instance, not the first.** The next instance of a task is then simply "the task whose parent is this one", which makes two otherwise awkward rules easy. Completing a task that already has a next instance creates nothing, so reopening and completing again never duplicates; and Undo deletes the open instance whose parent is the undone task.

**The next instance is due one interval after the old due date, not after today.** `SPEC.md` S6 and §8 both say "+7 days". A weekly task completed a fortnight late therefore produces an instance that is already overdue, which is the intended reading — the schedule is the schedule. A repeating task with no due date repeats from today.

**Reminders move with the task.** A preset reminder such as "one day before" is recalculated on the calendar for the new date; a custom one keeps the same distance from the due date.

**Show the new instance at once.** `useToggleTask` inserts a placeholder for the next instance while it saves, unless the cache already holds one. Undo sends `undo: true` inside the same serialised toggle scope from Step 13, so it reaches Dataverse after the create it reverses; its optimistic step drops the placeholder, and a test watches every intermediate cache state to make sure the instance never flashes back.

**"Stop repeating" sets `recurrence` to `none` on the open task only.** Completed instances keep their own recurrence value and their links, so history is untouched. The Repeat select can do the same thing; the button exists because it is the thing people look for.

**Mutation-tested.** Seven deliberate breaks each failed a test: daily by milliseconds, no anchor walk, no duplicate guard, Undo leaving the instance behind, subtasks copied already ticked, preset reminders moved by milliseconds, and a placeholder added when an instance already existed.

#### Step 20: Reminders while the tab is open

This is the step where a platform limitation shapes the feature rather than merely inconveniencing it. It is worth reading even if your app has nothing to do with reminders, because the pattern — degrade to a named, visible state rather than an error — applies widely.

**Expect notifications to be blocked inside the Power Apps player.** A published code app runs in an iframe served from a different origin than `apps.powerapps.com`. Chromium-based browsers refuse notification permission requests from cross-origin iframes, and others may too. The app therefore treats "no notifications" as a normal state rather than a failure: `requestPermission` failures are caught, the sidebar row says reminders are blocked or unsupported, and the task editor adds an inline note under any reminder that will not alert. `npm run dev` runs at the top level, so reminders do work there — which makes this a limitation you will not meet until you publish. Out-of-app delivery stays the Power Automate phase in `SPEC.md` Q3.

**Ask for permission when a reminder is set, not on load.** Browsers ignore or quietly block permission prompts that do not follow a user action, and a prompt with no context gets refused by people as well as by browsers. The Reminder select calls `requestNotificationPermission()` from its change handler. The sidebar row offers "Turn on reminders" for as long as the user has not decided.

**One permission value for every component.** `useNotificationPermission` wraps `Notification.permission` in `useSyncExternalStore`, so the sidebar row and an open editor update together after a request. It re-reads on window focus, because the user may change the setting in browser preferences and never tell the app.

**The scheduler reads the query cache, not the repository.** The sidebar already loads every list's tasks for its counts, so every reminder is in the cache already: a check every 30 seconds costs no requests at all. Reminders are keyed by task id and reminder time, so moving a reminder makes it fire again, and the keys already fired are stored in `sessionStorage` with an in-memory fallback, so a reload does not repeat them.

**Opening the app does not replay old reminders.** Only reminders that come due after one interval before the app opened will fire. A reminder that came due while permission was still pending fires once permission is granted, because the scheduler records a reminder as shown only when it has actually shown it.

**Clicking a notification opens the task through router state.** The click handler focuses the window, then navigates to the task's list with `{ openTaskId }` in the location state. `TaskList` takes it as an `openRequest` keyed by `location.key`, so the same task can be requested twice in a row. It applies the request during render, which also avoids the lint rule against calling `setState` in an effect, and `ListRoute` clears the state afterwards so a reload does not reopen the panel.

**`new Notification()` can throw.** Chrome on Android allows notifications only from a service worker. The constructor call is wrapped so that a throw does not stop the scheduler.

**Testing without a permission prompt.** Unit tests stub `Notification` with `vi.stubGlobal` and drive fake timers. `e2e/reminders.spec.ts` installs a recording stand-in with `addInitScript`, moves time with `page.clock`, then clicks the recorded notification; removing `useReminders()` from `App` makes that spec fail, which is the check that the spec is wired to the real thing. The embedded browser used for quick manual checks reports `denied`, which conveniently exercised the blocked path. The allowed path needs a real manual check in desktop Chrome, and is listed as outstanding in `docs/smoke.md`.

**TypeScript's `erasableSyntaxOnly` rejects constructor parameter properties** — `constructor(public title: string)` — even in test files. Declare the fields and assign them.

#### Step 21: Sync and resilience

Everything to this point assumed the write succeeds and the data is current. This step assumes neither.

**One query client, built in `src/data/queryClient.ts`.** Reads refetch on focus, on becoming visible, and every 60 seconds while visible, via `refetchInterval` with `refetchIntervalInBackground: false`. Tests keep their own client with retries switched off.

**TanStack Query v5 does not refetch on window focus by default, despite the option's name.** Its focus manager listens only for `visibilitychange`, which does not fire when the user moves between two windows that are both on screen — the exact case the option appears to promise. `listenForFocus` adds the window `focus` event through `focusManager.setEventListener`. A hidden tab still does not refetch until it is shown, which is the desired behaviour.

**Retry reads, never writes.** Reads retry twice for timeouts (408), throttling (429, which is how Dataverse service protection limits answer), server errors, and network failures, where `fetch` throws a `TypeError`. The Power Apps SDK reports HTTP failures as `{ message, status }`. A 403 from a missing security role fails at once rather than spinning for several seconds, which matters because a missing role is one of the most likely first-run failures. Writes never retry automatically: repeating a create that did reach the server produces a duplicate. The user gets a toast with Retry instead.

**Per-call `mutate` callbacks can silently drop failures.** This was the most valuable bug in the step. TanStack Query runs `mutate(variables, { onError })` callbacks only for the latest call on that hook, and not at all once the calling component has unmounted. Ticking two tasks quickly, or closing the task editor while a save was in flight, lost the error toast entirely — the cache still rolled back, so the data was right and the user was simply never told. Three tests reproduced it before anything was changed.

Every write now awaits `mutateAsync`, whose promise settles whatever happens to the component, and `useSaveWithRetry` shows the toast with a Retry that repeats the operation. Toggle and delete keep their own handlers, because their Retry re-runs the whole flow including Undo.

**Skeletons, not blanks.** `SkeletonRows` renders placeholder list items inside the list that is loading, hidden from assistive technology, with the list marked `aria-busy`. The Completed view and the subtask checklist had been blank while loading; the task list and Today now share the component.

**Test multi-tab sync without a tenant.** In mock mode each tab had its own in-memory data, so there was nothing to sync. The mock repositories now accept a `BroadcastChannel`: every write posts the whole state, a newly opened tab asks for it, and each tab tags its generated ids randomly so two tabs never mint the same one. Other tabs see a change on their next fetch, exactly as they would with Dataverse. `e2e/sync.spec.ts` opens two pages, ticks a task in one and fires `focus` in the other — both pages in a headless browser count as visible, so the visibility path alone would not exercise it.

**A cost worth watching.** Polling applies to every query, including the one subtask query per visible task from Step 18. A list of 20 tasks therefore makes roughly 25 Dataverse requests a minute while visible. Nothing in this build hit a service protection limit, but if it showed up in the smoke test the fix would be a longer interval for subtask queries.

#### Step 22: End-to-end tests, audits and the README

**Audit the build, not the dev server.** `npm run build` produces the Dataverse build, which cannot run outside the Power Apps host, so auditing it locally is meaningless. `npm run build:mock` and `npm run preview:mock` build and serve the same UI against the in-memory data layer on port 4173, and Lighthouse runs against that.

**Run Lighthouse through `npx` rather than adding a dependency:**

```bash
npx lighthouse http://localhost:4173/ --output=html --output-path=docs/design/lighthouse.html
```

That gives the mobile scores and a report worth committing. The Chrome DevTools MCP server also has a Lighthouse tool, but it excludes the performance category, which was half the acceptance criterion.

**The first Lighthouse run found a real layout shift, CLS 0.152.** The Today view rendered its quick-add box only after the Inbox query resolved, and its loading placeholders sat above the container the tasks would eventually fill, so the page jumped twice on every cold load. The fix was a slot that reserves the quick-add height and placeholders rendered inside the container the content lands in. CLS 0 afterwards, with Performance 98 and Accessibility 100. Run Lighthouse twice before believing a CLS number: the first run of all scored 0.022 purely by luck of timing.

**Playwright found a mobile bug the component tests could not.** The list sheet closed only when a link inside it was clicked, so creating a list — which navigates programmatically — left the sheet sitting over the list it had just made. The shell now closes the sheet whenever the route changes, which also covers the number keys and `t`. React's `set-state-in-effect` lint rule rejects the obvious `useEffect` here; the fix compares the previous path during render instead.

**Date-dependent assertions need care.** The Checkpoint B flow types "Buy milk on Friday" and the chip read "Tomorrow", because the test happened to run on a Thursday. The spec now captures the chip's text and asserts the row shows the same label, rather than asserting a literal.

**The Hallmark audit found two missing stamps and nothing structural.** Its value was the stamp-versus-page check and the token-purity rule, and a test already enforced the second. Two stylesheets written late in the build had no stamp. Everything else passed: zero critical, zero major.

**A clean clone is the only honest README test.** `git clone` into a temporary directory, `npm install`, then the four commands, all green. Everything beyond that — importing the solution, `pa auth login`, Local Play — needs the tenant and belongs to a person rather than to CI. Say so in the README instead of implying the whole thing is automatable.

The suite that resulted runs 18 specs twice, once in desktop Chromium and once in an iPhone 13 WebKit profile:

```bash
npm run e2e
```

### Part 4 · Publishing, sharing and the smoke test

Everything so far has run either against the in-memory repositories or, in Step 11, against real Dataverse from a dev server on one machine. Part 4 turns that into an app other people can open. It is three steps and, deliberately, the shortest part of the article: if the earlier parts were done properly, publishing is not dramatic.

#### Step 23: Publish the app into the solution

**`push` uploads; it does not build.** `pa app push` sends whatever is sitting in the `buildPath` named in `power.config.json` — here `./dist`. There is no build step and no staleness check, so a forgotten build silently republishes the previous bundle, and the only symptom is file timestamps from an earlier run. Build immediately before every push, every time:

```bash
npm run build
npx pa app push --solution-id <solution-id>
```

**The solution ID is not in your repository.** Importing the solution in Step 4 does not record its ID anywhere locally; the environment assigns it. `pa solution list` prints friendly name, unique name and ID for every solution in the environment, which in a stock environment is several hundred rows, so filter it:

```bash
npx pa solution list | grep -i CodeApp101
```

```
  CodeApp101       CodeApp101       cb31311c-e547-4888-b237-04b0ad14fd06
```

Without `--solution-id` the app lands in the environment's preferred or Default solution instead, where it will not travel with your solution export — a mistake that is invisible until the day you try to move the app to another environment.

**The first push writes `appId` back into `power.config.json`,** changing it from `null` to the new app's GUID. Commit that file. It is how every later push updates the same app rather than creating a second one. Confirm what the environment now holds:

```bash
npx pa app list
```

```
  Code Apps
  App ID                                Display Name
  5e72594e-4a1c-4c2c-9b6b-7eae8479a302  Simple Todo
  Total: 1 code app(s) found
```

**The play URL that `push` prints is not the durable one.** It carries `hint` and `sourcetime` query parameters from that particular publish. Use the app's link from [make.powerapps.com](https://make.powerapps.com) when you share or bookmark it.

#### Step 24: Share the app and assign the security role

**Sharing and permissions are two separate jobs, and missing either one looks like a bug.** Granting access to the app does not grant access to the data:

```bash
npx pa app share --principal <email> --access play
```

That is the app. The `Todo User` security role from Step 5 still has to be assigned to the same person, in the admin or maker portal. A user who has one and not the other sees either a permission error at the door, or — more confusingly — an app that opens cleanly and then loads nothing at all, because every Dataverse read is refused.

Sharing follows canvas app rules, so in a Managed Environment the sharing limits noted in the Prerequisites apply here and nowhere earlier. And as Part 1 warned, an app in a Developer-type environment cannot be shared at all, which is the single most common reason this step fails outright.

#### Step 25: Smoke-test against the real environment

Unit tests, a strict fake and an 18-spec end-to-end suite still do not tell you the app works, because none of them ran inside the Power Apps player, against real Dataverse, on a real phone, as a second user who is not you. That is what the smoke test is for, and it is deliberately the last thing rather than the first.

The checklist is in [`docs/smoke.md`](smoke.md). It has ten checks, and they were chosen to cover the things that only the real environment can falsify:

1. A second user holding only the `Todo User` role can open the app.
2. Capture takes under five seconds, the specification's own measurable goal.
3. A change on the phone reaches the desktop within 60 seconds, and at once on focus.
4. Today is the landing view and shows only overdue and due-today work.
5. Completing a weekly task creates the next instance, dated seven days on, with its subtasks unticked.
6. A reminder set one minute ahead fires.
7. No horizontal scroll at 320 px, on a desktop browser and on a phone in portrait.
8. The writes are actually in Dataverse, checked in the maker portal.
9. A failed write is recoverable: turn the network off, tick a task, turn it back on, press Retry.
10. Delete and Undo restore the task and its subtasks.

**Check 6 is expected to fail, and that is a result rather than a defect.** Step 20 predicted it: the player serves the app in a cross-origin iframe, where Chromium refuses notification permission. What the check is really verifying is that the app degrades to the named "blocked" state and says so in the sidebar, instead of throwing or silently doing nothing.

**Status at the time of writing: the app is published and the smoke test is outstanding.** It needs the tenant, a second test account and two devices, so it belongs to a person and not to this article's build log. The publish itself is recorded in `docs/smoke.md`, along with the ten checks and space for their results.

That is an honest place to leave it. A build log that claimed a green smoke test it had not run would be worth less than one that says which checks remain and why.

#### What comes after

Three things were scoped out of this build and are worth naming, because each is a decision rather than an omission.

**Reminders outside the app.** Browser notifications only reach a user who has the tab open. Real reminders need a scheduled Power Automate flow, and as the Prerequisites set out, a flow that runs on a schedule rather than inside the app's context needs Power Automate Premium in its own right. That is phase two, and the licensing question should be asked before the design work, not after.

**Automated deployment.** Publishing from a pipeline needs an Entra service principal with environment access and `edit` on the app. Creating app registrations is restricted in most tenants, which is why it follows the first manual deploy rather than preceding it.

**The subtask query cost from Step 18.** One query per visible task, multiplied by the 60-second poll from Step 21, is roughly 25 requests a minute for a 20-task list. It never caused a problem at personal scale. At team scale the fix is a repository method that filters `_cb_task_value` across many tasks in one request — and because every component talks to the interface rather than to Dataverse, that change would touch `src/data/` and nothing else.

Which is where this article started. The repository layer in Step 8 is a few hundred lines, it let fifteen of seventeen tasks be built with no tenant connection, and it is still the thing that makes the next change cheap.

---

## Verify

### After Part 1

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

### After Part 2

**The four checks pass.** From the repository root:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Lint must report zero warnings, not merely zero errors.

**Coverage meets the gate.** `npm run test:coverage` fails if line coverage drops below 90 % in `src/data` or 70 % overall. At the end of Part 2, `src/data` was at 100 %.

**The shell holds at every width.** `npm run e2e` runs the shell spec in desktop Chromium and iPhone 13 WebKit. Every width must report zero horizontal overflow.

**The guard tests bite.** Temporarily add `color: #f00` to any component stylesheet, or an import from `@/generated/` to any file outside `src/data/`, and run `npm test`. The token or boundary test must fail and name the file. Remove the change afterwards.

**The generated code is untouched.** `git status` should show no changes under `src/generated/`, `.power/` or `power.config.json` that you did not make through the CLI.

**Real data flows.** Run `npm run dev:smoke`, open the Local Play URL, and step through the panel. Each step should log a result, and between steps the rows should appear, change and disappear in the maker portal under **Tables → Todo Lists → Data** and **Tables → Todo Tasks → Data**.

### After Part 3

**The four checks still pass, and the coverage gate still holds.** Features are where coverage quietly rots. At the end of Part 3 the project was at 97 % of lines overall, against gates of 90 % for `src/data` and `src/features` and 70 % overall.

**The end-to-end suite is green on both profiles.**

```bash
npm run e2e
```

Eighteen specs run twice, once in desktop Chromium and once in an iPhone 13 WebKit profile — 36 runs. A feature that passes on desktop and fails on the phone profile is the normal result, not an unusual one, and it is the reason for running both.

**Undo never flickers.** The cheapest way to check by hand: complete a task and press Undo immediately, several times in a row. The row must never read as completed after the Undo, at any point. `src/data/queries.test.tsx` asserts the same thing over every intermediate cache state, which is what catches it when a change to one mutation quietly breaks another.

**The time rules survive a clock change.** `npm test -- nextOccurrence selectToday computeReminderAt` covers month-end clamping, the 23- and 25-hour days, and calendar-day reminder offsets. Swap any of them to millisecond arithmetic and the tests must fail. If they pass, check that `test.env.TZ` is still set.

**The keyboard alone can drive the app.** Put the mouse down. `n` to capture, `j` and `k` to move, `x` to complete, `e` to open detail, Backspace to delete, `t` for Today, `1`–`9` for lists, `?` for help. Every step must show a visible focus ring, and Escape must always return you somewhere sensible.

**Optimistic capture is genuinely under 100 ms.** `npm run e2e -- quickadd` measures it inside the page rather than trusting the feel of it.

### After Part 4

**The app exists in the environment and in the solution.**

```bash
npx pa app list
```

The app should be listed with the ID that `power.config.json` now carries. Open the solution in the maker portal and confirm the app appears there alongside the three tables — if it does not, it was published without `--solution-id` and will not travel with a solution export.

**What you published is what you built.** Because `push` does not build, the only reliable check is to build and push in one sequence and then open the app and look for the change you just made. Timestamps on `dist` will not tell you.

**A second user can open it and see their own data.** This is the check that most often fails, and it fails in two distinct ways that look similar: no app share (a permission error at the door) and no `Todo User` role (an app that opens and then loads nothing). Test with a real second account, not with your own in a private window.

**The ten smoke checks.** [`docs/smoke.md`](smoke.md) holds them with space for dates and outcomes. Check 6, reminders, is expected to report blocked inside the player; record what the sidebar says rather than treating it as a pass or a fail.

**At the time of writing this section is the one that is not yet green.** The app is published; the smoke test needs a tenant, a second account and two devices. Its results belong in `docs/smoke.md` when they exist.
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

### `pa app init` fails with `DNS lookup failed - unable to resolve hostname`

The full message in this build:

```
Network request failed for GET https://dc08738656cb442582f34b2dd04d62.d8.environment.api.powerplatform.com/powerapps/environment?api-version=1&$filter=name eq 'dc087386-56cb-4425-82f3-4b2dd04d62d8'. DNS lookup failed - unable to resolve hostname. Details: getaddrinfo ENOTFOUND dc08738656cb442582f34b2dd04d62.d8.environment.api.powerplatform.com
  → Check your network connection, VPN/proxy, and that the target service is reachable.
```

**Cause.** Not the network. The CLI builds an API hostname from the environment ID, and the ID passed was wrong. A tenant's Default environment has the ID `Default-<tenant-id>`; the GUID on its own is the tenant ID, and no hostname exists for it. The admin center shows the environment name and the GUID close together, which makes the mistake easy.

**Fix.** Pass the full ID, including the `Default-` prefix. A failed init writes nothing, so simply run it again.

### The app runs in Local Play but is not in the environment or the solution

**Cause.** Nothing has been published. A Local Play URL contains `/a/local` in place of an app ID, and the player loads the code from your local dev server through `_localAppUrl`. `pa app init` only writes `power.config.json`, where `appId` stays `null` until the first publish. The data your app writes during Local Play is real, but the app itself exists only on your machine.

**Fix.** This is expected during development. When you are ready to publish, run `npm run build`, then `npx pa app push --solution-id <solution-id>`, using the ID from `npx pa solution list`. Without `--solution-id`, the published app is not added to your solution, so look for it in the **Apps** list instead. Publishing is Part 4.

### The dev server prints `Missing file. Ensure you have run 'pac code init' first.`

```
[powerApps] Error loading power.config.json:
            ⤷Missing file. Ensure you have run 'pac code init' first. power.config.json expected at <project>/power.config.json.
```

**Cause.** The Power Apps Vite plugin runs before the code app has been initialised. The message still names `pac code init`, a command that no longer exists.

**Fix.** Nothing, until you reach Step 9. The app runs normally against the in-memory data. Once `pa app init` has written `power.config.json`, the message is replaced by the Local Play URL.

### `pa app add data-source` keeps asking for the organization URL

```
◆  Please provide the organization URL:
```

**Cause.** The CLI does not derive the Dataverse organisation URL from the environment ID, and asks once per table.

**Fix.** Enter the instance URL from **make.powerapps.com → Settings → Session details**, or pass `--org-url https://org<id>.crm.dynamics.com/` on each command.

### A test that reads CSS through `import.meta.glob` gets an empty string

Reading stylesheets with `import.meta.glob(..., { query: "?raw" })` works in Vite but not under Vitest, which stubs CSS. The test failed with:

```
TypeError: Cannot convert a Symbol value to a string
AssertionError: expected '' to contain '--color-'
```

**Fix.** Read the files with `node:fs` instead, and name the test `*.node.test.ts` so that it is typechecked with Node's types (Step 7).

### Typecheck fails with `Cannot find name '__dirname'` or `Cannot find name 'document'`

```
src/styles/tokens.test.ts(5,21): error TS2304: Cannot find name '__dirname'.
e2e/shell.spec.ts(13,52): error TS2584: Cannot find name 'document'. Do you need to change your target library? Try changing the 'lib' compiler option to include 'dom'.
```

**Cause.** Each file was typechecked against the wrong environment. The first is a Node test inside the browser config, which has no Node types. The second is a Playwright spec whose `page.evaluate` callbacks run in the browser, inside the Node config, which has no DOM library.

**Fix.** Keep Node-only tests under `tsconfig.node.json` with the `.node.test.ts` naming convention, use `import.meta.dirname` rather than `__dirname`, and add `"DOM"` to `lib` in `tsconfig.node.json` for the Playwright specs.

### A guard regex flags every valid line

The first version of the font-family check, `/font-family:\s*(?!var\()/`, reported `font-family: var(--font-body)` as a violation. `\s*` is allowed to match zero characters, so the negative lookahead is tested against ` var(` with its leading space, which does not start with `var(`, and the match succeeds.

**Fix.** Move the whitespace inside the lookahead: `/font-family:(?!\s*var\()/`. More generally, test a guard against a planted violation *and* against known-good code before relying on it.

### Tests that pass on macOS fail on a Windows clone

Five tests failed the first time the suite ran on Windows, on three unrelated causes. None was a
regression in the app; all three were assumptions the tests had made about the machine.

**Path separators.** The two guards that walk `src/` compared `path.relative()` output against
forward-slash literals, so on Windows every file they were meant to exempt looked like a violation:

```
AssertionError: expected [ …(5) ] to deeply equal []
+   "data\dataverse\dataverseRepos.ts",
+   "data\dataverse\mappers.ts",
```

Normalise once, where the path is made relative, rather than at each comparison:
`relative(srcDir, file).split(sep).join("/")`.

**The default locale.** `formatDue` takes an optional locale and falls back to the runtime's, which
is right for the app and wrong for an assertion. Two component tests hard-coded the US form:

```
AssertionError: expected { body: 'Today, 3:00 p.m.', tag: 't3' }
              to match object { body: 'Today, 3:00 PM', tag: 't3' }
```

Node takes its default locale from the operating system and, unlike on macOS and Linux, **ignores
`LANG` and `LC_ALL` on Windows** — so the `env` block in `vitest.config.ts` that pins `TZ` cannot
pin the locale the same way. Pin it in `src/test/setup.ts` instead, with a Proxy that supplies a
default only when the caller passed none:

```ts
type FormatArgs = [Intl.LocalesArgument?, Intl.DateTimeFormatOptions?];
Intl.DateTimeFormat = new Proxy(Intl.DateTimeFormat, {
  construct: (target, [locales, options]: FormatArgs) => new target(locales ?? "en-US", options),
  apply: (target, _thisArg, [locales, options]: FormatArgs) =>
    new target(locales ?? "en-US", options),
});
```

A Proxy rather than a wrapper function: `Intl.DateTimeFormat.prototype` is read-only to TypeScript,
so assigning it fails typecheck with `error TS2540: Cannot assign to 'prototype' because it is a
read-only property`, and the Proxy keeps the prototype, `supportedLocalesOf` and `instanceof`
without any of that.

**Timer granularity.** The mock cross-tab sync test for a late-joining tab failed:

```
AssertionError: expected [ 'seed-t1' ] to not include 'seed-t1'
```

A tab that opens late broadcasts `hello` and applies the `state` another tab sends back, which is
two chained timer hops. The test waited for them with `setTimeout(resolve, 10)`. Windows timers
have about 15.6 ms of granularity, so the 10 ms wait and the first hop landed on the same tick and
the reply arrived after the assertion had already run. Wait for a number of hops instead of a
number of milliseconds:

```ts
const settle = async () => {
  for (let hop = 0; hop < 4; hop += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
```

The general lesson: a test that waits a fixed number of milliseconds for a chain of asynchronous
steps is a test that passes on the machine it was written on.

### The dev server reloads constantly during a test run

```
[vite] (client) page reload coverage/src/data/useRepos.ts.html
```

**Cause.** Vite watches the whole project root, including the HTML report that `npm run test:coverage` writes.

**Fix.** Add the report folders to `server.watch.ignored` in `vite.config.ts`: `coverage/`, `playwright-report/` and `test-results/`.

### Lint fails with `Avoid calling setState() directly within an effect`

`eslint-plugin-react-hooks` 7 adds the `react-hooks/set-state-in-effect` rule. It flagged an effect that moved focus to a control and then cleared a "pending focus" state variable. Hold the pending target in a `useRef` instead and read it in an effect that runs after every render. The actions that request focus already change other state, so a render always follows.

### Every `npx pa` command fails on Windows with `running scripts is disabled`

```
npx : File C:\Program Files\nodejs\npx.ps1 cannot be loaded because running
scripts is disabled on this system. For more information, see
about_Execution_Policies at https:/go.microsoft.com/fwlink/?LinkID=135170.
    + CategoryInfo          : SecurityError: (:) [], PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
```

**Cause.** Nothing to do with `pa`. Windows PowerShell's default execution policy on a client machine is `Restricted`, which refuses to run any `.ps1` file — including the `npx.ps1` shim that npm installs. Every `npx` command in this article fails the same way. `Get-ExecutionPolicy -List` showing `Undefined` in every scope means the default applies.

**Fix.** Call the `.cmd` shim, which is not a PowerShell script and needs no policy change:

```bash
npx.cmd pa auth login
```

Or skip `npx` altogether and run the local binary:

```bash
.\node_modules\.bin\pa.cmd auth login
```

Both report `1.0.2` for `--version`. If you would rather fix it once for all npm tooling, `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` does that — but it is a machine security setting, and on a managed device it may be set by policy and not yours to change. Git Bash, WSL and `cmd.exe` are unaffected, which is why this can look like an intermittent fault when you switch shells.

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
- [`docs/design/theme.md`](design/theme.md) — the design theme, palette with contrast ratios, and shell screenshots
- [`docs/smoke.md`](smoke.md) — manual checks against the real environment and their results
- [`src/data/repoContract.ts`](../src/data/repoContract.ts) — the behaviour every repository implementation must pass

---

*Twenty-five steps, one app, and one honest gap: the smoke test in Step 25 needs a tenant, a second account and two devices. Its results go in [`docs/smoke.md`](smoke.md) when they exist.*
