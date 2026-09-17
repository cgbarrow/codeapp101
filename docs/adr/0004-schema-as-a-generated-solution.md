# ADR 0004 · The Dataverse schema is generated from a script, not clicked

**Status:** Accepted, 16 September 2026 · **Context:** task 0

## Context

The three tables, their columns and their relationships could be created by hand in the maker
portal. That is quick once, but it leaves no record of the schema in the repository, cannot be
reviewed in a pull request, and cannot be recreated in a second environment without repeating the
clicks from memory.

## Decision

Keep the schema as code: **`solution/generate.py`** writes `solution.xml` and `customizations.xml`
and zips them into an importable unmanaged solution. Schema changes are made by editing the script,
regenerating, re-importing, and committing the result. The publisher prefix is `cb`; the solution is
`CodeApp101`.

`docs/dataverse-setup.md` keeps a click-by-click fallback, because a hand-authored solution package
can be rejected for reasons the portal does not explain well.

## Consequences

- The schema is reviewable and diffable, and a new environment is one import away.
- Import errors are cryptic and were hit twice: a missing privilege on the publisher, and a missing
  `NavPaneDisplayOption` on a referencing role. Both are recorded with their exact error text in the
  how-to article, which is the main reason this path was worth keeping.
- Editing XML by hand is unpleasant, so the script owns the file format and the tables are described
  in Python data structures.
- The generated package is unmanaged, which suits a single-environment personal project. A managed
  solution and a proper ALM pipeline are phase-two work.
