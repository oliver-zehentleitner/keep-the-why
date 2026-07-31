"""Feed file parser."""

import codecs


def parse_feed(raw: bytes):
    # some partners' exports arrive with a UTF-8 BOM; strip it or json.loads
    # chokes on the first key
    if raw.startswith(codecs.BOM_UTF8):
        raw = raw[len(codecs.BOM_UTF8):]
    return raw.decode("utf-8")
