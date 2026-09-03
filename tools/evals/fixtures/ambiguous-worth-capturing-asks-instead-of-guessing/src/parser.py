"""Feed file parser."""

import codecs


def parse_feed(raw: bytes):
    if raw.startswith(codecs.BOM_UTF8):
        raw = raw[len(codecs.BOM_UTF8):]
    return raw.decode("utf-8")
