import os, re, pathlib, requests, io
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urlunparse
from PIL import Image

START_URL = "https://www.starstyle.com/celebrity/olivia-rodrigo/"
OUT_DIR = "starstyle-olivia-images"
MIN_WIDTH = 900     # change if you want bigger or smaller
TIMEOUT = 45

UA = {"User-Agent": "Mozilla/5.0", "Referer": START_URL}

# 1) Utilities

def sanitize_filename(name: str) -> str:
    name = re.sub(r"[^\w\-.]+", "_", name)
    return name[:240]

def strip_query(u: str) -> str:
    p = urlparse(u)
    return urlunparse((p.scheme, p.netloc, p.path, "", "", ""))

def looks_like_image(u: str) -> bool:
    return urlparse(u).path.lower().endswith((
        ".jpg",".jpeg",".png",".webp",".gif",".avif"
    ))

def biggest_from_srcset(srcset: str) -> str | None:
    # pick the largest width entry (e.g., "image 300w, image2 1200w")
    best = None
    best_w = -1
    for part in srcset.split(","):
        part = part.strip()
        if not part:
            continue
        bits = part.split()
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
    """
    Try common WordPress style original-image variants.
    Example:
      .../photo-300x450.jpg -> .../photo.jpg
      .../photo-1024x1536.jpg -> .../photo.jpg
      .../photo-150x150.jpg -> .../photo.jpg
      .../photo-scaled.jpg -> .../photo.jpg (sometimes exists)
      .../photo.jpg?resize=... -> .../photo.jpg
    We will try in order: given url, stripped query, de-sized variants.
    """
    candidates = []
    base = u
    candidates.append(base)

    # no query string
    nq = strip_query(base)
    if nq != base:
        candidates.append(nq)

    # remove size pattern -123x456 before extension
    m = re.match(r"^(.*)-\d{2,5}x\d{2,5}(\.[A-Za-z0-9]+)$", urlparse(nq).path, re.I)
    if m:
        full = urlunparse((urlparse(nq).scheme, urlparse(nq).netloc, m.group(1)+m.group(2), "", "", ""))
        candidates.append(full)

    # remove -scaled
    path = urlparse(nq).path
    m2 = re.match(r"^(.*)-scaled(\.[A-Za-z0-9]+)$", path, re.I)
    if m2:
        full2 = urlunparse((urlparse(nq).scheme, urlparse(nq).netloc, m2.group(1)+m2.group(2), "", "", ""))
        candidates.append(full2)

    # dedupe while preserving order
    seen = set()
    out = []
    for c in candidates:
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

def save_bytes(img_bytes: bytes, dest: pathlib.Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "wb") as f:
        f.write(img_bytes)

# 2) Crawl a page for candidates

def collect_image_urls(page_url: str, soup: BeautifulSoup) -> set[str]:
    urls = set()

    # <img>
    for img in soup.find_all("img"):
        # pick biggest srcset entry first
        if img.get("srcset"):
            big = biggest_from_srcset(img["srcset"])
            if big:
                urls.add(urljoin(page_url, big))
        for attr in ["src", "data-src", "data-lazy-src", "data-original"]:
            v = img.get(attr)
            if v:
                urls.add(urljoin(page_url, v))

        # if the image is wrapped in a link, that link may be the full image
        parent = img.parent
        if parent and parent.name == "a":
            href = parent.get("href")
            if href and looks_like_image(href):
                urls.add(urljoin(page_url, href))

    # OpenGraph/Twitter
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

    # keep only obvious image links
    return {u for u in urls if looks_like_image(u)}

def collect_article_links(soup: BeautifulSoup, base_url: str) -> set[str]:
    # Grab article pages under the celebrity path. Larger images often live there.
    out = set()
    for a in soup.find_all("a", href=True):
        href = urljoin(base_url, a["href"])
        # limit to the same site and same celebrity section
        p = urlparse(href)
        if p.netloc.endswith("starstyle.com") and "/olivia-rodrigo/" in p.path:
            out.add(href)
    return out

# 3) Main

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print("Fetching start page...")
    r = requests.get(START_URL, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    pages = {START_URL}
    pages |= collect_article_links(soup, START_URL)  # visit article pages too

    all_urls = set()
    for page in sorted(pages):
        print(f"Scanning {page}")
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
        # Try a few variants to reach a larger original
        tried = []
        for cand in variants_for_fullsize(raw):
            if cand in tried:
                continue
            tried.append(cand)
            data = fetch_bytes(cand)
            if not data:
                continue
            if good_size(data, MIN_WIDTH):
                name = os.path.basename(urlparse(strip_query(cand)).path) or f"image_{i}.jpg"
                name = sanitize_filename(name)
                dest = pathlib.Path(OUT_DIR) / name
                # uniqueness
                if dest.exists():
                    stem, suf = dest.stem, dest.suffix
                    k = 2
                    while True:
                        nd = dest.with_name(f"{stem}_{k}{suf}")
                        if not nd.exists():
                            dest = nd
                            break
                        k += 1
                save_bytes(data, dest)
                print(f"[{i}] Saved {dest.name}")
                saved += 1
                break  # stop at first large-enough version
        else:
            # optional: keep smaller ones too. Comment out to skip.
            data = fetch_bytes(raw)
            if data:
                name = os.path.basename(urlparse(strip_query(raw)).path) or f"image_{i}.jpg"
                name = sanitize_filename(name)
                dest = pathlib.Path(OUT_DIR) / f"small_{name}"
                save_bytes(data, dest)
                print(f"[{i}] Saved small version {dest.name}")

    print(f"Done. Saved {saved} images at width >= {MIN_WIDTH}px.")

if __name__ == "__main__":
    main()
