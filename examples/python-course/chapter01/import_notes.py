"""Stage 1: eager import with lists, dicts, functions and explicit validation."""
import json
import sys


def normalize_note(raw):
    if not isinstance(raw, dict):
        raise ValueError("note must be an object")
    if set(raw) != {"id", "title", "tags"}:
        raise ValueError("note requires exactly id, title, tags")
    note_id = raw["id"]
    title = raw["title"]
    tags = raw["tags"]
    if not isinstance(note_id, str) or not note_id.strip():
        raise ValueError("id must be a non-empty string")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("title must be a non-empty string")
    if not isinstance(tags, list):
        raise ValueError("tags must be a list")
    clean_tags = []
    for tag in tags:
        if not isinstance(tag, str) or not tag.strip():
            raise ValueError("tag must be a non-empty string")
        clean = tag.strip().lower()
        if clean not in clean_tags:
            clean_tags.append(clean)
    return {"id": note_id.strip(), "title": title.strip(), "tags": clean_tags}


def import_notes(raw_notes):
    if not isinstance(raw_notes, list):
        raise ValueError("input must be a JSON array")
    notes = []
    seen = set()
    for raw in raw_notes:
        note = normalize_note(raw)
        if note["id"] in seen:
            raise ValueError("duplicate id: " + note["id"])
        seen.add(note["id"])
        notes.append(note)
    return notes


def main():
    if len(sys.argv) != 2:
        print("usage: python import_notes.py notes.json", file=sys.stderr)
        return 2
    try:
        with open(sys.argv[1], encoding="utf-8") as source:
            notes = import_notes(json.load(source))
    except (OSError, UnicodeError, ValueError) as error:
        print("import failed: " + str(error), file=sys.stderr)
        return 2
    print(json.dumps({"count": len(notes), "notes": notes}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
