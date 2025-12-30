from pathlib import Path
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed

# 🔧 SETTINGS
INPUT_DIR = Path("Mini_FC_Board")     # folder with original images
OUTPUT_DIR = Path("output")   # where cropped images will go
OUTPUT_DIR.mkdir(exist_ok=True)

EXTS = [".jpg", ".jpeg", ".png", ".webp"]

# Crop box: (left, top, right, bottom)
# 🔄 Negatives mean “from the opposite edge”
# Example below removes 100px from each side:
CROP_BOX = (650, 0, -650, 0)

def normalize_crop_box(img, box):
    left, top, right, bottom = box
    w, h = img.size

    if right <= 0:
        right = w + right
    if bottom <= 0:
        bottom = h + bottom

    left = max(0, min(left, w))
    top = max(0, min(top, h))
    right = max(left, min(right, w))
    bottom = max(top, min(bottom, h))

    return (left, top, right, bottom)

def process_image(img_path: Path):
    try:
        with Image.open(img_path) as img:
            crop_box = normalize_crop_box(img, CROP_BOX)
            cropped = img.crop(crop_box)

            out_path = OUTPUT_DIR / img_path.name

            suffix = img_path.suffix.lower()
            if suffix == ".webp":
                # Faster (lossy) WebP – tweak as needed
                cropped.save(out_path, lossless=True)
            else:
                cropped.save(out_path)

        return f"OK: {img_path.name}"
    except Exception as e:
        return f"FAIL: {img_path.name} ({e})"

# Collect all images first
images = [p for p in INPUT_DIR.glob("*") if p.suffix.lower() in EXTS]

# Set number of worker threads (try 4–8)
max_workers = 8

with ThreadPoolExecutor(max_workers=max_workers) as executor:
    futures = [executor.submit(process_image, p) for p in images]
    for f in as_completed(futures):
        print(f.result())