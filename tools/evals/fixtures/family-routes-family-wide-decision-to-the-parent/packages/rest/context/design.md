# Design

## rest is a package of its own in this repository

**Id:** d7b426d2-6d58-49db-8e17-0ec1ec78bb7b
**Type:** decision
**Status:** active
**Evidence:** confirmed

It lives under packages/rest/ with its own tests and its own context/.

**Reason:** it has its own owners and its own test suite, and keeping its reasoning next to its code keeps both reviewable together.
