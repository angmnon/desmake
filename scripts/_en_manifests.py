"""Rewrite Chinese descriptions/notes in the Agnes batch manifests into English.

Descriptions are derived from each item's existing English `prompt` so the copy
stays faithful to the artwork and is guaranteed to be English-only.
"""
import io, json, re

FILES = [
    "scripts/agnes_batch.json",
    "scripts/agnes_batch_2.json",
    "scripts/agnes_batch_3.json",
]
NOTES = {
    "scripts/agnes_batch.json": (
        "Desmake batch generation manifest - built on 2026 POD market research across "
        "desmake's 8 categories / 6 adapters. One prompt per item (count=1); niche, "
        "design-led and trademark-safe."
    ),
    "scripts/agnes_batch_2.json": (
        "Desmake batch generation manifest - batch 2. One prompt per item (count=1); "
        "original, trademark-safe and design-led. Reuses the existing category tags so "
        "everything files correctly in the marketplace."
    ),
    "scripts/agnes_batch_3.json": (
        "Desmake batch generation manifest - batch 3 (new themes). 24 standalone prompts "
        "(count=1); original, trademark-safe and design-led. Reuses the existing category "
        "tags so everything files correctly in the marketplace."
    ),
}
CJK = re.compile(r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]")


def describe(prompt: str) -> str:
    """Build a short English description from the English prompt."""
    parts = [p.strip() for p in prompt.split(",") if p.strip()]
    picked = parts[:2] if len(parts) >= 2 else parts[:1]
    s = ", ".join(picked)
    s = s[0].upper() + s[1:] if s else s
    if not s.endswith("."):
        s += "."
    return s


total = 0
for path in FILES:
    raw = io.open(path, encoding="utf-8").read()
    data = json.loads(raw)
    if path in NOTES:
        data["note"] = NOTES[path]
    changed = 0

    def walk(node):
        global changed
        if isinstance(node, dict):
            if "prompt" in node and "description" in node:
                if CJK.search(str(node.get("description", ""))):
                    node["description"] = describe(node["prompt"])
                    changed += 1
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(data)
    out = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    io.open(path, "w", encoding="utf-8", newline="\n").write(out)
    left = len(CJK.findall(out))
    total += changed
    print("%-32s descriptions rewritten: %-3d remaining CJK: %d" % (path, changed, left))

print("total rewritten:", total)
