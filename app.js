const app = document.getElementById("app");
const VERDICT = { that: "Đã xác thực", don: "Lời đồn", chuaro: "Chưa rõ" };
let cards = [];

// Stories the reader has opened, kept only in this browser.
const SEEN_KEY = "nhatky-da-doc";
const seen = new Set((() => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch { return []; } })());
function markSeen(id) {
  if (seen.has(id)) return false;
  seen.add(id);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch { /* private mode: progress lasts this visit only */ }
  return true;
}

// Reading streak: consecutive local days with a story opened. A 7-day run earns a freeze (max 2) that forgives one missed day.
const STREAK_KEY = "nhatky-chuoi";
const dayNo = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const nextStreak = (s, today) => {
  const gap = today - s.last;
  if (gap === 0) return s;
  const kept = gap === 1 || (gap === 2 && s.freeze > 0);
  const n = kept ? s.n + 1 : 1, freeze = Math.min(2, (gap === 2 && kept ? s.freeze - 1 : s.freeze) + (n % 7 === 0 ? 1 : 0));
  return { last: today, n, best: Math.max(s.best, n), freeze };
};
const liveStreak = s => { const gap = dayNo() - s.last; return gap <= 1 || (gap === 2 && s.freeze > 0) ? s.n : 0; };
console.assert(nextStreak({ last: 10, n: 6, best: 6, freeze: 0 }, 11).freeze === 1 && nextStreak({ last: 10, n: 3, best: 5, freeze: 1 }, 12).n === 4
  && nextStreak({ last: 10, n: 3, best: 5, freeze: 0 }, 12).n === 1 && nextStreak({ last: 10, n: 3, best: 5, freeze: 0 }, 10).n === 3, "nextStreak");
let streak = (() => { try { return JSON.parse(localStorage.getItem(STREAK_KEY)); } catch { return null; } })() || { last: 0, n: 0, best: 0, freeze: 0 };
const saveStreak = () => { try { localStorage.setItem(STREAK_KEY, JSON.stringify(streak)); } catch { /* private mode */ } };

const esc = s =>String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const yearText = y => (y < 0 ? `${-y} TCN` : `năm ${y}`);
const wikiUrl = w => { const [lang, t] = w.split(/:(.*)/); return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(t)}`; };


// Same page for everyone on a given day: a story dated within 3 days of today ("on this day"),
// else stable id order indexed by the local calendar day.
const dayOfYear = md => { const [m, d] = md.split("-").map(Number); return dayNo(new Date(2000, m - 1, d)) - dayNo(new Date(2000, 0, 1)); };
function todayCard(now = new Date()) {
  const t = dayOfYear(`${now.getMonth() + 1}-${now.getDate()}`);
  const dist = c => { const x = Math.abs(dayOfYear(c.date) - t); return Math.min(x, 366 - x); };
  const byId = [...cards].sort((x, y) => x.id.localeCompare(y.id));
  const near = byId.filter(c => c.date && dist(c) <= 3).sort((x, y) => dist(x) - dist(y))[0];
  if (near) { const [m, d] = near.date.split("-").map(Number); return { card: near, label: `${dist(near) ? "Tuần này" : "Ngày này"} năm xưa · ${d}/${m}/${near.year < 0 ? `${-near.year} TCN` : near.year}` }; }
  return { card: byId[dayNo(now) % byId.length], label: `Trang hôm nay · ${now.getDate()}/${now.getMonth() + 1}` };
}

// Journal and passport pages sit in the same double rule and engraved corners as the map.
const folio = html => `<div class="folio">${["tl", "tr", "bl", "br"].map(k => `<i class="corner ${k}" aria-hidden="true"></i>`).join("")}${html}</div>`;

function renderFeed() {
  const { card: t, label } = todayCard(), s = liveStreak(streak), readToday = streak.last === dayNo();
  app.innerHTML = folio(`<a class="today" href="#/c/${esc(t.id)}">
      <span class="today-ribbon">${esc(label)}</span>
      ${s ? `<span class="streak">${readToday ? `Đã đi ${s} ngày liền` : `Lật một trang hôm nay để giữ chuỗi ${s} ngày`}</span>` : ""}
      <span class="meta">${KINDS[t.kind][0]} · ${yearText(t.year)} · ${esc(t.place)}</span>
      <strong>${esc(t.title)}</strong>
      <span>${esc(t.teaser)}</span>
      <span class="today-go">${seen.has(t.id) ? "Đã đọc, đọc lại →" : "Lật trang này →"}</span>
    </a>
    <ul class="feed">${cards.map(c => `
    <li><a class="page" href="#/c/${esc(c.id)}">
      <span class="stamp ${c.verdict}">${VERDICT[c.verdict]}</span>
      <img class="sketch" src="${commons(c.images[0].file, 500)}" alt="" loading="lazy">
      <div class="meta">${yearText(c.year)} · ${esc(c.place)} · ${readMins(c)} phút đọc</div>
      <h2>${esc(c.title)}</h2>
      <p>${esc(c.teaser)}</p>
    </a></li>`).join("")}</ul>`);
}

// Commons serves a resized copy of any file through Special:FilePath.
const commons = (f, w) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f.replace(/^File:/, ""))}${w ? `?width=${w}` : ""}`;
// width/height from Commons (stored in cards.json) reserve the space, so text does not jump when the image arrives.
const figure = im => `<figure class="fig">
  <button type="button" class="zoom" data-file="${esc(im.file)}" aria-label="Phóng to ảnh: ${esc(im.caption)}"><span class="mount"><img class="sketch" src="${commons(im.file, 960)}" alt="${esc(im.caption)}" width="${im.w || ""}" height="${im.h || ""}"${im.w ? ` style="aspect-ratio:${im.w}/${im.h}"` : ""} loading="lazy"></span></button>
  <figcaption>${esc(im.caption)} <a href="https://commons.wikimedia.org/wiki/${encodeURIComponent(im.file)}" target="_blank" rel="noopener">${esc(im.credit)}</a></figcaption>
</figure>`;

const readMins = c => Math.max(1, Math.round(c.story.join(" ").split(/\s+/).length / 200)); // ~200 Vietnamese syllables a minute

// Glossary notes: the first use of each term in a story becomes a tappable word with a margin note.
let GLOSS = {};
const isWordChar = ch => /[\p{L}\p{N}]/u.test(ch || " ");
function gloss(html, terms, used) {
  const hits = [];
  for (const t of terms) {
    if (used.has(t)) continue;
    const e = esc(t);
    for (let k = html.indexOf(e); k >= 0; k = html.indexOf(e, k + 1)) {
      if (isWordChar(html[k - 1]) || isWordChar(html[k + e.length]) || hits.some(([s, l]) => k < s + l && s < k + e.length)) continue;
      hits.push([k, e.length, t]); used.add(t); break;
    }
  }
  for (const [k, l, t] of hits.sort((x, y) => y[0] - x[0]))
    html = `${html.slice(0, k)}<button type="button" class="gloss" aria-expanded="false">${html.slice(k, k + l)}</button><span class="gloss-note" role="note" hidden>${esc(GLOSS[t])}</span>${html.slice(k + l)}`;
  return html;
}
console.assert((GLOSS = { ab: "x" }, gloss("abc ab", ["ab"], new Set())).startsWith("abc <button") && gloss("cab", ["ab"], new Set()) === "cab", "gloss");
GLOSS = {};

// Pull quote goes just before the section it comes from (or after the opening section), so it teases what is next.
const pullSpot = c => {
  const s = c.pull ? c.story.findIndex(p => !p.startsWith("## ") && p.includes(c.pull)) : -1;
  if (s < 0) return -1;
  const heads = c.story.flatMap((p, i) => (p.startsWith("## ") ? [i] : []));
  const before = heads.filter(i => i <= s).pop();
  return before > 0 ? before : heads.find(i => i > s) ?? -1;
};

// images[0] is the frontispiece above the story; image k sits under section heading k (k >= 1); extras close the story.
function storyBody(c) {
  const imgs = c.images || [], used = new Set(), terms = Object.keys(GLOSS).sort((a, b) => b.length - a.length), at = pullSpot(c);
  let h = 0;
  const html = c.story.map((p, i) => {
    const quote = i === at ? `<blockquote class="pull">${esc(c.pull)}</blockquote>` : "";
    if (!p.startsWith("## ")) return quote + `<p>${i ? gloss(esc(p), terms, used) : esc(p)}</p>`; // keep the drop cap paragraph plain
    const im = h ? imgs[h] : null; h++;
    return quote + `<h2>${esc(p.slice(3))}</h2>${im ? figure(im) : ""}`;
  }).join("");
  return html + imgs.slice(Math.max(h, 1)).map(figure).join("");
}

