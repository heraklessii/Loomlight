# Loomlight — itch.io page (draft 1)

Everything to type or upload on itch.io, field by field. See it put together: `npm run marketing:preview` → http://localhost:5320/preview.html. Images are in
`marketing/itch/out/` (re-render: `npm run marketing:render`), the demo sprite
in `marketing/itch/demo/`. **Nothing is published yet** — the page is set up
by the user (or with Claude in the browser, on the user's go-ahead).

## 1. Basics (Edit game → main form)

| Field | Value |
|---|---|
| Title | `Loomlight` |
| Project URL | `<your-username>.itch.io/loomlight` |
| Short description / tagline | `A free, open-source pixel art editor and sprite animator — pixel-exact, offline, English & Turkish.` |
| Classification | **Tool** |
| Kind of project | **Downloadable** |
| Release status | **In development** (v0.1) |
| Pricing | **$0 or donate** — free download, optional support (user, 2026-10-23). Suggested donation: $5. Needs a payout method in itch's Seller settings |
| Uploads | `Loomlight-Setup-0.1.0.exe` → tag **Windows** · `Loomlight-0.1.0-x64.zip` → tag **Windows** (portable). macOS / Linux later (CI builds) |
| Cover image | `out/cover-630x500.png` |
| Screenshots | `demo/lantern.gif` + `out/screens/01-editor.png`, `03-indexed-shading.png`, `04-tiled.png`, `02-export.png`, `05-light.png` (1280×800, real app) |
| Tags (max 10) | `pixel-art`, `sprites`, `animation`, `aseprite`, `gif`, `tileset`, `open-source`, `free`, `2d`, `editor` |
| Community | Comments: on |
| Visibility | **Draft** until the user approves |

## 2. Theme (Edit theme)

| Field | Value | Note |
|---|---|---|
| Background color | `#0e0e0e` | app surface `--bg-0` |
| Background image | `out/background-tile-96x96.png`, repeat, *fixed* | optional, barely visible weave |
| Page (BG2) color | `#161616`, opacity 100 % | app canvas background |
| Text color | `#ededed` | |
| Link color | `#ffb547` | the amber accent |
| Button color | `#ffb547` | itch picks dark button text for light buttons |
| Header color | `#ffffff` | |
| Header font | **Pixelify Sans** (Google Fonts) | the app's display face |
| Body font | **Plus Jakarta Sans** (Google Fonts) | the app's UI face |
| Banner / header image | `out/banner-960x300.png` | page column is 960 px wide |
| Screenshots column | on (right side) | |

## 3. Description — English

**Loomlight** is a free, open-source pixel art editor and sprite animation tool. Draw pixel by pixel, work in layers, animate across frames and export PNG, sprite sheets or GIFs — exactly the pixels you drew.

**Draw**
- Pencil, eraser, bucket, line, rectangle, ellipse — brush sizes, pixel-perfect strokes, mirror symmetry
- Shading ink (shifts colours along your palette) and dithering patterns
- Selections (rectangle, lasso, magic wand): move, scale, rotate, flip, copy & paste — also with other apps

**Animate**
- Layers and frames in one timeline, onion skin, live preview
- Frame tags ("walk", "idle") with forward, reverse and ping-pong playback

**Colour**
- HSV picker, built-in palettes (Endesga 32, PICO-8, Sweetie 16, DawnBringer 16)
- Indexed colour mode with live palette swaps
- Import / export palettes: GIMP `.gpl`, Lospec `.hex`, JASC `.pal`, PNG

**Make games**
- Export PNG, sprite sheets (+ JSON with Aseprite-style frame tags) and GIF, at integer scales
- Tiled mode for seamless tiles, reference image layers for tracing
- Opens `.aseprite` / `.ase` files

**Feels familiar**
- Aseprite-style shortcuts (B, E, G, I…, `Alt+N`, `Enter`) — every one customisable
- `Ctrl+K` command palette, dark & light themes, a short first-run tour

**Free and open**
- GPL-3.0, no account, no cloud, no telemetry — works fully offline
- Interface in English and Turkish
- Crash recovery: an autosaved copy is offered if the app ever closes unexpectedly

**Install (Windows 10/11, 64-bit):** run `Loomlight-Setup-0.1.0.exe`, or unzip the portable build and start `Loomlight.exe`. The build is not code-signed yet, so Windows SmartScreen may show "Windows protected your PC" → *More info* → *Run anyway*.

*Fonts: Plus Jakarta Sans, Pixelify Sans, JetBrains Mono (SIL OFL). Palettes by ENDESGA, Lexaloffle, GrafxKid and DawnBringer.*

## 4. Açıklama — Türkçe

**Loomlight**, ücretsiz ve açık kaynak kodlu bir piksel sanatı düzenleyicisi ve sprite animasyon aracı. Piksel piksel çiz, katmanlarla çalış, kareler boyunca canlandır; PNG, sprite sayfası ya da GIF olarak dışa aktar — çizdiğin pikseller birebir.

**Çiz**
- Kalem, silgi, kova, çizgi, dikdörtgen, elips — fırça boyutları, piksel-mükemmel çizgiler, ayna simetrisi
- Gölgeleme mürekkebi (renkleri palet boyunca kaydırır) ve dither desenleri
- Seçimler (dikdörtgen, kement, sihirli değnek): taşı, ölçekle, döndür, çevir, kopyala-yapıştır — başka uygulamalarla da

**Canlandır**
- Katmanlar ve kareler tek zaman çizelgesinde, soğan kabuğu, canlı önizleme
- Kare etiketleri ("yürü", "bekle"): ileri, geri ve git-gel oynatma

**Renk**
- HSV renk seçici, hazır paletler (Endesga 32, PICO-8, Sweetie 16, DawnBringer 16)
- Canlı palet değişimli indeksli renk modu
- Palet içe/dışa aktarma: GIMP `.gpl`, Lospec `.hex`, JASC `.pal`, PNG

**Oyun yap**
- PNG, sprite sayfası (+ Aseprite tarzı etiketli JSON) ve GIF dışa aktarma, tam sayı ölçeklerle
- Kesintisiz döşemeler için döşeme modu, üzerinden çizmek için referans görsel katmanları
- `.aseprite` / `.ase` dosyalarını açar

**Tanıdık gelir**
- Aseprite tarzı kısayollar (B, E, G, I…, `Alt+N`, `Enter`) — hepsi değiştirilebilir
- `Ctrl+K` komut paleti, koyu ve açık tema, kısa bir ilk açılış turu

**Ücretsiz ve açık**
- GPL-3.0; hesap yok, bulut yok, telemetri yok — tamamen çevrimdışı çalışır
- Arayüz İngilizce ve Türkçe
- Çökme kurtarma: program beklenmedik kapanırsa otomatik kaydedilen kopya sunulur

**Kurulum (Windows 10/11, 64 bit):** `Loomlight-Setup-0.1.0.exe` dosyasını çalıştır ya da taşınabilir zip'i açıp `Loomlight.exe`'yi başlat. Paket henüz imzalı değil; Windows SmartScreen "Windows bilgisayarınızı korudu" derse *Ek bilgi* → *Yine de çalıştır*.

## 5. Still to do

- The itch.io account / project URL.
- Optional 2× (retina) versions of cover and banner.
