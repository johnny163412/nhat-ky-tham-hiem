"""Check cards.json. Usage: python3 check_cards.py [--links]  (--links also checks each Wikipedia page exists)"""
import json, sys, time, urllib.error, urllib.parse, urllib.request

cards = json.load(open("cards.json", encoding="utf-8"))
ids = [c["id"] for c in cards]
assert len(ids) == len(set(ids)), "duplicate id"
for c in cards:
    for k in ("id", "title", "year", "place", "teaser", "story", "verdict", "verdictNote", "wiki"):
        assert c.get(k) not in (None, "", []), f"{c.get('id')}: missing {k}"
    assert c["verdict"] in ("that", "don", "chuaro"), f"{c['id']}: bad verdict"
    assert c.get("kind") in ("bian", "tran", "bien", "vua", "khampha", "doi"), f"{c['id']}: bad kind"
    assert isinstance(c["year"], int), f"{c['id']}: year must be int (negative = TCN)"
    assert c["wiki"][:3] in ("en:", "vi:"), f"{c['id']}: wiki must start with en: or vi:"
    assert not c["story"][0].startswith("## "), f"{c['id']}: story must open with prose, not a heading"
    for src in c.get("sources", []):
        assert src.get("label") and src.get("url", "").startswith("https://"), f"{c['id']}: bad source {src}"
    for im in c.get("images", []):
        assert im.get("file", "").startswith("File:") and im.get("caption") and im.get("credit"), f"{c['id']}: bad image {im}"
    assert "pull" not in c or any(c["pull"] in p for p in c["story"] if not p.startswith("## ")), f"{c['id']}: pull quote must be copied from the story"
    assert all(isinstance(im.get("w", 1), int) and isinstance(im.get("h", 1), int) for im in c.get("images", [])), f"{c['id']}: image w/h must be int"
    assert "date" not in c or __import__("re").fullmatch(r"(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])", c["date"]), f"{c['id']}: date must be MM-DD"
    assert -90 <= c.get("lat", 999) <= 90 and -180 <= c.get("lng", 999) <= 180, f"{c['id']}: missing or bad lat/lng"

if "--links" in sys.argv:
    bad = []
    for c in cards:
        lang, title = c["wiki"].split(":", 1)
        time.sleep(1)  # Wikipedia returns 429 on fast bursts
        url = f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(title)}"
        req = urllib.request.Request(url, headers={"User-Agent": "history-journal-check/0.1"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=15) as r:
                    img = "có ảnh" if json.load(r).get("thumbnail") else "không ảnh"
                    print(f"ok   {c['wiki']} ({img})")
                break
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < 2: time.sleep(10); continue  # rate limit, not a broken link
                bad.append(c["wiki"]); print(f"FAIL {c['wiki']}: {e}"); break
            except Exception as e:
                bad.append(c["wiki"]); print(f"FAIL {c['wiki']}: {e}"); break
    for c in cards:
        for src in c.get("sources", []):
            time.sleep(1)
            try:
                urllib.request.urlopen(urllib.request.Request(src["url"], headers={"User-Agent": "history-journal-check/0.1"}), timeout=15)
            except urllib.error.HTTPError as e:
                if e.code != 429: bad.append(src["url"]); print(f"FAIL {c['id']} source {src['url']}: {e}")
            except Exception as e:
                bad.append(src["url"]); print(f"FAIL {c['id']} source {src['url']}: {e}")
    assert not bad, f"{len(bad)} links broken"

print(f"{len(cards)} cards ok")
