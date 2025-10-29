import os, re, pathlib, urllib.parse, requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

URL = "https://www.starstyle.com/celebrity/olivia-rodrigo/"
OUT_DIR = "starstyle-olivia-images"

headers = {"User-Agent": "Mozilla/5.0", "Referer": URL}

def sanitize_filename(name):
    name = re.sub(r"[^\w\-.]+", "_", name)
    return name[:240]

def candidates_from_img(img):
    urls = set()
    for attr in ["src", "data-src", "data-lazy-src", "data-original"]:
        v = img.get(attr)
        if v:
            urls.add(v)
    srcset = img.get("srcset")
    if srcset:
        for part in srcset.split(","):
            u = part.strip().split(" ")[0]
            if u:
                urls.add(u)
    return urls

def looks_like_image(u):
    exts = (".jpg",".jpeg",".png",".gif",".webp",".avif")
    parsed = urlparse(u)
    if parsed.scheme == "data":
        return False
    path = parsed.path.lower()
    return any(path.endswith(ext) for ext in exts)

os.makedirs(OUT_DIR, exist_ok=True)

resp = requests.get(URL, headers=headers, timeout=30)
soup = BeautifulSoup(resp.text, "html.parser")

img_urls = []
for img in soup.find_all("img"):
    for u in candidates_from_img(img):
        if looks_like_image(u):
            img_urls.append(urljoin(URL, u))

for i, u in enumerate(set(img_urls), 1):
    try:
        r = requests.get(u, headers=headers, timeout=60)
        fname = os.path.basename(urlparse(u).path)
        if not fname:
            fname = f"image_{i}.jpg"
        fname = sanitize_filename(fname)
        path = pathlib.Path(OUT_DIR) / fname
        with open(path, "wb") as f:
            f.write(r.content)
        print(f"Saved {fname}")
    except Exception as e:
        print(f"Skipped {u}: {e}")

print("Done! All images saved.")
