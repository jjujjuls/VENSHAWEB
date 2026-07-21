from PIL import Image, ImageChops
import os

SRC = os.path.join('assets','images')
OUT = os.path.join('assets','images','export')
os.makedirs(OUT, exist_ok=True)

mapping = [
    ('vacuumRoller.png', 'vacuum-roller.png', (800,800), True),
    ('multiPolarRF.png', 'multipolar-rf.png', (800,800), True),
    ('bipolarRF.png', 'bipolar-rf.png', (800,800), True),
    ('cavitation.png', 'cavitation-head.png', (800,800), True),
    ('MegashapePro Hero Image.png', 'megashape-hero.jpg', (1600,900), False),
    ('MegashapePro Hero Image.png', 'machine-full.png', (1200,1200), False),
    ('sampleUseOfDevide.png', 'applicator-closeup.png', (900,600), True)
]


def trim_whitespace(im):
    bg = Image.new('RGB', im.size, (255,255,255))
    diff = ImageChops.difference(im.convert('RGB'), bg)
    bbox = diff.getbbox()
    if bbox:
        return im.crop(bbox)
    return im


def make_transparent(im, fuzz=10):
    im = im.convert('RGBA')
    datas = im.getdata()
    newData = []
    for item in datas:
        r,g,b,a = item
        if r >= 255 - fuzz and g >= 255 - fuzz and b >= 255 - fuzz:
            newData.append((255,255,255,0))
        else:
            newData.append((r,g,b,a))
    im.putdata(newData)
    return im


for src_name, out_name, size, remove_bg in mapping:
    src_path = os.path.join(SRC, src_name)
    out_path = os.path.join(OUT, out_name)
    if not os.path.exists(src_path):
        print(f"Source not found: {src_path}")
        continue
    im = Image.open(src_path)
    im = trim_whitespace(im)
    if remove_bg:
        im = make_transparent(im, fuzz=18)
    im.thumbnail(size, Image.LANCZOS)
    # if output is jpg but has alpha, convert to RGB
    if out_path.lower().endswith('.jpg') or out_path.lower().endswith('.jpeg'):
        bg = Image.new('RGB', im.size, (255,255,255))
        bg.paste(im, mask=im.split()[3] if im.mode=='RGBA' else None)
        bg.save(out_path, quality=90)
    else:
        im.save(out_path)
    print(f"Saved {out_path}")

print('Done')
