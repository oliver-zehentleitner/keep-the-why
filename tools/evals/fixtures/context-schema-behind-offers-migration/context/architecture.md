# Architecture

## Single service, no queue between intake and gateway submission

**Confirmed** (2026-01-15, via design discussion)

Orders are submitted to the payment gateway synchronously from the intake
handler instead of going through a message queue, because volume is low and
a queue would add operational surface for no benefit at this scale.
