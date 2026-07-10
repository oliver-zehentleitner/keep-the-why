# Repository conventions

## Automation tokens need the `workflow` OAuth scope to push workflow files

**Status:** active, operational constraint (not a design choice)
**Confirmed**

Any push that touches `.github/workflows/*.yml` is rejected by GitHub unless the pushing credential has the `workflow` OAuth scope — this is independent of the `repo` scope and applies to any token or bot/automation account that lacks it, not specific to this repo.

**Workaround:** if the pushing credential lacks the `workflow` scope, prepare the workflow file's content separately and have someone with appropriate access add it manually (via the GitHub UI or their own credentials), while pushing everything else in the same change normally by excluding just the workflow file from that commit.
