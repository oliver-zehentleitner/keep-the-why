# Design

## rest is a package of its own in this repository

**Id:** 61fef076-1325-4339-86fa-e12c3f4b088f
**Type:** decision
**Status:** active
**Evidence:** confirmed

It lives under packages/rest/ with its own tests and its own context/.

**Reason:** it has its own owners and its own test suite, and keeping its reasoning next to its code keeps both reviewable together.
