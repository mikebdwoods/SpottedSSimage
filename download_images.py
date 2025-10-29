import os, re, pathlib, requests, io
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urlunparse
from PIL import Image

# Page to scrape. Change this if you want a different page later.
START_URL = "https://www.starstyle.com/celebrity/olivia-rodrigo/"

# Where saved images will go
OUT_DIR = "starstyle-olivia-images"

# Only keep images at least this wide. Raise it for bigger.
MIN_WIDTH = 900

TIMEOUT = 45
UA = {"User-Agent": "Mozilla/5.0", "Referer": START_URL}

def sanitize_filename(name: str) -> str:
    name = re.sub(r"[^\w\-.]+", "_", name)
    return name[:240]

def strip_query(u: str) -> str:
    p = urlparse(u)
    return urlunparse((p.scheme, p.netloc, p.path, "", "", ""))

def looks_like_image(u: str) -> bool:
    return urlparse(u).path.lower().endswith((".jpg",".jpeg",".png",".webp",".gif",".avif"))

def biggest_from_srcset(srcset: str) -> str | None:
    best = None
    best_w = -1
    for part in srcset.split(","):
        bits = part.strip().split()
        if not bits:
            continue
        url = bits[0]
        width = 0
        if len(bits) > 1 and bits[1].endswith("w"):
            try:
                width = int(bits[1][:-1])
            except:
                width = 0
        if width > best_w:
            best_w = width
            best = url
    return best

def variants_for_fullsize(u: str) -> list[str]:
    # Try common WordPress original variants
    cands = []
    base = u
    cands.append(base)

    nq = strip_query(base)
    if nq != base:
        cands.append(nq)

    p = urlparse(nq)
    path = p.path

    # remove -300x450 before extension
    m = re.match(r"^(.*)-\d{2,5}x\d{2,5}(\.[A-Za-z0-9]+)$", path, re.I)
    if m:
        cands.append(urlunparse((p.scheme, p.netloc, m.group(1)+m.group(2), "", "", "")))

    # remove -scaled
    m2 = re.match(r"^(.*)-scaled(\.[A-Za-z0-9]+)$", path, re.I)
    if m2:
        cands.append(urlunparse((p.scheme, p.netloc, m2.group(1)+m2.group(2), "", "", "")))

    seen, out = set(), []
    for c in cands:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out

def fetch_bytes(u: str) -> bytes | None:
    try:
        r = requests.get(u, headers=UA, timeout=TIMEOUT, stream=True)
        r.raise_for_status()
        return r.content
    except Exception:
        return None

def good_size(img_bytes: bytes, min_width: int) -> bool:
    try:
        im = Image.open(io.BytesIO(img_bytes))
        w, h = im.size
        return w >= min_width
    except Exception:
        return False

def collect_image_urls(page_url: str, soup: BeautifulSoup) -> set[str]:
    urls = set()

    # <img> tags
    for img in soup.find_all("img"):
        if img.get("srcset"):
            big = biggest_from_srcset(img["srcset"])
            if big:
                urls.add(urljoin(page_url, big))
        for attr in ["src", "data-src", "data-lazy-src", "data-original"]:
            v = img.get(attr)
            if v:
                urls.add(urljoin(page_url, v))

        # anchor wrapping the image may link to the full file
        parent = img.parent
        if parent and getattr(parent, "name", None) == "a":
            href = parent.get("href")
            if href and looks_like_image(href):
                urls.add(urljoin(page_url, href))

    # social preview tags
    for sel in [
        ('meta', {"property": "og:image"}),
        ('meta', {"name": "og:image"}),
        ('meta', {"name": "twitter:image"}),
        ('meta', {"property": "twitter:image"}),
    ]:
        for tag in soup.find_all(*sel):
            c = tag.get("content")
            if c:
                urls.add(urljoin(page_url, c))

    return {u for u in urls if looks_like_image(u)}

def collect_article_links(soup: BeautifulSoup, base_url: str) -> set[str]:
    out = set()
    for a in soup.find_all("a", href=True):
        href = urljoin(base_url, a["href"])
        p = urlparse(href)
        if p.netloc.endswith("starstyle.com") and "/olivia-rodrigo/" in p.path:
            out.add(href)
    return out

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print("Fetching start page...")
    r = requests.get(START_URL, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    pages = {START_URL} | collect_article_links(soup, START_URL)

    all_urls = set()
    for page in sorted(pages):
        try:
            rp = requests.get(page, headers=UA, timeout=TIMEOUT)
            rp.raise_for_status()
            psoup = BeautifulSoup(rp.text, "html.parser")
            all_urls |= collect_image_urls(page, psoup)
        except Exception as e:
            print(f"Skipping page {page}: {e}")

    print(f"Found {len(all_urls)} candidate image URLs")

    saved = 0
    for i, raw in enumerate(sorted(all_urls), 1):
        tried = set()
        for cand in variants_for_fullsize(raw):
            if cand in tried:
                continue
            tried.add(cand)
            data = fetch_bytes(cand)
            if not data:
                continue
            if good_size(data, MIN_WIDTH):
                name = os.path.basename(urlparse(strip_query(cand)).path) or f"image_{i}.jpg"
                name = sanitize_filename(name)
                dest = pathlib.Path(OUT_DIR) / name
                if dest.exists():
                    stem, suf = dest.stem, dest.suffix
                    k = 2
                    while True:
                        nd = dest.with_name(f"{stem}_{k}{suf}")
                        if not nd.exists():
                            dest = nd
                            break
                        k += 1
                with open(dest, "wb") as f:
                    f.write(data)
                print(f"[{i}] Saved {dest.name}")
                saved += 1
                break
        else:
            # also save a smaller version for reference
            data = fetch_bytes(raw)
            if data:
                name = os.path.basename(urlparse(strip_query(raw)).path) or f"image_{i}.jpg"
                name = sanitize_filename(name)
                dest = pathlib.Path(OUT_DIR) / f"small_{name}"
                with open(dest, "wb") as f:
                    f.write(data)
                print(f"[{i}] Saved small version {dest.name}")

    print(f"Done. Saved {saved} images with width >= {MIN_WIDTH}px.")

if __name__ == "__main__":
    main()
