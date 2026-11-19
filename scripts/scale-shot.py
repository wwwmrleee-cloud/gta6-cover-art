#!/usr/bin/env python3
"""Scale a PNG to an exact JPEG size. Usage: scale-shot.py SRC DST W H QUALITY"""
import sys
from PIL import Image

src, dst, w, h, q = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
img = Image.open(src).convert("RGB")
img = img.resize((w, h), Image.LANCZOS)
img.save(dst, "JPEG", quality=q, optimize=True)
print(f"{dst}: {w}x{h} q{q} {len(open(dst, 'rb').read())} bytes")
