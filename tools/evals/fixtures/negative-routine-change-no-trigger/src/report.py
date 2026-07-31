"""Daily usage report."""


def build_report(usr, entries):
    lines = [f"report for {usr}"]
    for entry in entries:
        lines.append(f"{usr}: {entry.kind} {entry.amount_cents}")
    return "\n".join(lines)
