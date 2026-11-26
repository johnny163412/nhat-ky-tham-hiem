"""Write one static HTML page per story into c/<id>.html, so links shared on Zalo/Facebook show a preview
and search engines can index each story. Run after editing cards.json:

    python3 build_pages.py                       # pages only
    python3 build_pages.py https://your.site/    # also og:url, canonical links, sitemap.xml and robots.txt
"""
import html, json, os, sys, urllib.parse

SITE = sys.argv[1].rstrip("/") + "/" if len(sys.argv) > 1 else ""
cards = json.load(open("cards.json", encoding="utf-8"))
VERDICT = {"that": "Đã xác thực", "don": "Lời đồn", "chuaro": "Chưa rõ"}
e = lambda s: html.escape(str(s), quote=True)
year = lambda y: f"{-y} TCN" if y < 0 else f"năm {y}"
commons = lambda f, w: "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(f[5:] if f.startswith("File:") else f) + f"?width={w}"


def figure(im):
    size = f' width="{im["w"]}" height="{im["h"]}" style="aspect-ratio:{im["w"]}/{im["h"]}"' if im.get("w") else ""
    return (f'<figure class="fig"><span class="mount"><img class="sketch" src="{e(commons(im["file"], 960))}" alt="{e(im["caption"])}"{size} loading="lazy"></span>'
            f'<figcaption>{e(im["caption"])} <a href="https://commons.wikimedia.org/wiki/{e(urllib.parse.quote(im["file"]))}">{e(im["credit"])}</a></figcaption></figure>')


def pull_spot(c):  # same rule as pullSpot() in app.js
    s = next((i for i, p in enumerate(c["story"]) if c.get("pull") and not p.startswith("## ") and c["pull"] in p), -1)
    if s < 0: return -1
    heads = [i for i, p in enumerate(c["story"]) if p.startswith("## ")]
    before = [i for i in heads if i <= s]
    if before and before[-1] > 0: return before[-1]
    return next((i for i in heads if i > s), -1)


def body(c):  # same layout as storyBody() in app.js: images[0] above, image k under heading k (k >= 1), extras at the end
    imgs, h, out, at = c.get("images", []), 0, [], pull_spot(c)
    for i, p in enumerate(c["story"]):
        if i == at: out.append(f'<blockquote class="pull">{e(c["pull"])}</blockquote>')
        if p.startswith("## "):
            out.append(f"<h2>{e(p[3:])}</h2>" + (figure(imgs[h]) if 0 < h < len(imgs) else "")); h += 1
        else:
            out.append(f"<p>{e(p)}</p>")
    return "".join(out) + "".join(figure(im) for im in imgs[max(h, 1):])


def page(c):
    url = f"{SITE}c/{c['id']}.html" if SITE else ""
    img = commons(c["images"][0]["file"], 1200) if c.get("images") else ""
    meta = [f'<meta property="og:title" content="{e(c["title"])}">', f'<meta property="og:description" content="{e(c["teaser"])}">',
            '<meta property="og:type" content="article">', '<meta property="og:site_name" content="Nhật Ký Thám Hiểm">',
            '<meta property="og:locale" content="vi_VN">', '<meta name="twitter:card" content="summary_large_image">']
    if img: meta.append(f'<meta property="og:image" content="{e(img)}">')
    if url: meta += [f'<meta property="og:url" content="{e(url)}">', f'<link rel="canonical" href="{e(url)}">']
    ld = {"@context": "https://schema.org", "@type": "Article", "headline": c["title"], "description": c["teaser"],
          "inLanguage": "vi", **({"image": img} if img else {}), **({"url": url} if url else {})}
    app_link = f"../#/c/{c['id']}"
    head = "\n  ".join(meta)
    ld_json = json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")
    sources = ('<h2 class="src-title">Nguồn</h2><ol class="sources">' + "".join(f'<li><a href="{e(s["url"])}">{e(s["label"])}</a></li>' for s in c["sources"]) + "</ol>") if c.get("sources") else ""
    return f"""<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(c["title"])} · Nhật Ký Thám Hiểm</title>
  <meta name="description" content="{e(c["teaser"])}">
  {head}
  <script type="application/ld+json">{ld_json}</script>
  <link rel="icon" href="../icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Playfair+Display:wght@600&family=Charm&display=swap">
  <link rel="stylesheet" href="../style.css">
</head>
<body>
  <header class="masthead"><a class="brand" href="../#/">Nhật Ký Thám Hiểm</a><p class="tagline">Những trang sử ít ai lật tới</p></header>
  <main id="app">
  <article class="story">
    <a class="back" href="{e(app_link)}">← Mở trong nhật ký để nhận con dấu</a>
    <div class="meta">{year(c["year"])} · {e(c["place"])} · {max(1, round(len(" ".join(c["story"]).split()) / 200))} phút đọc</div>
    <h1>{e(c["title"])}</h1>
    <p class="lead">{e(c["teaser"])}</p>
    {figure(c["images"][0]) if c.get("images") else ""}
    <div class="body">{body(c)}</div>
    <div class="verdict {e(c["verdict"])}"><strong>{VERDICT[c["verdict"]]}</strong> · {e(c["verdictNote"])}</div>
    {sources}
    <div class="actions"><a class="compass" href="{e(app_link)}">Mở trên bản đồ thám hiểm →</a></div>
  </article>
  </main>
</body>
</html>
"""


os.makedirs("c", exist_ok=True)
for c in cards:
    open(f"c/{c['id']}.html", "w", encoding="utf-8").write(page(c))
for f in {f for f in os.listdir("c") if f.endswith(".html")} - {f"{c['id']}.html" for c in cards}:
    os.remove(f"c/{f}")  # story no longer in cards.json
if SITE:
    urls = [SITE] + [f"{SITE}c/{c['id']}.html" for c in cards]
    open("sitemap.xml", "w", encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{e(u)}</loc></url>\n" for u in urls) + "</urlset>\n")
    open("robots.txt", "w").write(f"User-agent: *\nAllow: /\nSitemap: {SITE}sitemap.xml\n")
assert len(os.listdir("c")) == len(cards), "c/ should hold exactly one page per card"
print(f"{len(cards)} pages in c/" + (", sitemap.xml and robots.txt written" if SITE else " (no site URL given: skipped sitemap)"))
