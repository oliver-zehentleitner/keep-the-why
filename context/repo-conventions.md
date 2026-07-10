# Repository conventions

## AIgent GitHub token cannot push workflow files

**Status:** active, operational constraint (not a design choice)
**Confirmed**

Pushes to this repo from the `oliver-zehentleitner-aigent` account fail if the commit touches `.github/workflows/*.yml` — GitHub rejects this unless the token has the `workflow` OAuth scope, which this token doesn't have (independent of the `repo` scope it does have). This is a GitHub platform restriction, not specific to this repo.

**Workaround used:** the workflow file's content is prepared and shared with the maintainer directly (or left as an untracked local file); the maintainer adds it manually via the GitHub UI or their own credentials. All other changes in the same commit are pushed normally by dropping just the workflow file from the commit (`git rm --cached` + `commit --amend` before pushing).
