"""Copy every story image from Wikimedia Commons into img/ as WebP, so the site does not depend on Commons
staying fast (Commons rate-limits bursts). Each image (in "images" and "compare") gets "img": "<name>" in cards.json, and two files:
img/<name>.webp (up to 960 px wide, story pages) and img/<name>-s.webp (up to 480 px, journal cards).
Needs cwebp (brew install webp). Run after adding images; images already copied are skipped:

    python3 fetch_images.py
"""
import hashlib, json, os, subprocess, tempfile, time, urllib.error, urllib.parse, urllib.request

UA = {"User-Agent": "NhatKyThamHiem-images/0.2 (https://github.com/johnny163412/nhat-ky-tham-hiem)"}  # Wikimedia asks bots for a contact URL
name_of = lambda f: hashlib.md5(f.encode()).hexdigest()[:12]
assert name_of("File:A.jpg") == name_of("File:A.jpg") != name_of("File:B.jpg")
done = lambda n: os.path.exists(f"img/{n}.webp") and os.path.exists(f"img/{n}-s.webp")

cards = json.load(open("cards.json", encoding="utf-8"))
pics = lambda c: c.get("images", []) + ([c["compare"]["before"], c["compare"]["after"]] if c.get("compare") else [])
files = sorted({im["file"] for c in cards for im in pics(c) if not done(name_of(im["file"]))})
os.makedirs("img", exist_ok=True)
info = {}
for i in range(0, len(files), 40):  # the API takes up to 50 titles a call
    q = urllib.parse.urlencode({"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url",
                                "iiurlwidth": 960, "titles": "|".join(files[i:i + 40])})
    d = json.load(urllib.request.urlopen(urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + q, headers=UA), timeout=30))
    norm = {n["to"]: n["from"] for n in d["query"].get("normalized", [])}
    for p in d["query"]["pages"].values():
        if "imageinfo" in p: info[norm.get(p["title"], p["title"])] = p["imageinfo"][0]
    time.sleep(1)

failed = []
with tempfile.TemporaryDirectory() as tmp:
    for f in files:
        ii, n = info.get(f), name_of(f)
        try:
            src = os.path.join(tmp, "src" + os.path.splitext(urllib.parse.urlparse(ii["thumburl"]).path)[1].lower())
            # curl, not urllib: urllib's timeout is per read, and one Commons download hung for an hour
            subprocess.run(["curl", "-sSfL", "--max-time", "90", "--retry", "3", "--retry-delay", "20", "-A", UA["User-Agent"],
                            "-o", src, ii["thumburl"]], check=True)
            if src.endswith(".gif"):  # cwebp cannot read GIF
                subprocess.run(["sips", "-s", "format", "png", src, "--out", src + ".png"], check=True, capture_output=True); src += ".png"
            for out, width in ((f"img/{n}.webp", 960), (f"img/{n}-s.webp", 480)):
                resize = ["-resize", str(width), "0"] if ii.get("thumbwidth", 960) > width else []  # never upscale
                subprocess.run(["cwebp", "-quiet", "-q", "72", *resize, src, "-o", out], check=True)
            print("ok", n, f)
        except Exception as e:
            failed.append(f); print("FAIL", f, e)
        time.sleep(3)  # stay well under upload.wikimedia.org rate limits

for c in cards:  # app.js falls back to Commons for images without "img"
    for im in pics(c):
        if done(name_of(im["file"])): im["img"] = name_of(im["file"])
json.dump(cards, open("cards.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"{len(files) - len(failed)} copied, failed: {failed}")