// --- reading aids: ink progress line, resume where you left off, listen with the device's Vietnamese voice ---
const progress = document.getElementById("progress"), POS_KEY = "nhatky-cho-doc";
const readPos = (() => { try { return JSON.parse(localStorage.getItem(POS_KEY)) || {}; } catch { return {}; } })();
let reading = null, locMap = null, posTimer;
addEventListener("scroll", () => {
  if (!reading) return;
  const art = app.querySelector(".story"); if (!art) return;
  const r = art.getBoundingClientRect(), done = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
  progress.style.transform = `scaleX(${done})`;
  clearTimeout(posTimer);
  posTimer = setTimeout(() => {
    if (!reading) return;
    const k = reading.marks.findIndex(el => el.getBoundingClientRect().top > 80);
    if (reading.end.getBoundingClientRect().top < innerHeight) delete readPos[reading.id]; // finished
    else if (k >= 3) readPos[reading.id] = k - 1; // the jump to the top on opening must not erase the saved place
    else return;
    try { localStorage.setItem(POS_KEY, JSON.stringify(readPos)); } catch {}
  }, 400);
}, { passive: true });

const plainText = el => { const x = el.cloneNode(true); x.querySelectorAll(".gloss-note").forEach(n => n.remove()); return x.textContent; };
// Prefer neural voices (Edge's "HoaiMy/NamMinh Online (Natural)", Apple's Premium/Enhanced) over the robotic compact ones.
const voiceRank = v => (/natural|online|neural/i.test(v.name) ? 3 : /premium|enhanced|nâng cao/i.test(v.name) ? 2 : 1);
const viVoice = () => speechSynthesis.getVoices().filter(v => /^vi/i.test(v.lang)).sort((a, b) => voiceRank(b) - voiceRank(a))[0];
function setupListen(btn, parts) {
  if (!("speechSynthesis" in window)) return;
  const show = () => { btn.hidden = !viVoice(); }; // no Vietnamese voice on this device: reading Vietnamese with another voice is unlistenable
  show(); speechSynthesis.onvoiceschanged = show;
  let i = 0, state = "idle";
  const label = () => { btn.textContent = state === "play" ? "❚❚ Tạm dừng" : state === "pause" ? "▶ Nghe tiếp" : "▶ Nghe kể"; };
  const mark = k => parts.forEach((p, n) => p.classList.toggle("speaking", n === k));
  const speak = () => {
    if (state !== "play") return;
    if (i >= parts.length) { state = "idle"; i = 0; mark(-1); return label(); }
    const u = new SpeechSynthesisUtterance(plainText(parts[i])); // one paragraph per utterance: long ones get cut off in some browsers
    u.voice = viVoice(); u.lang = "vi-VN"; u.rate = .95;
    u.onend = () => { if (state === "play") { i++; speak(); } };
    mark(i); parts[i].scrollIntoView({ behavior: "smooth", block: "center" });
    speechSynthesis.speak(u);
  };
  btn.onclick = () => {
    if (state === "play") { state = "pause"; speechSynthesis.cancel(); } else { state = "play"; speechSynthesis.cancel(); speak(); }
    label();
  };
}

// Lightbox, glossary notes: one delegated handler for every story view.
const lightbox = document.getElementById("lightbox");
app.addEventListener("click", e => {
  const z = e.target.closest(".zoom");
  if (z) {
    lightbox.querySelector("img").src = commons(z.dataset.file, 1600);
    lightbox.querySelector("img").alt = z.querySelector("img").alt;
    lightbox.querySelector("p").textContent = z.querySelector("img").alt;
    return lightbox.showModal();
  }
  const g = e.target.closest(".gloss");
  if (g) { const open = g.getAttribute("aria-expanded") !== "true"; g.setAttribute("aria-expanded", open); g.nextElementSibling.hidden = !open; }
});
lightbox.addEventListener("click", e => { if (e.target === lightbox || e.target.closest("[data-close]")) lightbox.close(); });

const BACK = { "#/": "Về bản đồ", "#/nhat-ky": "Về nhật ký", "#/ho-chieu": "Về hộ chiếu", "#/dong-thoi-gian": "Về dòng thời gian" };

// --- sounds: synthesised with Web Audio (no files): a paper rustle for a page, a thump for a stamp ---
const SOUND_KEY = "nhatky-am-thanh";
let soundOn = (() => { try { return localStorage.getItem(SOUND_KEY) !== "0"; } catch { return true; } })(), ac;
function sfx(kind) {
  if (!soundOn || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    ac ||= new AudioContext();
    if (ac.state !== "running") return; // browsers block audio until the reader has clicked something
    const t = ac.currentTime, out = ac.createGain();
    out.connect(ac.destination);
    const noise = dur => { const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < .03 ? 2.5 : 1); // crackle
      const s = ac.createBufferSource(); s.buffer = b; return s; };
    if (kind === "page") {
      const n = noise(.45), f = ac.createBiquadFilter();
      f.type = "bandpass"; f.Q.value = .8; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + .4);
      out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.22, t + .05); out.gain.exponentialRampToValueAtTime(.001, t + .45);
      n.connect(f).connect(out); n.start(t);
    } else {
      const o = ac.createOscillator(), n = noise(.08), f = ac.createBiquadFilter();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + .16);
      f.type = "lowpass"; f.frequency.value = 900;
      out.gain.setValueAtTime(.5, t); out.gain.exponentialRampToValueAtTime(.001, t + .22);
      o.connect(out); n.connect(f).connect(out); o.start(t); o.stop(t + .25); n.start(t);
    }
  } catch { /* no Web Audio: stay silent */ }
}
document.addEventListener("pointerdown", () => { try { ac ||= new AudioContext(); ac.resume(); } catch {} }, { once: true });

function renderStory(c) {
  const heads = c.story.filter(p => p.startsWith("## "));
  const fresh = markSeen(c.id);
  streak = nextStreak(streak, dayNo()); saveStreak();
  sfx("page"); if (fresh) setTimeout(() => sfx("stamp"), 650);
  app.innerHTML = `<article class="story turn">
    <a class="back" href="${lastView}">← ${BACK[lastView] || "Về hành trình"}</a>
    ${fresh ? `<div class="new-stamp" role="status">Đã đóng dấu vào hộ chiếu · ${seen.size}/${cards.length}${earnedBy(c.id).map(b => `<br>Huy hiệu mới: ${esc(b.name)}`).join("")}</div>` : ""}
    <div class="meta">${yearText(c.year)} · ${esc(c.place)} · ${readMins(c)} phút đọc</div>
    <h1>${esc(c.title)}</h1>
    <figure class="locator"><div id="locator" role="img" aria-label="Vị trí trên bản đồ: ${esc(c.place)}"></div><figcaption>© Stadia Maps, Stamen, OpenStreetMap</figcaption></figure>
    <p class="lead">${esc(c.teaser)}</p>
    <div class="story-tools">
      <button class="chip" type="button" data-listen hidden>▶ Nghe kể</button>
      ${readPos[c.id] ? `<button class="chip" type="button" data-resume>Đọc tiếp chỗ đang dở ↓</button>` : ""}
    </div>
    ${heads.length > 1 ? `<details class="toc"><summary>Mục lục · ${heads.length} phần</summary><ol>${heads.map((t, k) => `<li><button type="button" data-toc="${k}">${esc(t.slice(3))}</button></li>`).join("")}</ol></details>` : ""}
    ${c.images?.[0] ? figure(c.images[0]) : ""}
    <div class="body">${storyBody(c)}</div>
    <div class="verdict ${c.verdict}"><strong>${VERDICT[c.verdict]}</strong> · ${esc(c.verdictNote)}</div>
    ${c.sources ? `<h2 class="src-title">Nguồn</h2><ol class="sources">${c.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join("")}</ol>` : ""}
    <div class="actions">
      <a href="${wikiUrl(c.wiki)}" target="_blank" rel="noopener">Đọc thêm trên Wikipedia →</a>
      <button class="compass" type="button" data-random>Chuyện khác bất kỳ</button>
      <button class="chip" type="button" data-share>Gửi bưu thiếp</button>
    </div>
  </article>`;
  const body = app.querySelector(".body"), marks = () => [...body.querySelectorAll(":scope > p, :scope > h2")];
  app.querySelectorAll("[data-toc]").forEach(b => b.onclick = () => body.querySelectorAll(":scope > h2")[+b.dataset.toc].scrollIntoView({ behavior: "smooth" }));
  const resume = app.querySelector("[data-resume]");
  if (resume) resume.onclick = () => marks()[readPos[c.id]]?.scrollIntoView({ behavior: "smooth", block: "start" });
  reading = { id: c.id, marks: marks(), end: app.querySelector(".verdict") };
  progress.hidden = false;
  locMap = L.map("locator", { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false,
    keyboard: false, touchZoom: false, attributionControl: false }).setView([c.lat, c.lng], 4);
  watercolor().addTo(locMap);
  L.circleMarker([c.lat, c.lng], { radius: 6, color: "#6e2a12", weight: 2, fillColor: "#8e3b1f", fillOpacity: .9 }).addTo(locMap);
  setupListen(app.querySelector("[data-listen]"), [app.querySelector(".story .lead"), ...marks()]);
  app.querySelector("[data-random]").onclick = goRandom;
  app.querySelector("[data-share]").onclick = e => sharePostcard(e.currentTarget, () => drawStoryCard(c), c.id, new URL(`c/${c.id}.html`, location.href).href);
}

