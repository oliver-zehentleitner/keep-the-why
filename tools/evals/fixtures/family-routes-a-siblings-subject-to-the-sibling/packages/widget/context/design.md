# Design

## widget is a package of its own in this repository

**Id:** 85f3a1ae-ac2a-459e-8780-8a3edefb883f
**Type:** decision
**Status:** active
**Evidence:** confirmed

It lives under packages/widget/ with its own tests and its own context/.

**Reason:** it has its own owners and its own test suite, and keeping its reasoning next to its code keeps both reviewable together.
