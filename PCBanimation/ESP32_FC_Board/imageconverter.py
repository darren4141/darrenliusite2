from PIL import Image
import os

for filename in os.listdir():
    if filename.endswith(".png"):
        img = Image.open(filename).convert("RGB")  # webp doesn't support alpha well
        new_name = filename.replace(".png", ".webp")
        img.save(new_name, "webp", quality=80)