// --- postcards: draw a story or the passport onto a canvas and share it as a PNG ---
const PC = { w: 1080, h: 1350, paper: "#efe2c4", ink: "#3b2a1a", rust: "#8e3b1f", soft: "#6b5238" };
function wrapText(g, text, x, y, maxW, lh, maxLines) {
  const words = text.split(" "); let line = "", n = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (g.measureText(test).width > maxW && line) {
      if (++n === maxLines) { g.fillText(`${line}…`, x, y); return y + lh; }
      g.fillText(line, x, y); y += lh; line = words[i];
    } else line = test;
  }
  g.fillText(line, x, y); return y + lh;
}
function cardCanvas() {
  const c = document.createElement("canvas"); c.width = PC.w; c.height = PC.h;
  const g = c.getContext("2d");
  g.fillStyle = PC.paper; g.fillRect(0, 0, PC.w, PC.h);
  const v = g.createRadialGradient(PC.w / 2, PC.h / 2, PC.h * .3, PC.w / 2, PC.h / 2, PC.h * .75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(96,58,20,.35)");
  g.fillStyle = v; g.fillRect(0, 0, PC.w, PC.h);
  g.strokeStyle = PC.ink; g.lineWidth = 4; g.strokeRect(36, 36, PC.w - 72, PC.h - 72); g.lineWidth = 1.5; g.strokeRect(50, 50, PC.w - 100, PC.h - 100);
  g.fillStyle = PC.rust; g.textAlign = "center"; g.font = "600 30px 'EB Garamond', Georgia, serif";
  g.fillText("✦  N H Ậ T   K Ý   T H Á M   H I Ể M  ✦", PC.w / 2, 104);
  return [c, g];
}
// Special:FilePath redirects without CORS headers, so ask the API (which allows origin=*) for the direct thumbnail URL.
const thumbUrl = (file, w) => fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url&iiurlwidth=${w}&titles=${encodeURIComponent(file)}`)
  .then(r => r.json()).then(d => Object.values(d.query.pages)[0].imageinfo[0].thumburl).catch(() => null);
const loadImg = src => new Promise(ok => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
async function drawStoryCard(c) {
  await document.fonts?.ready;
  const [cv, g] = cardCanvas();
  const src = c.images?.[0] && await thumbUrl(c.images[0].file, 960), im = src && await loadImg(src);
  let y = 140;
  if (im) { // cover-crop into a 980x560 window, sepia like the app
    const bw = 920, bh = 540, s = Math.max(bw / im.width, bh / im.height), sw = bw / s, sh = bh / s;
    g.save(); g.filter = "sepia(.45) contrast(1.05)";
    g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 80, y, bw, bh); g.restore();
    g.strokeStyle = PC.ink; g.lineWidth = 2; g.strokeRect(80, y, bw, bh); y += bh + 70;
  } else y += 60;
  g.textAlign = "left"; g.fillStyle = PC.soft; g.font = "italic 34px 'Charm', 'EB Garamond', serif";
  g.fillText(`${KINDS[c.kind][0]} · ${yearText(c.year)} · ${c.place}`, 80, y); y += 66;
  g.fillStyle = PC.ink; g.font = "600 54px 'EB Garamond', Georgia, serif";
  y = wrapText(g, c.title, 80, y, 920, 62, 3) + 14;
  g.font = "34px 'EB Garamond', Georgia, serif"; g.fillStyle = "#4a3726";
  wrapText(g, c.teaser, 80, y, 920, 46, im ? 4 : 10);
  // verdict stamp, bottom right
  g.save(); g.translate(PC.w - 190, PC.h - 190); g.rotate(-.18);
  g.strokeStyle = g.fillStyle = { that: "#4f5d2f", don: PC.rust, chuaro: "#9a6a12" }[c.verdict];
  g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 105, 0, 7); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 92, 0, 7); g.stroke();
  g.textAlign = "center"; g.font = "600 25px 'EB Garamond', serif"; g.fillText(VERDICT[c.verdict].toUpperCase(), 0, 9, 170); g.restore();
  return cv;
}
async function drawPassportCard(done) {
  await document.fonts?.ready;
  const [cv, g] = cardCanvas();
  g.fillStyle = PC.ink; g.font = "600 66px 'EB Garamond', Georgia, serif"; g.fillText("Hộ chiếu nhà thám hiểm", PC.w / 2, 210);
  g.fillStyle = PC.soft; g.font = "italic 38px 'Charm', 'EB Garamond', serif";
  g.fillText(`Đã khám phá ${done.length} / ${cards.length} nơi · ${badges().filter(b => b.got === b.ids.length).length} huy hiệu`, PC.w / 2, 275);
  const cols = 4, r = 100, show = done.slice(0, 16);
  show.forEach((c, i) => {
    const x = 175 + (i % cols) * 243, y = 420 + Math.floor(i / cols) * 230;
    g.save(); g.translate(x, y); g.rotate(tilt(c.id) * Math.PI / 180);
    g.strokeStyle = g.fillStyle = { that: "#4f5d2f", don: PC.rust, chuaro: "#9a6a12" }[c.verdict];
    g.globalAlpha = .85; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, r - 10, 0, 7); g.stroke();
    g.textAlign = "center"; g.font = "600 22px 'EB Garamond', serif";
    wrapText(g, c.place.toUpperCase(), 0, -22, 160, 26, 2);
    g.font = "italic 34px 'EB Garamond', serif"; g.fillText(yearText(c.year).replace("năm ", ""), 0, 50); g.restore();
  });
  if (done.length > show.length) { g.fillStyle = PC.soft; g.font = "italic 34px 'Charm', serif"; g.fillText(`và ${done.length - show.length} con dấu nữa…`, PC.w / 2, PC.h - 110); }
  return cv;
}
async function sharePostcard(btn, draw, name, url) {
  btn.disabled = true;
  try {
    const cv = await draw(), blob = await new Promise(ok => cv.toBlob(ok, "image/png"));
    const file = new File([blob], `nhat-ky-tham-hiem-${name}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Nhật Ký Thám Hiểm", ...(url && { text: url }) });
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
  } catch (e) { if (e.name !== "AbortError") alert("Không tạo được bưu thiếp, thử lại sau nhé."); }
  btn.disabled = false;
}

// --- badges: finish a journey or every story of one kind ---
const badges = () => [
  ...JOURNEYS.map(j => ({ name: j.name, hint: `Đọc đủ ${j.ids.length} chặng hành trình`, ids: j.ids, mark: "✦" })),
  ...Object.entries(KINDS).map(([k, [label]]) => ({ name: `Bậc thầy ${label.toLowerCase()}`, hint: `Đọc mọi chuyện loại ${label.toLowerCase()}`, ids: cards.filter(c => c.kind === k).map(c => c.id), kind: k })),
].map(b => ({ ...b, got: b.ids.filter(id => seen.has(id)).length }));
const earnedBy = id => badges().filter(b => b.ids.includes(id) && b.got === b.ids.length);

// --- passport: one stamp per story read ---
const tilt = id => ([...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 3) % 13) - 6;
// Round customs stamp: place on the top arc, journal name on the bottom arc, year in the middle.
const stampSvg = c => { const k = `s-${c.id}`; return `<svg viewBox="0 0 140 140" aria-hidden="true">
  <defs><path id="${k}-t" d="M22 70a48 48 0 0 1 96 0"/><path id="${k}-b" d="M16 70a54 54 0 0 0 108 0"/></defs>
  <g fill="none" stroke="currentColor"><circle cx="70" cy="70" r="66" stroke-width="3.5"/><circle cx="70" cy="70" r="60" stroke-width="1"/><circle cx="70" cy="70" r="33" stroke-width="1.2" stroke-dasharray="3 2"/></g>
  <text class="visa-arc"><textPath href="#${k}-t" startOffset="50%" text-anchor="middle" textLength="${Math.min(140, c.place.length * 9)}" lengthAdjust="spacingAndGlyphs">${esc(c.place)}</textPath></text>
  <text class="visa-arc" style="font-size:9px"><textPath href="#${k}-b" startOffset="50%" text-anchor="middle">✦ Nhật Ký Thám Hiểm ✦</textPath></text>
  <text class="visa-yr" x="70" y="76" text-anchor="middle">${yearText(c.year).replace("năm ", "")}</text>
  <text x="70" y="94" text-anchor="middle" style="font-size:9px;letter-spacing:.2em">${VERDICT[c.verdict].toUpperCase()}</text></svg>`; };

