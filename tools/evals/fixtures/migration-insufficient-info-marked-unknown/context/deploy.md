# Deployment

## Rolling restarts, one instance at a time

> Superseded 2025-10: replaced by blue-green deploys.

Instances were restarted one at a time behind the load balancer, with a
30-second drain window each.
