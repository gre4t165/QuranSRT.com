# Membuat ikon PWA & gambar Open Graph (og.png) dari HTML memakai Chromium (Playwright).
# Jalankan: python3 scripts/make-images.py
import pathlib, json
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
nm = root / 'node_modules'
amiri = (nm / '@fontsource/amiri-quran/files/amiri-quran-arabic-400-normal.woff2').as_uri()
jak = (nm / '@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2').as_uri()
svg = (root / 'public/favicon.svg').read_text()
basm = json.loads((root / 'public/data/quran/1.json').read_text())['verses'][0]['ar']

fonts = f"""
@font-face {{ font-family: 'AQ'; src: url('{amiri}') format('woff2'); }}
@font-face {{ font-family: 'PJ'; src: url('{jak}') format('woff2'); font-weight: 200 800; }}
* {{ margin:0; box-sizing:border-box; }}
"""

og = f"""<!doctype html><html><head><meta charset="utf-8"><style>{fonts}
body {{ width:1200px; height:630px; background: radial-gradient(120% 100% at 70% 40%, #12493f 0%, #06201b 70%); color:#f3efe0; font-family: PJ; position:relative; overflow:hidden; }}
.frame {{ position:absolute; inset:28px; border:2px solid rgba(215,180,98,.45); border-radius:22px; }}
.frame2 {{ position:absolute; inset:40px; border:1px solid rgba(215,180,98,.2); border-radius:16px; }}
.wrap {{ position:absolute; left:84px; top:84px; right:84px; bottom:84px; display:flex; flex-direction:column; }}
.brand {{ display:flex; align-items:center; gap:16px; font-weight:750; font-size:30px; letter-spacing:-.02em; }}
.brand svg {{ width:58px; height:58px; }}
.brand b {{ color:#d7b462; font-weight:750; }}
h1 {{ font-size:66px; line-height:1.05; letter-spacing:-.035em; font-weight:760; margin-top:46px; max-width:760px; }}
.ar {{ font-family: AQ; direction: rtl; font-size:58px; color:#d7b462; position:absolute; right:0; bottom:58px; }}
.srt {{ position:absolute; left:0; bottom:0; font-size:22px; color:rgba(243,239,224,.75); font-variant-numeric: tabular-nums; background:rgba(0,0,0,.28); padding:12px 18px; border-radius:10px; }}
.srt span {{ color:#d7b462; font-weight:700; margin-right:14px; }}
</style></head><body><div class="frame"></div><div class="frame2"></div>
<div class="wrap"><div class="brand">{svg}<div>Quran <b>SRT</b> Studio</div></div>
<h1>Subtitle Al-Qur’an yang pas dengan bacaan qari.</h1>
<div class="ar">{basm}</div>
<div class="srt"><span>1</span>00:00:00,000 --&gt; 00:00:04,320</div></div></body></html>"""

icon = lambda size: f"""<!doctype html><html><head><style>{fonts} body {{ width:{size}px; height:{size}px; background:#f3efe0; display:grid; place-items:center; }} svg {{ width:{int(size*1.05)}px; height:{int(size*1.05)}px; }}</style></head><body>{svg}</body></html>"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1200, 'height': 630})
    tmp = root / 'scripts' / '_tmp.html'
    tmp.write_text(og)
    pg.goto(tmp.as_uri())
    pg.wait_for_timeout(600)
    pg.screenshot(path=str(root / 'public/og.png'))
    for s in (192, 512):
        pg = b.new_page(viewport={'width': s, 'height': s})
        tmp.write_text(icon(s))
        pg.goto(tmp.as_uri())
        pg.wait_for_timeout(150)
        pg.screenshot(path=str(root / f'public/icon-{s}.png'))
    b.close()
    tmp.unlink()
print('ok')
