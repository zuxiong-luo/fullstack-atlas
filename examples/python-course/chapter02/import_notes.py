"""Stage 2: stream JSONL; leave ownership of the open file to the caller."""
import json
import sys


def normalize_note(raw):
    if not isinstance(raw, dict) or set(raw) != {"id", "title", "tags"}:
        raise ValueError("note requires exactly id, title, tags")
    if any(not isinstance(raw[key], str) or not raw[key].strip()
           for key in ("id", "title")):
        raise ValueError("id and title must be non-empty strings")
    tags = raw["tags"]
    if not isinstance(tags, list):
        raise ValueError("tags must be a list")
    result = []
    for tag in tags:
        if not isinstance(tag, str) or not tag.strip():
            raise ValueError("tag must be a non-empty string")
        normalized = tag.strip().lower()
        if normalized not in result:
            result.append(normalized)
    return {"id": raw["id"].strip(), "title": raw["title"].strip(), "tags": result}


def iter_notes(lines, *, max_chars=4096):
    if type(max_chars) is not int or max_chars < 1:
        raise ValueError("max_chars must be a positive integer")
    for line_number, line in enumerate(lines, start=1):
        if len(line) > max_chars:
            raise ValueError(f"line {line_number}: exceeds {max_chars} characters")
        if not line.strip():
            continue
        try:
            note = normalize_note(json.loads(line))
        except ValueError as error:
            raise ValueError(f"line {line_number}: {error}") from error
        yield note


def make_selector(required_tag):
    normalized_tag = required_tag.strip().lower()
    if not normalized_tag:
        raise ValueError("required_tag must not be empty")

    def matches(note):
        return normalized_tag in note["tags"]

    return matches


def select_unique(notes, predicate):
    seen = set()
    for note in notes:
        if note["id"] in seen:
            raise ValueError("duplicate id: " + note["id"])
        seen.add(note["id"])
        if predicate(note):
            yield note


def main():
    if len(sys.argv) != 3:
        print("usage: python import_notes.py notes.jsonl required-tag", file=sys.stderr)
        return 2
    try:
        matches = make_selector(sys.argv[2])
        with open(sys.argv[1], encoding="utf-8") as source:
            selected = select_unique(iter_notes(source), matches)
            for note in selected:
                print(json.dumps(note, ensure_ascii=False))
    except (OSError, UnicodeError, ValueError) as error:
        print("stream failed: " + str(error), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
