# Architecture

## Single service, no queue between intake and gateway submission

**Status:** active
**Evidence:** confirmed
**Source:** design discussion, 2026-05

Orders are submitted to the payment gateway synchronously from the intake
handler instead of going through a message queue.

**Reason:** volume is low (hundreds per day), and a queue would add
operational surface for no measurable benefit at this scale.

**Rejected alternative:** an SQS-style queue between intake and submission.
Rejected until volume actually requires it; revisit when sustained load
crosses ~10 orders/second.
