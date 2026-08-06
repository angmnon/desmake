"""One-off: translate all user-facing Chinese in pricing.ts to English."""
import io, re, sys

PATH = "src/lib/pricing.ts"

# sku id -> (English product name, English process)
M = {
    "wallart-poster-a4":       ("Poster A4",                      "UV / digital paper print"),
    "wallart-poster-a3":       ("Poster A3",                      "UV / digital paper print"),
    "wallart-poster-a2":       ("Poster A2",                      "UV / digital paper print"),
    "wallart-canvas-30":       ("Canvas Print 30x40cm",           "Inkjet on stretched canvas"),
    "wallart-canvas-40":       ("Canvas Print 40x60cm",           "Inkjet on stretched canvas"),
    "wallart-acrylic-30":      ("Acrylic Wall Art 30x40cm",       "UV print on acrylic panel"),
    "wallart-aluminum-30":     ("Aluminium Wall Art 30x40cm",     "UV print on aluminium composite"),

    "apparel-tee":             ("T-Shirt (Cotton Crewneck)",      "DTG direct-to-garment"),
    "apparel-hoodie":          ("Hoodie",                         "DTG direct-to-garment"),
    "apparel-sweatshirt":      ("Sweatshirt",                     "DTG direct-to-garment"),
    "apparel-tote":            ("Canvas Tote Bag",                "Screen / DTG print"),
    "pet-scarf":               ("Pet Bandana",                    "Digital print + stitching"),

    "office-notebook":         ("Notebook A5 (Custom Cover)",     "Digital print + perfect binding"),
    "office-stickersheet":     ("Sticker Sheet Set (5 sheets)",   "UV print + die-cut"),
    "collect-puzzle":          ("Jigsaw Puzzle (500 pieces)",     "Digital print + die-cut + box"),
    "collect-bookmark":        ("Bookmark (Acrylic / Metal)",     "UV print / laser engraving"),
    "collect-playingcards":    ("Playing Cards (54 + gift box)",  "Digital print + box assembly"),
    "collect-tradingcard":     ("Trading Card (Holographic PET)", "UV print + holographic foil"),
    "holiday-greeting":        ("Greeting Card (with Envelope)",  "Digital print + optional foil"),
    "holiday-postcard":        ("Postcard (Standard)",            "Digital print"),
    "holiday-calendar":        ("Calendar A4 (12 pages)",         "Digital print + binding"),
    "holiday-wrap":            ("Gift Wrap Sheet",                "Digital print"),

    "digital-phonecase":       ("Phone Case (TPU/PC)",            "UV print"),
    "digital-airpods":         ("AirPods Case",                   "UV print"),
    "digital-sleeve":          ("Laptop Sleeve",                  "Digital print + stitching"),

    "collect-acrylicstand":    ("Acrylic Stand 10-15cm",          "UV print + laser cut"),
    "collect-acrylickeychain": ("Acrylic Keychain (Double-Sided)","UV print + laser cut"),
    "collect-fridgemagnet":    ("Fridge Magnet (Soft / Acrylic)", "UV print"),
    "wood-keychain":           ("Wooden Keychain",                "Laser engraving"),
    "wood-coasters":           ("Wooden Coasters (Set of 4)",     "Laser engraving / UV print"),
    "wood-frame":              ("Wooden Photo Frame",             "Laser engraving + assembly"),
    "metal-dogtag":            ("Metal Dog Tag / Keychain",       "Laser engraving / screen print"),
    "metal-plaque":            ("Metal Plaque",                   "UV print / etching"),
    "metal-enamelpin":         ("Enamel Pin",                     "Cloisonne enamel"),
    "pet-dogtag":              ("Pet ID Tag",                     "UV print + laser cut"),

    "office-mousepad":         ("Mouse Pad 22x18cm",              "Heat transfer / UV print"),
    "office-deskmat":          ("Desk Mat 80x30cm",               "Heat transfer"),
    "home-mug":                ("Ceramic Mug 11oz",               "Dye sublimation"),
    "home-tumbler":            ("Insulated Tumbler 500ml",        "Heat transfer film / UV"),
    "home-pillow":             ("Pillow Cover 40x40cm",           "Dye sublimation"),
    "home-blanket":            ("Fleece Blanket 100x150cm",       "Dye sublimation"),
    "home-glass":              ("Drinking Glass",                 "UV print / heat transfer film"),
    "home-wineglass":          ("Wine Glass",                     "UV print / heat transfer film"),
}

src = io.open(PATH, encoding="utf-8").read()
orig = src
missed = []

for sku, (name, proc) in M.items():
    pat = re.compile(r'(\{ sku: "' + re.escape(sku) + r'",[^\n]*?name: ")[^"]*(", process: ")[^"]*(")')
    src, n = pat.subn(lambda m: m.group(1) + name + m.group(2) + proc + m.group(3), src)
    if n != 1:
        missed.append((sku, n))

# freight tier labels
for key, lab in [("light", "Light <100g"), ("medium", "Medium 100-500g"),
                 ("heavy", "Heavy 500g-2kg"), ("oversize", "Oversize >2kg")]:
    src, n = re.subn(r'(' + key + r': \{ rmb: \d+, label: ")[^"]*(" \})',
                     lambda m: m.group(1) + lab + m.group(2), src)
    if n != 1:
        missed.append(("freight:" + key, n))

# family labels
FAM = {
    "tshirt":    "Apparel / Tees & Hoodies",
    "poster":    "Wall Art / Posters & Prints",
    "card":      "Paper & Stationery",
    "phonecase": "Tech Accessories",
    "sticker":   "Stickers & Collectibles",
    "home":      "Home & Living",
}
fam_block = re.search(r'export const FAMILY_LABELS: Record<FamilyId, string> = \{.*?\};', src, re.S)
if not fam_block:
    missed.append(("FAMILY_LABELS", 0))
else:
    new_block = ("export const FAMILY_LABELS: Record<FamilyId, string> = {\n"
                 + "".join('  %s: "%s",\n' % (k, v) for k, v in FAM.items())
                 + "};")
    src = src[:fam_block.start()] + new_block + src[fam_block.end():]

io.open(PATH, "w", encoding="utf-8", newline="\n").write(src)

print("changed:", src != orig)
print("missed:", missed if missed else "none")
left = re.findall(r'[\u4e00-\u9fff]', src)
print("remaining CJK chars in file:", len(left))
# report which lines still have CJK (should be comments only)
for i, line in enumerate(src.split("\n"), 1):
    if re.search(r'[\u4e00-\u9fff]', line):
        stripped = line.strip()
        kind = "COMMENT" if stripped.startswith(("//", "*", "/*")) else "!! CODE"
        print("  %s L%d: %s" % (kind, i, stripped[:90]))
