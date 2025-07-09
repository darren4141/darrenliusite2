import os
import time
from PIL import ImageGrab, Image
import keyboard
import pyautogui

# saves kicad screenshots
# START:  Shift + S
# END:    Shift + E

# Configuration
SAVE_DIR = r"C:\Users\Darren\Pictures\KiCadRenders"
os.makedirs(SAVE_DIR, exist_ok=True)

screen_width, screen_height = pyautogui.size()
start_x = 0
start_y = screen_height // 2
MAX_FRAMES = 275
current_frame = 0

def get_next_index(prefix="board render"):
    existing = [f for f in os.listdir(SAVE_DIR) if f.startswith(prefix) and f.endswith(".webp")]
    indices = []
    for name in existing:
        try:
            index = int(name[len(prefix):-5])  # .webp = 5 chars
            indices.append(index)
        except ValueError:
            continue
    return max(indices, default=-1) + 1

def save_clipboard_image():
    img = ImageGrab.grabclipboard()
    if img:
        index = get_next_index()
        filename_webp = f"board render{index}.webp"
        path_webp = os.path.join(SAVE_DIR, filename_webp)

        # Convert and save as .webp
        img.convert("RGB").save(path_webp, "WEBP", quality=95)
        print(f"Saved: {path_webp}")

        # Clean up: check if any temporary PNG exists, delete it (precaution)
        tmp_png = os.path.join(SAVE_DIR, f"board render{index}.png")
        if os.path.exists(tmp_png):
            os.remove(tmp_png)
    else:
        print("No image in clipboard.")

def rotate_and_capture():
    global current_frame
    while current_frame < MAX_FRAMES:
        if keyboard.is_pressed("shift+e"):
            print("Manual stop triggered.")
            break

        print(f"Capturing frame {current_frame + 1}/{MAX_FRAMES}...")
        pyautogui.dragTo(30, start_y, duration=0.5, button='left')
        time.sleep(0.75)

        pyautogui.hotkey('alt', 'e')
        time.sleep(0.3)
        pyautogui.hotkey('c')
        time.sleep(0.3)

        save_clipboard_image()
        current_frame += 1

        pyautogui.moveTo(0, start_y, duration=0.5)
        time.sleep(0.5)

    print("Capture complete.")

# === Main loop ===
print("Ready. Press Shift+S to start capture, Shift+E to stop early.")

pyautogui.mouseUp()
pyautogui.moveTo(start_x, start_y)

while True:
    if keyboard.is_pressed("shift+s"):
        print("Capture started.")
        rotate_and_capture()
        break
    if keyboard.is_pressed("esc"):
        print("Exited before start.")
        break
    time.sleep(0.1)