function renderPassport() {
  const done = cards.filter(c => seen.has(c.id)).sort((a, b) => a.year - b.year);
  app.innerHTML = folio(`<section class="passport">
    <h1>Hộ chiếu nhà thám hiểm</h1>
    <p class="meta">Đã khám phá ${done.length} / ${cards.length} nơi. Mỗi câu chuyện bạn đọc là một con dấu, và sương mù trên bản đồ tan dần quanh nơi đó.</p>
    <p class="streak-line"><strong>${liveStreak(streak)}</strong> ngày đi liên tiếp · kỷ lục ${streak.best} ngày · ${"⛺".repeat(streak.freeze) || "chưa có"} trạm nghỉ
      <small>(đi đủ 7 ngày liền được một trạm nghỉ, giữ chuỗi khi lỡ một ngày)</small></p>
    <h2 class="src-title">Huy hiệu</h2>
    <ul class="badges">${badges().map(b => `<li class="badge${b.got === b.ids.length ? " got" : ""}" title="${esc(b.hint)}">
      <span class="medal" aria-hidden="true">${b.kind ? glyph(b.kind) : b.mark}</span>
      <span class="badge-name">${esc(b.name)}</span>
      <span class="badge-count">${b.got}/${b.ids.length}</span></li>`).join("")}</ul>
    <h2 class="src-title">Con dấu</h2>
    ${done.length ? "" : `<p class="lead">Trang hộ chiếu còn trống. Hãy mở bản đồ và chọn một nơi để bắt đầu.</p>`}
    <ul class="stamps">${done.map(c => `<li><a class="visa ${c.verdict}" href="#/c/${esc(c.id)}" style="--tilt:${tilt(c.id)}deg" aria-label="${esc(c.place)}, ${yearText(c.year)}: ${esc(c.title)}">${stampSvg(c)}</a>
      <p class="visa-cap">${esc(c.title)}</p></li>`).join("")}${cards.filter(c => !seen.has(c.id)).map(() => `<li><span class="visa blank" aria-hidden="true">?</span></li>`).join("")}</ul>
    ${done.length ? `<button class="chip" type="button" id="share-passport">Chia sẻ hộ chiếu thành ảnh</button> ` : ""}
    ${done.length ? `<button class="chip" type="button" id="reset-passport">Xóa hộ chiếu, phủ lại sương mù</button>` : ""}
    <h2 class="src-title">Cất giữ hộ chiếu</h2>
    <p class="meta">Hộ chiếu chỉ nằm trong trình duyệt này. Lưu ra tệp để mang sang máy khác hoặc phòng khi trình duyệt xóa dữ liệu.</p>
    <button class="chip" type="button" id="save-passport">Lưu hộ chiếu ra tệp</button>
    <label class="chip">Mở hộ chiếu từ tệp<input type="file" id="load-passport" accept=".json,application/json" hidden></label>
  </section>`);
  document.getElementById("save-passport").onclick = () => {
    const file = new File([JSON.stringify({ app: "nhatky", v: 1, seen: [...seen], streak })], `ho-chieu-nhat-ky-${new Date().toISOString().slice(0, 10)}.json`, { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  document.getElementById("load-passport").onchange = async e => {
    try {
      const d = JSON.parse(await e.target.files[0].text());
      if (d?.app !== "nhatky" || !Array.isArray(d.seen)) throw 0;
      const ids = new Set(cards.map(c => c.id)), before = seen.size;
      d.seen.forEach(id => ids.has(id) && seen.add(id)); // merge, never drop stamps already here
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch {}
      const s = d.streak, ok = s && ["last", "n", "best", "freeze"].every(k => Number.isInteger(s[k]) && s[k] >= 0);
      if (ok) { streak = s.last >= streak.last ? { ...s, best: Math.max(s.best, streak.best), freeze: Math.min(2, s.freeze) } : { ...streak, best: Math.max(s.best, streak.best) }; saveStreak(); }
      renderPassport();
      alert(`Đã mở hộ chiếu: thêm ${seen.size - before} con dấu.`);
    } catch { alert("Tệp này không phải hộ chiếu Nhật Ký Thám Hiểm."); }
  };
  const reset = document.getElementById("reset-passport");
  const sp = document.getElementById("share-passport");
  if (sp) sp.onclick = () => sharePostcard(sp, () => drawPassportCard(done), "ho-chieu");
  if (reset) reset.onclick = () => {
    if (!confirm("Xóa mọi con dấu và phủ sương mù lại toàn bản đồ?")) return;
    seen.clear();
    try { localStorage.removeItem(SEEN_KEY); } catch { /* nothing stored */ }
    renderPassport();
  };
}

// --- world map ---
// Every border snapshot in historical-basemaps; each slider step is one snapshot,
// and a story belongs to the last snapshot at or before its year.
const SNAPS = ["bc123000", "bc10000", "bc8000", "bc5000", "bc4000", "bc3000", "bc2000", "bc1500", "bc1000", "bc700",
  "bc500", "bc400", "bc323", "bc300", "bc200", "bc100", "bc1", "100", "200", "300", "400", "500", "600", "700", "800",
  "900", "1000", "1100", "1200", "1279", "1300", "1400", "1492", "1500", "1530", "1600", "1650", "1700", "1715",
  "1783", "1800", "1815", "1878", "1880", "1900", "1914", "1920", "1930", "1938", "1945", "1960", "1994", "2000", "2010"];
// Vietnamese periods by start year (simplified: overlaps such as Lê trung hưng and Tây Sơn are shown by who held Thăng Long/Phú Xuân).
const VN_ERAS = [[-99999, "thời tiền sử"], [-2879, "thời Hồng Bàng, Văn Lang"], [-257, "nước Âu Lạc"], [-179, "Bắc thuộc lần 1"],
  [40, "Hai Bà Trưng"], [43, "Bắc thuộc lần 2"], [544, "nhà Tiền Lý, Vạn Xuân"], [602, "Bắc thuộc lần 3"], [939, "nhà Ngô"],
  [968, "nhà Đinh"], [980, "nhà Tiền Lê"], [1009, "nhà Lý"], [1225, "nhà Trần"], [1400, "nhà Hồ"], [1407, "thuộc Minh"],
  [1428, "nhà Lê sơ"], [1527, "nhà Mạc"], [1592, "Lê trung hưng, Trịnh Nguyễn phân tranh"], [1778, "nhà Tây Sơn"],
  [1802, "nhà Nguyễn"], [1858, "Pháp thuộc"], [1945, "Việt Nam hiện đại"]];
const vnEra = y => VN_ERAS.findLast(([s]) => s <= y)[1];
console.assert(vnEra(1288) === "nhà Trần" && vnEra(-500) === "thời Hồng Bàng, Văn Lang" && vnEra(40) === "Hai Bà Trưng", "vnEra");
const vnSpan = i => {
  const from = vnEra(snapYear(SNAPS[i])), to = i + 1 < SNAPS.length ? vnEra(snapYear(SNAPS[i + 1]) - 1) : vnEra(3000);
  return from === to ? from : `${from} → ${to}`;
};
const snapYear = s => (s.startsWith("bc") ? -Number(s.slice(2)) : Number(s));
const snapOf = y => Math.max(0, SNAPS.findLastIndex(s => snapYear(s) <= y));
const snapLabel = i => { const y = snapYear(SNAPS[i]); return y < 0 ? `Năm ${(-y).toLocaleString("vi")} TCN` : `Năm ${y}`; };
const BORDERS = "https://cdn.jsdelivr.net/gh/aourednik/historical-basemaps@4b5039e50d8d2464b065bd76ad6086cd4597108d/geojson/world_";
const INKS = ["#8e3b1f", "#4f5d2f", "#9a6a12", "#5b4a7a", "#2f5d62", "#7a4a2a"];
const inkFor = name => INKS[[...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % INKS.length];
const borderFiles = new Map();
let borderLayer, borderToken = 0;

async function drawBorders() {
  const token = ++borderToken;
  const snap = era === null ? null : SNAPS[era];
  document.getElementById("border-note").textContent = snap ? `Biên giới n${snapLabel(era).slice(1)}` : "Bản đồ ngày nay";
  if (!snap) { borderLayer?.remove(); borderLayer = null; return; }
  if (!borderFiles.has(snap)) borderFiles.set(snap, fetch(`${BORDERS}${snap}.geojson`).then(r => r.json()));
  const data = await borderFiles.get(snap).catch(() => (borderFiles.delete(snap), null));
  if (token !== borderToken) return; // slider moved on while this file was loading
  borderLayer?.remove();
  borderLayer = data && L.geoJSON(data, {
    filter: f => f.properties.NAME,
    style: f => ({ color: "#3b2a1a", weight: 1, opacity: .7, dashArray: "4 3", fillColor: inkFor(f.properties.NAME), fillOpacity: .16 }),
    onEachFeature: (f, layer) => layer.bindTooltip(f.properties.NAME, { sticky: true, className: "realm" }),
    attribution: 'Biên giới: <a href="https://github.com/aourednik/historical-basemaps">historical-basemaps</a> (GPL-3.0)',
  }).addTo(map);
  if (!data) document.getElementById("border-note").textContent = "Không tải được biên giới, kiểm tra mạng";
}
// Fog of war: a parchment veil over the map with soft holes around every story read.
const FOG_KM = 700;
const Fog = L.Layer.extend({
  onAdd(m) {
    this._c = L.DomUtil.create("canvas", "fog", m.getPane("fog"));
    m.on("move zoom resize viewreset", this.draw, this);
    this.draw();
  },
  onRemove(m) { m.off("move zoom resize viewreset", this.draw, this); this._c.remove(); },
  draw() {
    const m = this._map, c = this._c, size = m.getSize();
    L.DomUtil.setPosition(c, m.containerPointToLayerPoint([0, 0]));
    c.width = size.x; c.height = size.y;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(226, 207, 166, 0.82)";
    g.fillRect(0, 0, size.x, size.y);
    g.globalCompositeOperation = "destination-out";
    const lng0 = m.getCenter().lng;
    cards.filter(k => seen.has(k.id)).forEach(k => {
      const lng = k.lng + 360 * Math.round((lng0 - k.lng) / 360); // nearest world copy
      const p = m.latLngToContainerPoint([k.lat, lng]);
      const r = Math.max(30, p.y - m.latLngToContainerPoint([k.lat + FOG_KM / 111, lng]).y);
      const grad = g.createRadialGradient(p.x, p.y, r * 0.35, p.x, p.y, r);
      grad.addColorStop(0, "rgba(0,0,0,1)"); grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
    });
  },
});
let fog;

let map, pins, era = null; // era = index into SNAPS, null = mọi thời đại

// Hành trình: stops in reading order; ids must exist in cards.json (checked at load).
const JOURNEYS = [
  { name: "Đại Việt qua mười thế kỷ", note: "Từ nỏ thần Cổ Loa đến hải tặc trên Biển Đông.",
    ids: ["co-loa-no-than", "hai-ba-trung", "quoc-tu-giam", "nam-quoc-son-ha", "ly-chieu-hoang", "bach-dang-1288", "tien-giay-ho-quy-ly", "ho-guom-tra-guom", "trang-quynh", "rach-gam-xoai-mut", "dong-da-1789", "trinh-nhat-tau"] },
  { name: "Con đường tơ lụa trên biển", note: "Đồng vàng La Mã, thuyền khâu dây dừa, hạm đội Trịnh Hòa và những người lính Hoàng Sa.",
    ids: ["oc-eo-phu-nam", "tau-dam-belitung", "trinh-hoa-ha-tay-duong", "tau-dam-cu-lao-cham", "doi-hoang-sa"] },
  { name: "Đền đài phương Nam", note: "Trống đồng, tháp gạch Chăm và những ngôi đền rừng già che lấp.",
    ids: ["trong-dong-dong-son", "oc-eo-phu-nam", "borobudur-bi-lang-quen", "chu-dat-quan-angkor", "my-son-champa"] },
  { name: "Dọc sông Nile", note: "Bốn nghìn năm Ai Cập, từ cuốn nhật ký cổ nhất đến lời nguyền Tutankhamun.",
    ids: ["nhat-ky-merer", "dan-bien", "dao-quan-cambyses", "mo-alexander", "phien-da-rosetta", "cleopatra-mat-trang", "mansa-musa", "loi-nguyen-tutankhamun"] },
  { name: "Biển cả nuốt người", note: "Sóng thần, tàu đắm và con tàu không người lái.",
    ids: ["song-than-storegga", "erik-do-greenland", "trai-dat-phang", "thuoc-dia-roanoke", "tau-vasa", "trinh-nhat-tau", "tau-essex", "mary-celeste"] },
  { name: "Rome thịnh rồi suy", note: "Từ đám cháy thời Nero đến ngọn lửa Hy Lạp ở Constantinople.",
    ids: ["nero-dan", "pompeii", "vomitorium", "adrianople", "alaric-cuop-rome", "buon-lau-tam-to", "lua-hy-lap"] },
  { name: "Mưu kế chiến trường", note: "Ngựa gỗ, voi qua núi, gió đông và một xác chết mang thư giả.",
    ids: ["thanh-troy", "thermopylae", "vay-tyre", "hannibal-voi-alps", "xich-bich", "mong-co-danh-nhat", "bach-dang-1288", "isandlwana", "chien-dich-mincemeat"] },
  { name: "Những bí ẩn chưa lời giải", note: "Những nơi sử gia vẫn còn cãi nhau.",
    ids: ["otzi-nguoi-bang", "dao-quan-cambyses", "hoang-tu-trong-thap", "dich-nhay-mua-1518", "thuoc-dia-roanoke", "mary-celeste", "tunguska"] },
];
let journey = null, routeLayer;

const ROSE_SVG = `<svg viewBox="-50 -50 100 100" aria-hidden="true"><g stroke="#3b2a1a" stroke-width=".8">
  <circle r="44" fill="#efe2c4" fill-opacity=".85"/><circle r="39" fill="none" stroke-dasharray="1.5 2.5"/><circle r="30" fill="none"/>
  ${[0, 90, 180, 270].map(d => `<g transform="rotate(${d})"><path d="M0 0L-7 -7 0 -42Z" fill="#8e3b1f"/><path d="M0 0L7 -7 0 -42Z" fill="#efe2c4"/></g>`).join("")}
  ${[45, 135, 225, 315].map(d => `<g transform="rotate(${d})"><path d="M0 0L-4.5 -4.5 0 -28Z" fill="#3b2a1a"/><path d="M0 0L4.5 -4.5 0 -28Z" fill="#efe2c4"/></g>`).join("")}
  <circle r="3.5" fill="#efe2c4"/></g>
  <text y="-45" text-anchor="middle" font-family="EB Garamond, serif" font-size="13" font-weight="600" fill="#8e3b1f">N</text></svg>`;

// Old maps laid over today's coastlines. Allmaps serves georeferenced scans as ordinary XYZ tiles.
const OLD_MAPS = [
  { name: "Thế giới, Herman Moll 1719", tiles: "https://allmaps.xyz/maps/64691d7dff6e5799/{z}/{x}/{y}.png", src: "David Rumsey Map Collection" },
  { name: "Hải đồ thế giới, Bellin 1764", tiles: "https://allmaps.xyz/maps/d95dd826e315953d/{z}/{x}/{y}.png", src: "David Rumsey Map Collection" },
  { name: "Hải đồ Mercator, Arrowsmith 1808", tiles: "https://allmaps.xyz/maps/1fd2f93a84e47c11/{z}/{x}/{y}.png", src: "David Rumsey Map Collection" },
  // Corners (top-left, top-right, bottom-left) from a least-squares affine fit on 7 landmarks
  // (Hà Nội, Huế, Đà Nẵng, Gia Định, Cam Ranh, Mũi Cà Mau, Côn Đảo); residuals 5–38 km are Taberd's own 1838 errors.
  { name: "An Nam đại quốc họa đồ, Taberd 1838", image: "An Nam Dai Quoc Hoa Do by Jean Louis Taberd 1838.jpg",
    corners: [[23.5066, 102.2994], [23.3874, 112.5116], [7.4399, 101.8514]], view: [[8, 100], [24, 112]], src: "Wikimedia Commons" },
];

// An image pinned by three corners, so it can be rotated and sheared to fit (Leaflet's imageOverlay only stretches a box).
const WarpedImage = L.Layer.extend({
  initialize(url, corners, opts) { this._url = url; this._corners = corners; L.setOptions(this, opts); },
  onAdd(m) {
    const img = this._img = L.DomUtil.create("img", "leaflet-image-layer leaflet-zoom-hide warped");
    img.alt = ""; img.onload = () => this._update(); img.src = this._url;
    this.setOpacity(this.options.opacity ?? 1);
    m.getPanes().overlayPane.appendChild(img);
    m.on("zoomend viewreset", this._update, this);
  },
  onRemove(m) { this._img.remove(); m.off("zoomend viewreset", this._update, this); },
  getAttribution() { return this.options.attribution; },
  setOpacity(o) { this.options.opacity = o; if (this._img) this._img.style.opacity = o; return this; },
  _update() {
    const img = this._img, w = img.naturalWidth, h = img.naturalHeight;
    if (!w) return;
    const [p0, p1, p2] = this._corners.map(c => this._map.latLngToLayerPoint(c));
    img.style.width = `${w}px`; img.style.height = `${h}px`;
    img.style.transform = `matrix(${(p1.x - p0.x) / w}, ${(p1.y - p0.y) / w}, ${(p2.x - p0.x) / h}, ${(p2.y - p0.y) / h}, ${p0.x}, ${p0.y})`;
  },
});
let oldLayer = null;

// Pin glyphs by kind of story, drawn in a 12x12 box.
const KINDS = {
  bian: ["Bí ẩn", '<path d="M1 6Q6 0 11 6 6 12 1 6Z"/><circle cx="6" cy="6" r="1.8" fill="currentColor"/>'],
  tran: ["Chiến trận", '<path d="M2 2l8 8M10 2l-8 8M1 8l3 3M11 8l-3 3"/>'],
  bien: ["Biển cả", '<path d="M6 2.5v8M3.5 4.5h5M1.5 7.5q4.5 5.5 9 0"/><circle cx="6" cy="1.8" r="1"/>'],
  vua: ["Vua chúa", '<path d="M1.5 9.5 1 3l3 3 2-4.5L8 6l3-3-.5 6.5Z"/>'],
  khampha: ["Khám phá", '<circle cx="6" cy="6" r="4"/><path d="M6 .5v11M.5 6h11"/>'],
  doi: ["Đời thường", '<path d="M1 2.5h3.5q1.5 0 1.5 1.5v6q0-1-1.5-1H1ZM11 2.5H7.5Q6 2.5 6 4v6q0-1 1.5-1H11Z"/>'],
};
const glyph = k => `<svg viewBox="0 0 12 12" aria-hidden="true">${KINDS[k][1]}</svg>`;

// Sea creatures and ships from heraldic engravings (Fox-Davies 1904, de Bara 1581; public domain, Wikimedia Commons),
// multiplied onto the map like the rest of the decor pane, so their white fill turns into the paper. [lat, lng, file, width px, mirrored]; kept clear of OCEANS names.
const SEA_ART = [[-32, -18, "dragon", 96], [32, -165, "dolphin", 92, true], [-40, -115, "triton", 74], [-28, 62, "dolphin", 80],
  [38, -42, "ship", 70], [-12, -150, "ship", 64, true], [-42, 140, "ship", 60]];
// Ocean names lettered like an old chart: spaced italic capitals on a gentle arc, Latin name beneath.
const OCEANS = [
  [8, -150, "Thái Bình Dương", "Mare Pacificum", 300],
  [22, -45, "Đại Tây Dương", "Oceanus Occidentalis", 260],
  [-12, 78, "Ấn Độ Dương", "Mare Indicum", 240],
  [78, 10, "Bắc Băng Dương", "Oceanus Glacialis", 260],
  [-63, -40, "Nam Đại Dương", "Oceanus Australis", 260],
  [13, 114, "Biển Đông", "", 130],
];
const oceanLabel = ([, , name, latin, w0], i, _, w = Math.max(w0, name.length * 22)) => `<svg viewBox="0 0 ${w} 70" aria-hidden="true">
  <path id="arc${i}" d="M6 46 Q${w / 2} ${46 - w / 9} ${w - 6} 46" fill="none"/>
  <text><textPath href="#arc${i}" startOffset="50%" text-anchor="middle" class="ocean-name">${name}</textPath></text>
  ${latin ? `<text x="${w / 2}" y="64" text-anchor="middle" class="ocean-latin">${latin}</text>` : ""}</svg>`;
const unwrap = pts => pts.reduce((out, [lat, lng]) => { // shortcut path across the date line instead of around the world
  const prev = out.at(-1);
  out.push([lat, prev ? lng + 360 * Math.round((prev[1] - lng) / 360) : lng]);
  return out;
}, []);

const watercolor = () => L.tileLayer("https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg", {
  maxZoom: 16,
  attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
});

// Fantasy-map relief: illustrated mountains, hills, dunes and trees (Azgaar's Fantasy Map Generator, MIT, see relief/LICENSE)
// scattered over real ranges, deserts and forests by make_relief.py, drawn on canvas tiles so 12k icons stay cheap.
const RELIEF_ICONS = [["mount-1", "mount-2", "mount-3", "mount-4", "mount-5", "mount-6"], ["mountSnow-1", "mountSnow-2", "mountSnow-3"],
  ["hill-1", "hill-2", "hill-3", "hill-4"], ["dune-1"], ["conifer-1"], ["deciduous-1", "deciduous-2"], ["palm-1"]]; // order matches make_relief.py
const RELIEF_SIZE = [46, 50, 34, 30, 22, 22, 22];
const Relief = L.GridLayer.extend({
  initialize(points, imgs, opts) { this._pts = points; this._imgs = imgs; L.setOptions(this, opts); },
  createTile(c) {
    const t = document.createElement("canvas"), s = this.getTileSize(), r = window.devicePixelRatio || 1;
    t.width = s.x * r; t.height = s.y * r;
    const ctx = t.getContext("2d"), W = 256 * 2 ** c.z, ox = c.x * s.x, oy = c.y * s.y;
    ctx.scale(r, r);
    for (const [lat, lng, k] of this._pts[Math.min(c.z, 5)] || []) {
      const p = this._map.project([lat, lng], c.z), n = RELIEF_SIZE[k];
      let x = ((p.x - ox) % W + W) % W; if (x > W - 40) x -= W; // wrapped world copies
      const y = p.y - oy;
      if (x < -n || x > s.x + n || y < -4 || y > s.y + n) continue;
      const v = this._imgs[k], img = v[Math.abs(Math.round(lat * 97 + lng * 31)) % v.length];
      ctx.drawImage(img, x - n / 2, y - n * .8, n, n);
    }
    return t;
  },
});

// Coastal ripple lines, the way fantasy and old sea charts hatch the water along every shore. Each ring is drawn as a
// wide stroke with a slightly narrower one cut out of it, then the land itself is cut out so lines stay on the sea.
const RIPPLES = [[22, .14], [15, .22], [9, .32], [4, .42]]; // px from the shore (outermost first), ink opacity
const Ripples = L.GridLayer.extend({
  initialize(rings, opts) {
    this._rings = rings.map(r => {
      const b = [Infinity, Infinity, -Infinity, -Infinity];
      for (let i = 0; i < r.length; i += 2) {
        b[0] = Math.min(b[0], r[i] / 10); b[2] = Math.max(b[2], r[i] / 10);
        b[1] = Math.min(b[1], r[i + 1] / 10); b[3] = Math.max(b[3], r[i + 1] / 10);
      }
      return { r, b };
    });
    L.setOptions(this, opts);
  },
  createTile(c) {
    const t = document.createElement("canvas"), s = this.getTileSize(), q = window.devicePixelRatio || 1;
    t.width = s.x * q; t.height = s.y * q;
    const ctx = t.getContext("2d"), ox = c.x * s.x, oy = c.y * s.y, m = 24, path = new Path2D();
    const nw = this._map.unproject([ox - m, oy - m], c.z), se = this._map.unproject([ox + s.x + m, oy + s.y + m], c.z);
    let any = false;
    for (const { r, b } of this._rings) for (const k of [-360, 0, 360]) { // world copies either side
      if (b[2] + k < nw.lng || b[0] + k > se.lng || b[3] < se.lat || b[1] > nw.lat) continue;
      if (Math.max(b[2] - b[0], b[3] - b[1]) * 2 ** c.z < 4) continue; // islets would become ink bullseyes when zoomed out
      any = true;
      for (let i = 0; i < r.length; i += 2) {
        const p = this._map.project([r[i + 1] / 10, r[i] / 10 + k], c.z);
        i ? path.lineTo(p.x - ox, p.y - oy) : path.moveTo(p.x - ox, p.y - oy);
      }
      path.closePath();
    }
    if (!any) return t;
    ctx.scale(q, q); ctx.lineJoin = ctx.lineCap = "round";
    for (const [d, a] of RIPPLES) {
      ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = `rgba(38, 66, 84, ${a})`; ctx.lineWidth = 2 * d + .7; ctx.stroke(path);
      ctx.globalCompositeOperation = "destination-out"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2 * d - .7; ctx.stroke(path); // opaque, or it only half erases
    }
    ctx.fillStyle = "#000"; ctx.fill(path); // still destination-out: clear the land
    return t;
  },
});

function initMap() {
  map = L.map("map", { worldCopyJump: true, minZoom: 2, maxZoom: 14 }).setView([25, 60], 2);
  // shortcut: Stadia serves these keyless only on localhost; register the domain (free tier) before publishing.
  watercolor().addTo(map);
  Promise.all([fetch("relief.json").then(r => r.json()), ...RELIEF_ICONS.map(v => Promise.all(v.map(f => {
    const i = new Image(); i.src = `relief/${f}.svg`; return i.decode().then(() => i);
  })))]).then(([pts, ...imgs]) => new Relief(pts, imgs, { minZoom: 2, maxZoom: 7, pane: "relief", zIndex: 2 }).addTo(map))
    .catch(() => {}); // decoration only: the map works without it
  fetch("coast.json").then(r => r.json()).then(rings => new Ripples(rings, { minZoom: 2, maxZoom: 7, pane: "relief", zIndex: 1 }).addTo(map))
    .catch(() => {});
  // Antique chart furniture: a compass rose (click = back to the whole world) and a checkered league scale.
  L.control.scale({ imperial: false, maxWidth: 140, position: "topleft" }).addTo(map);
  const Rose = L.Control.extend({ onAdd() {
    const b = L.DomUtil.create("button", "rose-ctl");
    b.type = "button"; b.title = "Về toàn cảnh thế giới"; b.setAttribute("aria-label", b.title);
    b.innerHTML = ROSE_SVG;
    L.DomEvent.disableClickPropagation(b);
    b.onclick = () => map.flyTo([25, 60], 2, { duration: 1.2 });
    return b;
  } });
  new Rose({ position: "topright" }).addTo(map);
  map.createPane("fog").style.zIndex = 450; // above borders, below pins
  map.createPane("relief").style.zIndex = 455; // drawn over the fog, the way a chart's mountains sit on its paper
  map.getPane("relief").style.pointerEvents = "none";
  map.getPane("fog").style.pointerEvents = "none";
  fog = new Fog().addTo(map);
  pins = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 60,
    iconCreateFunction: cl => L.divIcon({ html: `<span>${cl.getChildCount()}</span>`, className: "cluster", iconSize: [44, 44] }),
  }).addTo(map);
  const range = document.getElementById("era-range");
  range.max = SNAPS.length - 1;
  range.value = snapOf(1279);
  // tick marks on the slider where stories exist
  document.getElementById("era-ticks").innerHTML = [...new Set(cards.map(c => snapOf(c.year)))].map(i => `<option value="${i}"></option>`).join("");
  map.createPane("decor").style.zIndex = 460; // above the fog; CSS multiplies the whole pane into the map so it reads as printed ink
  map.getPane("decor").style.pointerEvents = "none";
  // the creatures are chart decoration for the open ocean; zoomed in on a coast they would just float over the water
  const deep = () => map.getContainer().classList.toggle("deep", map.getZoom() > 5);
  map.on("zoomend", deep); deep();
  SEA_ART.forEach(([lat, lng, f, w, flip]) => L.marker([lat, lng], { pane: "decor", interactive: false, keyboard: false,
    icon: L.divIcon({ className: "sea-art", iconSize: [w, w], html: `<img src="sea/${f}.png" alt=""${flip ? ' style="transform:scaleX(-1)"' : ""}>` }) }).addTo(map));
  OCEANS.forEach((o, i) => L.marker([o[0], o[1]], {
    pane: "decor", interactive: false, keyboard: false,
    icon: L.divIcon({ className: "ocean", iconSize: [Math.max(o[4], o[2].length * 22), 70], html: oceanLabel(o, i) }),
  }).addTo(map));
  routeLayer = L.layerGroup().addTo(map);
  const om = document.getElementById("oldmap"), fade = document.getElementById("oldmap-fade");
  OLD_MAPS.forEach((m, i) => om.add(new Option(m.name, i)));
  om.onchange = () => {
    if (oldLayer) map.removeLayer(oldLayer);
    const m = OLD_MAPS[om.value];
    fade.hidden = !m;
    oldLayer = m && (m.tiles
      ? L.tileLayer(m.tiles, { maxNativeZoom: 9, attribution: `Bản đồ cổ: <a href="https://allmaps.org">Allmaps</a>, ${m.src}` })
      : new WarpedImage(commons(m.image, 2000), m.corners, { attribution: `Bản đồ cổ: ${m.src}` }));
    if (!oldLayer) return;
    oldLayer.setOpacity(fade.value / 100).addTo(map);
    if (m.view) map.flyToBounds(m.view, { duration: 1.2 });
  };
  fade.oninput = () => oldLayer?.setOpacity(fade.value / 100);
  // Legend box in the corner of the chart, like the key on an old map; folded on phones so it doesn't cover the sea.
  const Legend = L.Control.extend({ onAdd() {
    const d = L.DomUtil.create("details", "map-legend");
    d.open = !matchMedia("(max-width: 560px)").matches;
    d.innerHTML = `<summary>Chú giải</summary><div class="legend">${
      Object.keys(KINDS).map(k => `<span><i class="seal">${glyph(k)}</i>${KINDS[k][0]}</span>`).join("")}${
      [["mount-2", "Núi"], ["mountSnow-1", "Núi tuyết"], ["hill-1", "Cao nguyên"], ["dune-1", "Sa mạc"], ["conifer-1", "Rừng thông"], ["palm-1", "Rừng nhiệt đới"]]
        .map(([f, t]) => `<span><img src="relief/${f}.svg" alt="" width="26" height="26">${t}</span>`).join("")}</div>`;
    L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
    return d;
  } });
  new Legend({ position: "bottomright" }).addTo(map);
  const pick = document.getElementById("journey");
  const byId = new Map(cards.map(c => [c.id, c]));
  JOURNEYS.forEach((j, i) => { j.stops = j.ids.map(id => byId.get(id)).filter(Boolean); pick.add(new Option(`${j.name} (${j.stops.length} chặng)`, i)); });
  console.assert(JOURNEYS.every(j => j.stops.length === j.ids.length), "journey id missing from cards.json");
  pick.onchange = () => {
    journey = pick.value === "" ? null : JOURNEYS[pick.value];
    if (journey) { era = null; map.flyToBounds(L.latLngBounds(unwrap(journey.stops.map(c => [c.lat, c.lng]))), { padding: [40, 40], duration: 1.2 }); }
    drawPins();
  };
  range.oninput = () => { era = +range.value; journey = null; pick.value = ""; drawPins(); };
  document.getElementById("era-all").onclick = () => { era = null; journey = null; pick.value = ""; drawPins(); };
  drawPins();
}

function drawPins() {
  const shown = journey ? journey.stops : cards.filter(c => era === null || snapOf(c.year) === era);
  pins.clearLayers(); routeLayer.clearLayers();
  const path = journey && unwrap(shown.map(c => [c.lat, c.lng]));
  if (journey) {
    L.polyline(path, { color: "#3b2414", weight: 6, opacity: .15, interactive: false }).addTo(routeLayer); // ink bleed
    L.polyline(path, { color: "#6e2a12", weight: 2.5, dashArray: "2 9", lineCap: "round", className: "route", interactive: false }).addTo(routeLayer);
  }
  document.getElementById("journey-note").innerHTML = journey ? `${esc(journey.note)} <a href="#/hanh-trinh/${JOURNEYS.indexOf(journey)}">Đọc trọn hành trình →</a>` : "";
  shown.forEach((c, i) => (journey ? routeLayer : pins).addLayer(
    L.marker(journey ? path[i] : [c.lat, c.lng], {
      title: c.title, alt: c.title,
      icon: L.divIcon({ className: `seal ${c.verdict}${seen.has(c.id) ? " seen" : ""}${journey ? " stop" : ""}`, iconSize: [26, 26], html: journey ? `${i + 1}` : glyph(c.kind) }),
    }).bindPopup(`<div class="meta">${KINDS[c.kind][0]} · ${yearText(c.year)} · ${esc(c.place)}</div>
      <h3>${esc(c.title)}</h3><p>${esc(c.teaser)}</p>
      <a href="#/c/${esc(c.id)}">Đọc trang này →</a>`)
  ));
  const name = journey ? `Hành trình: ${journey.name}` : era === null ? "Mọi thời đại" : `${snapLabel(era)} → ${era + 1 < SNAPS.length ? snapLabel(era + 1).slice(4) : "nay"}`;
  document.getElementById("era-vn").textContent = journey || era === null ? "" : `Ở Việt Nam: ${vnSpan(era)}`;
  document.getElementById("era-name").textContent = name;
  document.getElementById("era-range").setAttribute("aria-valuetext", name);
  document.getElementById("era-all").setAttribute("aria-pressed", era === null);
  document.getElementById("era-count").textContent = `· ${shown.length} câu chuyện, đã khám phá ${shown.filter(c => seen.has(c.id)).length}`;
  drawBorders();
}

function showMap() {
  mapView.hidden = false; app.hidden = true;
  if (map) { map.invalidateSize(); drawPins(); fog.draw(); } else initMap();
  // first map view of the session: the chart unrolls from the middle and the ink soaks in
  try {
    if (!sessionStorage.getItem("nhatky-mo-ban-do") && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem("nhatky-mo-ban-do", "1");
      mapView.classList.add("unroll");
      setTimeout(() => mapView.classList.remove("unroll"), 2600);
    }
  } catch { /* storage blocked: skip the flourish */ }
}

function goRandom() {
  const current = location.hash.split("/c/")[1];
  const pool = cards.filter(c => c.id !== current);
  location.hash = `#/c/${pool[Math.floor(Math.random() * pool.length)].id}`;
}

const mapView = document.getElementById("map-view");
let lastView = "#/";

// --- timeline: every story on one long scroll, in date order, with the gaps between them marked ---
function renderTimeline() {
  const list = [...cards].sort((x, y) => x.year - y.year);
  const gap = (a, b) => b.year - a.year;
  app.innerHTML = `<section class="timeline">
    <h1>Dòng thời gian</h1>
    <p class="meta">${list.length} câu chuyện xếp theo năm, từ ${yearText(list[0].year)} đến ${yearText(list.at(-1).year)}. Kéo ngang, lăn chuột hoặc dùng phím mũi tên.</p>
    <div class="tl-scroll" tabindex="0" aria-label="Dòng thời gian, kéo ngang để xem">
      <ol class="tl-track">${list.map((c, i) => `${i && gap(list[i - 1], c) >= 500 ? `<li class="tl-gap" aria-hidden="true"><span>≈ ${gap(list[i - 1], c).toLocaleString("vi")} năm</span></li>` : ""}
        <li class="tl-item ${c.verdict}${seen.has(c.id) ? " seen" : ""}">
          <span class="tl-year">${yearText(c.year).replace("năm ", "")}</span>
          <span class="tl-dot seal ${c.verdict}">${glyph(c.kind)}</span>
          <a class="tl-card" href="#/c/${esc(c.id)}"><span class="meta">${esc(c.place)}</span><strong>${esc(c.title)}</strong><small>Việt Nam: ${vnEra(c.year)}</small></a>
        </li>`).join("")}</ol>
    </div>
  </section>`;
  const sc = app.querySelector(".tl-scroll");
  // a vertical wheel scrolls the timeline sideways; trackpads that already scroll sideways are left alone
  sc.addEventListener("wheel", e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { sc.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
}

// --- journey told by scrolling: a sticky map flies to each stop as its card reaches mid-screen ---
let trekMap = null;
function renderJourney(i) {
  const j = JOURNEYS[i], stops = j.ids.map(id => cards.find(c => c.id === id)).filter(Boolean);
  app.innerHTML = `<section class="trek">
    <a class="back" href="#/">← Về bản đồ</a>
    <h1>${esc(j.name)}</h1><p class="lead">${esc(j.note)} Kéo xuống để đi qua ${stops.length} chặng.</p>
    <div id="trek-map" class="trek-map" role="img" aria-label="Bản đồ hành trình ${esc(j.name)}"></div>
    <ol class="trek-steps">${stops.map((c, k) => `<li class="trek-step" data-k="${k}">
      <span class="trek-no">${k + 1}</span>
      <div class="meta">${KINDS[c.kind][0]} · ${yearText(c.year)} · ${esc(c.place)}</div>
      <h2><a href="#/c/${esc(c.id)}">${esc(c.title)}</a></h2>
      <p>${esc(c.teaser)}</p>
      <a class="trek-go" href="#/c/${esc(c.id)}">${seen.has(c.id) ? "Đã đọc, đọc lại" : "Đọc trọn trang"} →</a></li>`).join("")}</ol>
    <p class="trek-end">Hết hành trình. <a href="#/ho-chieu">Xem huy hiệu trong hộ chiếu →</a></p>
  </section>`;
  const path = unwrap(stops.map(c => [c.lat, c.lng]));
  trekMap = L.map("trek-map", { zoomControl: false, scrollWheelZoom: false, worldCopyJump: true }).fitBounds(path, { padding: [30, 30] });
  watercolor().addTo(trekMap);
  L.polyline(path, { color: "#3b2414", weight: 6, opacity: .15 }).addTo(trekMap);
  L.polyline(path, { color: "#6e2a12", weight: 2.5, dashArray: "2 9", lineCap: "round", className: "route" }).addTo(trekMap);
  const marks = stops.map((c, k) => L.marker(path[k], { keyboard: false,
    icon: L.divIcon({ className: `seal ${c.verdict} stop`, iconSize: [26, 26], html: `${k + 1}` }) }).addTo(trekMap));
  const steps = [...app.querySelectorAll(".trek-step")];
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const k = +e.target.dataset.k;
    steps.forEach(s => s.classList.toggle("on", s === e.target));
    marks.forEach((m, n) => m.getElement()?.classList.toggle("here", n === k));
    trekMap.flyTo(path[k], Math.max(trekMap.getZoom(), 5), { duration: 1.4 });
  }), { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach(s => io.observe(s));
  trekMap.on("unload", () => io.disconnect());
}

function route() {
  if (trekMap) { trekMap.remove(); trekMap = null; }
  if (locMap) { locMap.remove(); locMap = null; }
  reading = null; progress.hidden = true; progress.style.transform = "scaleX(0)";
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  const id = decodeURIComponent(location.hash.split("/c/")[1] || "");
  const card = cards.find(c => c.id === id);
  const trek = location.hash.match(/^#\/hanh-trinh\/(\d+)$/), ji = trek && +trek[1];
  const view = card ? "story" : trek && JOURNEYS[ji] ? "journey" : location.hash === "#/dong-thoi-gian" ? "timeline" : location.hash === "#/nhat-ky" ? "feed" : location.hash === "#/ho-chieu" ? "passport" : "map";
  document.querySelectorAll(".tabs a").forEach(a => a.toggleAttribute("aria-current", a.dataset.view === view));
  if (view === "map") { lastView = "#/"; document.title = "Nhật Ký Thám Hiểm"; return showMap(); }
  mapView.hidden = true; app.hidden = false;
  if (card) { renderStory(card); document.title = `${card.title} · Nhật Ký Thám Hiểm`; window.scrollTo(0, 0); }
  else if (view === "timeline") { lastView = "#/dong-thoi-gian"; renderTimeline(); document.title = "Dòng thời gian · Nhật Ký Thám Hiểm"; }
  else if (view === "journey") { lastView = location.hash; renderJourney(ji); document.title = `${JOURNEYS[ji].name} · Nhật Ký Thám Hiểm`; window.scrollTo(0, 0); }
  else if (view === "passport") { lastView = "#/ho-chieu"; renderPassport(); document.title = "Hộ chiếu · Nhật Ký Thám Hiểm"; }
  else { lastView = "#/nhat-ky"; renderFeed(); document.title = "Nhật ký · Nhật Ký Thám Hiểm"; }
  app.focus({ preventScroll: true });
}

document.getElementById("random").onclick = goRandom;

// Reader-chosen text size; everything is sized in rem so scaling the root scales the page.
const SIZE_KEY = "nhatky-co-chu", SIZES = [87.5, 100, 112.5, 125, 140];
let sizeIx = (() => { try { const i = SIZES.indexOf(Number(localStorage.getItem(SIZE_KEY))); return i < 0 ? 1 : i; } catch { return 1; } })();
const applySize = () => { document.documentElement.style.fontSize = `${SIZES[sizeIx]}%`; map?.invalidateSize(); };
document.querySelectorAll(".fontsize button").forEach(b => b.onclick = () => {
  sizeIx = Math.min(SIZES.length - 1, Math.max(0, sizeIx + Number(b.dataset.step)));
  applySize();
  try { localStorage.setItem(SIZE_KEY, SIZES[sizeIx]); } catch {}
});
const soundBtn = document.getElementById("sound-toggle");
const showSound = () => { soundBtn.setAttribute("aria-pressed", soundOn); soundBtn.title = soundOn ? "Tắt âm thanh" : "Bật âm thanh"; soundBtn.setAttribute("aria-label", soundBtn.title); };
soundBtn.onclick = () => { soundOn = !soundOn; try { localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0"); } catch {} showSound(); sfx("page"); };
showSound();
// Candlelight (dark) mode: chosen once here, applied early by the inline script in index.html.
const THEME_KEY = "nhatky-giao-dien", themeBtn = document.getElementById("theme-toggle");
const showTheme = () => { const dark = document.documentElement.dataset.theme === "dark"; themeBtn.setAttribute("aria-pressed", dark); themeBtn.title = dark ? "Đọc trên giấy sáng" : "Đọc dưới ánh nến"; themeBtn.setAttribute("aria-label", themeBtn.title); };
themeBtn.onclick = () => { const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = t; try { localStorage.setItem(THEME_KEY, t); } catch {} showTheme(); };
showTheme();
applySize();
window.addEventListener("hashchange", route);

fetch("glossary.json").then(r => (r.ok ? r.json() : {})).then(g => { GLOSS = g; }).catch(() => {}) // optional: stories work without notes
  .then(() => fetch("cards.json"))
  .then(r => r.json())
  .then(data => {
    // shuffle once per visit so the journal opens on a different page each time
    cards = data.map(c => [Math.random(), c]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    route();
  })
  .catch(() => { app.innerHTML = `<p class="loading">Không mở được nhật ký. Hãy chạy qua một web server (xem README).</p>`; });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
