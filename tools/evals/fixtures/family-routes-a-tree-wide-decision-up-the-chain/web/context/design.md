# Design

## The dashboard renders on the server, no single-page app

**Id:** b5d9759c-c95e-40c8-9282-8d927aef236a
**Type:** decision
**Status:** active
**Evidence:** confirmed

Pages are rendered by the cluster's management API.

**Reason:** nothing in the dashboard needs client-side state.
