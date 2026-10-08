"""Render the PWA icons in icons/ from the brand mark used in index.html (40x40 book glyph on #3c5f4b)."""
from pathlib import Path
from PIL import Image, ImageDraw

GREEN, WHITE, SS = (60, 95, 75, 255), (255, 255, 255, 255), 4
OUT = Path(__file__).resolve().parent.parent / 'icons'

def bezier(p0, p1, p2, p3, n=24):
    pts = []
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        pts.append(tuple(u**3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t**3 * d for a, b, c, d in zip(p0, p1, p2, p3)))
    return pts

def glyph():
    """Polylines of the book mark in 40x40 units: outline (closed) and spine."""
    p = [(10, 11), (17, 11)]
    p += bezier(p[-1], (19, 11), (20, 12), (20, 13))
    p += bezier(p[-1], (20, 12), (21, 11), (23, 11))
    p += [(30, 11), (30, 29), (23, 29)]
    p += bezier(p[-1], (21, 29), (20, 30), (20, 31))
    p += bezier(p[-1], (20, 30), (19, 29), (17, 29))
    p += [(10, 29), (10, 11)]
    return p, [(20, 13), (20, 31)]

def render(size, glyph_scale, rounded):
    big = size * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle((0, 0, big - 1, big - 1), radius=big * 12 / 40, fill=GREEN)
    else:
        d.rectangle((0, 0, big, big), fill=GREEN)
    k = big / 40 * glyph_scale
    ox = oy = big / 2 - 20 * k
    w = 2 * k
    for line in glyph():
        pts = [(ox + x * k, oy + y * k) for x, y in line]
        d.line(pts, fill=WHITE, width=round(w))
        for x, y in pts:  # round caps and joins
            d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)

OUT.mkdir(exist_ok=True)
render(192, 1.35, True).save(OUT / 'icon-192.png', optimize=True)
render(512, 1.35, True).save(OUT / 'icon-512.png', optimize=True)
render(512, 1.15, False).save(OUT / 'icon-maskable-512.png', optimize=True)  # glyph inside the 80% safe zone
render(180, 1.25, False).save(OUT / 'apple-touch-icon.png', optimize=True)    # iOS applies its own rounding
print('Icons written to', OUT)
