# Design

## widget is a package of its own in this repository

**Id:** e9af4407-7bb0-43ca-ad77-1ee139db7637
**Type:** decision
**Status:** active
**Evidence:** confirmed

It lives under packages/widget/ with its own tests and its own context/.

**Reason:** it has its own owners and its own test suite, and keeping its reasoning next to its code keeps both reviewable together.
