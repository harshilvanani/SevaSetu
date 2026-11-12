# Generates every app icon / splash asset from the master logo.
# Usage: python3 scripts/gen-icons.py assets/brand/sevasetu-logo.png assets/images
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')

def white_to_alpha(img):
    img = img.convert('RGBA'); px = img.load(); w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            a = max(255 - r, 255 - g, 255 - b)
            if a == 0: px[x, y] = (0, 0, 0, 0); continue
            f = 255 / a
            px[x, y] = tuple(max(0, min(255, round(255 - (255 - c) * f))) for c in (r, g, b)) + (a,)
    return img

full = im.crop((168, 296, 1086, 940))   # mark + wordmark
mark = im.crop((205, 296, 1050, 742))   # sun + people + bridge
full_a, mark_a = white_to_alpha(full), white_to_alpha(mark)

def place(content, size, width, bg=None, dy=0):
    c = content.resize((width, round(content.height * width / content.width)), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), bg or (0, 0, 0, 0))
    canvas.alpha_composite(c, ((size - c.width) // 2, (size - c.height) // 2 + dy))
    return canvas

def silhouette(img):
    r = Image.new('RGBA', img.size, (255, 255, 255, 0)); r.putalpha(img.getchannel('A').point(lambda a: 255 if a > 140 else 0)); return r

place(full_a, 1024, 820, (255, 255, 255, 255)).convert('RGB').save(f'{out}/icon.png')
place(full_a, 1024, 560).save(f'{out}/android-icon-foreground.png')
place(silhouette(full_a), 1024, 560).save(f'{out}/android-icon-monochrome.png')
place(full_a, 1024, 1000).save(f'{out}/splash-icon.png')
place(mark_a, 48, 44, (255, 255, 255, 255)).convert('RGB').save(f'{out}/favicon.png')
place(silhouette(mark_a), 96, 90).save(f'{out}/notification-icon.png')
# Link-preview image (WhatsApp, social): full logo centred on white, 1200x630.
og = Image.new('RGBA', (1200, 630), (255, 255, 255, 255))
logo = full_a.resize((640, round(full_a.height * 640 / full_a.width)), Image.LANCZOS)
og.alpha_composite(logo, ((1200 - logo.width) // 2, (630 - logo.height) // 2))
og.convert('RGB').save(f'{out}/og-image.png')
place(full_a, 180, 150, (255, 255, 255, 255)).convert('RGB').save(f'{out}/apple-touch-icon.png')
m = mark_a.resize((512, round(mark_a.height * 512 / mark_a.width)), Image.LANCZOS); m.save(f'{out}/logo-mark.png')
print('done', m.size)
# sample brand colours from the wordmark
for name, (x, y) in {'purple': (240, 870), 'orange': (1000, 870)}.items():
    print(name, '#%02X%02X%02X' % im.getpixel((x, y)))
