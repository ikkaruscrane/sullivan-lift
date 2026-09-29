# Generates the home-screen icons. Run: python3 scripts/make_icons.py
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)
for size in (192, 512):
    img = Image.new("RGB", (size, size), "#0D0D0F")
    d = ImageDraw.Draw(img)
    m = size * 0.08
    d.rounded_rectangle([m, m, size - m, size - m], radius=size * 0.18, outline="#7A5520", width=max(2, size // 64))
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Futura.ttc", int(size * 0.52))
    except OSError:
        font = ImageFont.load_default(size=int(size * 0.5))
    d.text((size / 2, size / 2 - size * 0.02), "L", font=font, fill="#FFB340", anchor="mm")
    img.save(OUT / f"icon-{size}.png")
    print(f"icon-{size}.png")
