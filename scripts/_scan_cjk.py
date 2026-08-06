"""Strip comments from TS/TSX/JS source, then report any remaining CJK (i.e. real, shippable text)."""
import io, os, re, sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "src"
EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".css")
CJK = re.compile(r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]")


def strip_comments(s: str) -> str:
    """Remove // and /* */ comments while preserving string literals."""
    out = []
    i, n = 0, len(s)
    quote = None
    while i < n:
        c = s[i]
        if quote:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(s[i + 1]); i += 2; continue
            if c == quote:
                quote = None
            i += 1
            continue
        if c in "\"'`":
            quote = c; out.append(c); i += 1; continue
        if c == "/" and i + 1 < n and s[i + 1] == "/":
            while i < n and s[i] != "\n":
                i += 1
            continue
        if c == "/" and i + 1 < n and s[i + 1] == "*":
            i += 2
            while i + 1 < n and not (s[i] == "*" and s[i + 1] == "/"):
                if s[i] == "\n":
                    out.append("\n")
                i += 1
            i += 2
            continue
        out.append(c); i += 1
    return "".join(out)


hits = 0
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in ("node_modules", ".next", "dist", ".git")]
    for fn in filenames:
        if not fn.endswith(EXTS):
            continue
        p = os.path.join(dirpath, fn)
        try:
            raw = io.open(p, encoding="utf-8").read()
        except Exception:
            continue
        if not CJK.search(raw):
            continue
        clean = strip_comments(raw)
        for ln, line in enumerate(clean.split("\n"), 1):
            if CJK.search(line):
                hits += 1
                print("%s:%d: %s" % (p.replace("\\", "/"), ln, line.strip()[:140]))

print("\n=== shippable CJK occurrences: %d ===" % hits)
