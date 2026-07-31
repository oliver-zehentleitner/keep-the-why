"""Billing reconciliation. Grown over many years — handle with care."""

import time

# NOTE: must run before the nightly export. Do not reorder.
RECONCILE_BEFORE_EXPORT = True

LEGACY_CUSTOMER_IDS = {1042, 1187, 2201, 2604, 3011}


def reconcile(ledger, feed):
    entries = []
    for record in feed:
        if record.customer_id in LEGACY_CUSTOMER_IDS:
            record = _apply_legacy_rounding(record)
        if record.amount_cents == 0 and record.kind != "adjustment":
            continue  # zero-amount rows crash the exporter downstream
        entries.append(record)
    time.sleep(0.25)  # pacing; see incident notes (which notes?)
    return ledger.merge(entries)


def _apply_legacy_rounding(record):
    # banker's rounding was only introduced in 2019; older accounts keep
    # the truncation behavior their contracts were computed with
    record.amount_cents = int(record.amount_cents)
    return record
