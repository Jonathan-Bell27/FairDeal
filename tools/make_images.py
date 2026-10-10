"""Render PNGs of sample contracts 05-10 and fake phone photos of a few.

Phone photos simulate what a buyer actually captures at a dealership desk:
the page at an angle on a table, uneven lighting, a warm color cast, slight
blur and sensor noise, saved as JPEG.

Usage (from the repo root, after tools/make_samples.py):
    python3 tools/make_images.py
"""

import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "sample-contracts"

# file stem -> photo style (stems without a style only get a PNG)
PHOTOS = {
    "05_negative_equity_trade": dict(tilt=(-0.035, 0.05), shadow=0.25, warm=0.06, blur=0.8, table=(92, 70, 52), seed=5),
    "07_risc_high_mileage": dict(tilt=(0.05, -0.03), shadow=0.55, warm=0.03, blur=1.1, table=(60, 62, 66), seed=7),
    "09_payment_packing_84mo": dict(tilt=(-0.02, -0.045), shadow=0.35, warm=0.12, blur=1.6, table=(120, 96, 70), seed=9),
}


def render_png(pdf):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdftoppm", "-r", "150", "-png", "-singlefile", str(pdf), f"{tmp}/page"], check=True)
        return Image.open(f"{tmp}/page.png").convert("RGB")


def find_coeffs(src, dst):
    """Perspective transform coefficients mapping dst quad -> src quad (PIL convention)."""
    rows = []
    for (x, y), (u, v) in zip(dst, src):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    a = np.array(rows, dtype=float)
    b = np.array(src, dtype=float).reshape(8)
    return np.linalg.solve(a, b).tolist()


def phone_photo(page, tilt, shadow, warm, blur, table, seed):
    rng = np.random.default_rng(seed)
    pw, ph = page.size
    cw, ch = int(pw * 1.18), int(ph * 1.12)

    # Table with a little texture.
    bg = np.ones((ch, cw, 3)) * np.array(table, dtype=float)
    bg += rng.normal(0, 6, (ch, cw, 1))
    canvas = Image.fromarray(np.clip(bg, 0, 255).astype("uint8"))

    # Page corners after a slight perspective tilt and rotation.
    mx, my = (cw - pw) / 2, (ch - ph) / 2
    tx, ty = tilt
    dst = [
        (mx + pw * (0.03 + tx), my + ph * (0.02 + ty)),
        (mx + pw * (0.97 + tx * 0.4), my + ph * (0.035 - ty * 0.5)),
        (mx + pw * (1.0 - tx * 0.3), my + ph * (0.985 + ty * 0.3)),
        (mx + pw * (0.0 + tx * 0.6), my + ph * (0.97 - ty)),
    ]
    src = [(0, 0), (pw, 0), (pw, ph), (0, ph)]
    warped = page.transform((cw, ch), Image.PERSPECTIVE, find_coeffs(src, dst), Image.BICUBIC)
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).polygon(dst, fill=255)
    canvas.paste(warped, (0, 0), mask.filter(ImageFilter.GaussianBlur(1.2)))

    # Uneven light: a soft shadow falling across one side, plus vignette.
    arr = np.asarray(canvas).astype(float)
    yy, xx = np.mgrid[0:ch, 0:cw]
    light = 1 - shadow * np.clip((xx / cw) * 0.9 + (yy / ch) * 0.6 - 0.45, 0, 1)
    vignette = 1 - 0.18 * (((xx - cw / 2) / cw) ** 2 + ((yy - ch / 2) / ch) ** 2) * 4
    arr *= (light * vignette)[..., None]
    arr *= np.array([1 + warm, 1 + warm * 0.4, 1 - warm])  # warm indoor light
    arr *= 0.93  # phone exposure
    arr += rng.normal(0, 4.5, arr.shape)
    photo = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
    return photo.filter(ImageFilter.GaussianBlur(blur))


def main():
    for pdf in sorted(OUT.glob("*.pdf")):
        if pdf.name[:2] < "05":
            continue
        page = render_png(pdf)
        page.save(OUT / f"{pdf.stem}.png", optimize=True)
        print("wrote", f"{pdf.stem}.png")
        style = PHOTOS.get(pdf.stem)
        if style:
            name = f"{pdf.stem.split('_')[0]}_{'_'.join(pdf.stem.split('_')[1:])}_phone_photo.jpg"
            phone_photo(page, **style).save(OUT / name, quality=72)
            print("wrote", name)


if __name__ == "__main__":
    main()
