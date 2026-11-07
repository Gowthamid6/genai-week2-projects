"use strict";
const $ = id => document.getElementById(id);
let current = null;
 
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 1300); }
function copy(text, label) {
  const done = () => toast("Copied " + label);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallback());
  else fallback();
  function fallback() { const a = document.createElement("textarea"); a.value = text; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove(); done(); }
}
function textOn(hex) { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? "#111" : "#fff"; }
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
 
/* The export: CSS variables plus a few starter rules so a pasted kit visibly restyles a plain page. */
function kitCSS(d, name) {
  const L = [];
  L.push("/* Style Spy kit: " + (name || d.host).replace(/\*\//g, "") + " */", ":root {");
  if (d.bg) L.push("  --color-bg: " + d.bg + ";");
  if (d.text) L.push("  --color-text: " + d.text + ";");
  if (d.accent) L.push("  --color-accent: " + d.accent + ";");
  d.colors.forEach((c, i) => L.push("  --color-" + (i + 1) + ": " + c.hex + ";"));
  if (d.heading) L.push("  --font-heading: " + d.heading.stack + ";", "  --heading-weight: " + d.heading.weight + ";");
  if (d.body) L.push("  --font-body: " + d.body.stack + ";", "  --body-weight: " + d.body.weight + ";");
  L.push("}", "", "body { background: var(--color-bg, #fff); color: var(--color-text, #111); font-family: var(--font-body, sans-serif); font-weight: var(--body-weight, 400); }",
    "h1, h2, h3 { font-family: var(--font-heading, inherit); font-weight: var(--heading-weight, 700); }",
    "a, button { color: var(--color-accent, inherit); }");
  return L.join("\n");
}
function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/css" }));
  a.download = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".css";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
 
function showResult(d) {
  current = d;
  $("host").textContent = d.host;
  $("msg").hidden = true; $("res").hidden = false;
  const cols = $("cols"); cols.textContent = "";
  d.colors.forEach(c => {
    const b = el("button", "sw"); b.style.background = c.hex; b.style.color = textOn(c.hex);
    b.appendChild(el("b", null, c.hex)); b.appendChild(el("span", null, c.pct + "%"));
    b.title = "Click to copy " + c.hex; b.onclick = () => copy(c.hex, c.hex); cols.appendChild(b);
  });
  const fl = $("fonts"); fl.textContent = "";
  if (!d.fonts.length) fl.appendChild(el("p", "empty", "No visible text found."));
  d.fonts.forEach(f => {
    const b = el("button", "f"); b.appendChild(el("b", null, f.family + " · " + f.weight));
    b.appendChild(el("span", null, "sizes " + f.sizes.join(", ") + " px · " + f.pct + "% of text"));
    b.onclick = () => copy("font-family: " + f.stack + ";\nfont-weight: " + f.weight + ";\nfont-size: " + (f.sizes[0] || 16) + "px;", f.family);
    fl.appendChild(b);
  });
  $("css").textContent = kitCSS(d, $("kname").value.trim());
  if (!$("kname").value) $("kname").value = d.host;
}
 
async function scan() {
  $("msg").hidden = false; $("msg").textContent = "Scanning this page…"; $("res").hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: analyzePage });
    if (!r || !r.result) throw new Error("empty");
    showResult(r.result);
  } catch (e) {
    $("msg").textContent = "Style Spy can't read this page. Chrome blocks pages like chrome:// and the Web Store. Open a normal website and click the icon again. For local files, turn on \"Allow access to file URLs\" for this extension.";
  }
}
 
/* saved kits */
const getKits = () => new Promise(r => chrome.storage.local.get({ kits: [] }, v => r(v.kits)));
const setKits = k => new Promise(r => chrome.storage.local.set({ kits: k }, r));
async function renderKits() {
  const box = $("kits"), kits = await getKits(); box.textContent = "";
  if (!kits.length) { box.appendChild(el("p", "empty", "No saved kits yet.")); return; }
  kits.forEach(k => {
    const w = el("div", "kit"), t = el("div", "t"); t.appendChild(el("span", null, k.name)); t.appendChild(el("small", null, k.data.host)); w.appendChild(t);
    const mini = el("div", "mini");
    k.data.colors.slice(0, 8).forEach(c => { const i = el("i"); i.style.background = c.hex; i.title = c.hex; i.onclick = () => copy(c.hex, c.hex); mini.appendChild(i); });
    w.appendChild(mini);
    if (k.data.heading || k.data.body) w.appendChild(el("div", "empty", [k.data.heading && "Heading: " + k.data.heading.family + " " + k.data.heading.weight, k.data.body && "Body: " + k.data.body.family + " " + k.data.body.weight].filter(Boolean).join(" · ")));
    const row = el("div", "row"), c = el("button", null, "Copy CSS"), d = el("button", "alt", "Download"), x = el("button", "del", "Delete");
    c.onclick = () => copy(kitCSS(k.data, k.name), "CSS"); d.onclick = () => download(k.name, kitCSS(k.data, k.name));
    x.onclick = async () => { await setKits((await getKits()).filter(z => z.id !== k.id)); renderKits(); };
    row.append(c, d, x); w.appendChild(row); box.appendChild(w);
  });
}
$("save").onclick = async () => {
  const name = $("kname").value.trim();
  if (!current) return;
  if (!name) { toast("Type a kit name first"); $("kname").focus(); return; }
  const kits = (await getKits()).filter(k => k.name.toLowerCase() !== name.toLowerCase());
  kits.unshift({ id: Date.now(), name, data: current }); await setKits(kits); renderKits(); toast("Saved kit " + name);
};
$("kname").addEventListener("input", () => { if (current) $("css").textContent = kitCSS(current, $("kname").value.trim()); });
$("copycss").onclick = () => current && copy(kitCSS(current, $("kname").value.trim()), "CSS");
$("dlcss").onclick = () => current && download($("kname").value.trim() || current.host, kitCSS(current, $("kname").value.trim()));
$("rescan").onclick = scan;
renderKits(); scan();
 

Claude finished the response
