"""Scatter fantasy-map relief icons (mountains, hills, dunes, trees) over the real mountain ranges, deserts,
plateaus and forests of Natural Earth's geography regions, one point set per zoom level. Writes relief.json,
and coast.json (simplified land outlines for the coastal ripple lines):

    python3 make_relief.py

Each point is [lat, lng, icon] where icon indexes RELIEF_ICONS in app.js. Re-run only if you change the rules below.
"""
import json, math, random, urllib.request

SRC = "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_geography_regions_polys.geojson"
# icon order must match RELIEF_ICONS in app.js
MOUNT, SNOW, HILL, DUNE, CONIFER, DECIDUOUS, PALM = range(7)
SNOWY = {"HIMALAYAS", "KARAKORAM RA.", "PAMIRS", "HINDU KUSH", "ALPS", "KUNLUN MOUNTAINS", "TIAN SHAN", "CAUCASUS MTS.",
         "ALASKA RANGE", "SOUTHERN ALPS", "CORDILLERA  REAL", "CORDILLERA OCCIDENTAL", "ROCKY MOUNTAINS", "KJØLEN MOUNTAINS"}
FOREST = {"AMAZON BASIN": PALM, "CONGO BASIN": PALM, "GUIANA SHIELD": PALM, "WESTERN SIBERIAN PLAIN": CONIFER,
          "CANADIAN SHIELD": CONIFER, "Aldan Upland": CONIFER, "CENTRAL SIBERIAN PLATEAU": CONIFER,
          "NORTHERN EUROPEAN PLAIN": DECIDUOUS, "CENTRAL RUSSIAN UPLAND": DECIDUOUS, "ALLEGHENY PLATEAU": DECIDUOUS,
          "Khorat Plat.": DECIDUOUS, "SHAN PLATEAU": DECIDUOUS}
SPACING = {MOUNT: 24, HILL: 64, DUNE: 48, "forest": 20}  # pixels between icons at every zoom
ZOOMS = range(2, 6)


def kind(p):
    name, cla = p["NAME"], p["FEATURECLA"]
    if name in FOREST: return "forest"
    if cla == "Range/mtn": return MOUNT
    if cla == "Desert": return DUNE
    if cla == "Plateau" and name not in ("PENÍNSULA IBÉRICA", "Polar Plateau"): return HILL
    return None


def inside(x, y, rings):  # even-odd ray casting over all rings (holes included)
    hit = False
    for r in rings:
        for (x1, y1), (x2, y2) in zip(r, r[1:] + r[:1]):
            if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1): hit = not hit
    return hit


merc_y = lambda lat: math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
lat_of = lambda my: math.degrees(2 * math.atan(math.exp(my)) - math.pi / 2)
assert abs(lat_of(merc_y(48.3)) - 48.3) < 1e-9
assert inside(1, 1, [[(0, 0), (2, 0), (2, 2), (0, 2)]]) and not inside(3, 1, [[(0, 0), (2, 0), (2, 2), (0, 2)]])

regions = json.load(urllib.request.urlopen(SRC))["features"]
rnd = random.Random(7)
out = {}
for z in ZOOMS:
    px = 256 * 2 ** z / (2 * math.pi)  # pixels per radian of longitude / Mercator unit
    pts = []
    for f in regions:
        k = kind(f["properties"])
        if k is None: continue
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for rings in polys:
            rings = [[tuple(c) for c in r] for r in rings]
            xs = [c[0] for c in rings[0]]; ys = [c[1] for c in rings[0]]
            if max(ys) < -60: continue  # Antarctica is off the map
            step = SPACING[k] / px  # Mercator units
            y0, y1 = merc_y(max(min(ys), -84)), merc_y(min(max(ys), 84))
            row = 0; my = y0
            while my <= y1:
                lng = min(xs) + (math.degrees(step) * 0.5 if row % 2 else 0)  # staggered rows look hand-placed
                while lng <= max(xs):
                    jx, jy = rnd.uniform(-.3, .3) * step, rnd.uniform(-.3, .3) * step
                    la, ln = lat_of(my + jy), lng + math.degrees(jx)
                    if inside(ln, la, rings):
                        icon = k if k != "forest" else FOREST[f["properties"]["NAME"]]
                        if k == MOUNT and f["properties"]["NAME"] in SNOWY: icon = SNOW
                        pts.append([round(la, 3), round(ln, 3), icon])
                    lng += math.degrees(step)
                my += step * .8; row += 1
    pts.sort(key=lambda p: -p[0])  # north first, so southern icons overlap them like a drawn map
    out[z] = pts
    print(f"zoom {z}: {len(pts)} icons")
json.dump(out, open("relief.json", "w"), separators=(",", ":"))

# Coast: outer ring of each land polygon, points closer than 0.18 degrees dropped (about 4 px at zoom 5),
# stored flat as tenths of a degree: [lng*10, lat*10, lng*10, lat*10, ...].
land = json.load(urllib.request.urlopen(SRC.replace("geography_regions_polys", "land")))["features"]
rings = []
for f in land:
    g = f["geometry"]
    for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]):
        r = poly[0]
        if max(c[1] for c in r) < -60: continue
        keep = [r[0]]
        for c in r[1:]:
            if math.hypot(c[0] - keep[-1][0], c[1] - keep[-1][1]) >= .18: keep.append(c)
        if len(keep) >= 4: rings.append([round(v * 10) for c in keep for v in c])
print(f"coast: {len(rings)} rings, {sum(map(len, rings)) // 2} points")
json.dump(rings, open("coast.json", "w"), separators=(",", ":"))
