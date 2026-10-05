#!/usr/bin/env python3
"""
Rhymvex brand asset generator.

Reads canonical design tokens from brand/tokens/tokens.json and the master logo
raster from docs/icon logo.png, then writes every platform asset under brand/.

Run:  python3 scripts/build_assets.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "brand"
DOCS = ROOT / "docs"
FONTS = BRAND / "type" / "fonts"

MASTER_LOGO = DOCS / "icon logo.png"

TOKENS = json.loads((BRAND / "tokens" / "tokens.json").read_text())
C = {k: v["value"] for k, v in TOKENS["color"].items()}
BLACK, SLATE, WHITE, VOLT, EMBER = (
    C["black"], C["slate"], C["white"], C["volt"], C["ember"],
)

FONT_REG = str(FONTS / "Inter.ttf")
FONT_DISP = str(FONTS / "SpaceGrotesk.ttf")

LOGO_DIR = BRAND / "logo"
PROFILE_DIR = BRAND / "profiles"
BANNER_DIR = BRAND / "banners"
TEMPLATE_DIR = BRAND / "templates"
for d in (LOGO_DIR, PROFILE_DIR, BANNER_DIR, TEMPLATE_DIR):
    d.mkdir(parents=True, exist_ok=True)


def hex2rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


BLACK_RGB = hex2rgb(BLACK)
SLATE_RGB = hex2rgb(SLATE)
WHITE_RGB = hex2rgb(WHITE)
VOLT_RGB = hex2rgb(VOLT)
EMBER_RGB = hex2rgb(EMBER)

LUMA = (0.299, 0.587, 0.114)


def luma(px) -> float:
    return sum(w * c for w, c in zip(LUMA, px))


# --------------------------------------------------------------------------
# Fonts
# --------------------------------------------------------------------------

def font(path: str, size: int, weight: str = "Bold") -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(path, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def text_w(draw: ImageDraw.ImageDraw, s: str, f: ImageFont.FreeTypeFont) -> int:
    return int(draw.textbbox((0, 0), s, font=f)[2])


# --------------------------------------------------------------------------
# Master logo -> transparent mark
# --------------------------------------------------------------------------

def extract_mark() -> Image.Image:
    """
    The master PNG is the Rv mark on a near-black background. Key out the
    background with a proportional alpha ramp so edges stay antialiased, then
    crop to the artwork and re-pad on a transparent margin.
    """
    src = Image.open(MASTER_LOGO).convert("RGB")

    lo, hi = 25.0, 170.0  # background luma -> full-alpha luma
    out = Image.new("RGBA", src.size)
    src_px = src.load()
    out_px = out.load()
    for y in range(src.height):
        for x in range(src.width):
            px = src_px[x, y]
            a = int(max(0.0, min(1.0, (luma(px) - lo) / (hi - lo))) * 255)
            out_px[x, y] = (*px, a)

    bbox = out.getbbox()
    if bbox is None:
        raise SystemExit("No logo artwork found in master PNG")

    mark = out.crop(bbox)

    # Re-pad to 8% margin so the mark never touches an export edge.
    pad = int(max(mark.size) * 0.08)
    canvas = Image.new("RGBA", (mark.width + pad * 2, mark.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(mark, (pad, pad), mark)
    return canvas


def recolor(mark: Image.Image, rgb: tuple[int, ...]) -> Image.Image:
    """Flatten the mark to a single colour, preserving its alpha silhouette."""
    out = Image.new("RGBA", mark.size, (*rgb[:3], 0))
    out.putalpha(mark.getchannel("A"))
    return out


def wordmark(mark: Image.Image, text_color=WHITE_RGB, accent=VOLT_RGB,
             bg=(0, 0, 0, 0), height: int = 240) -> Image.Image:
    """
    Horizontal wordmark: Rv mark + 'Rhymvex', with the 'v' in Volt to match
    the brand kit. Stand-in until the designer supplies a vector wordmark
    (see docs/phases/phase-1-foundation.md -> open issues).
    """
    cap = int(height * 0.62)
    mh = cap
    mw = int(mark.width * mh / mark.height)
    m = mark.resize((mw, mh), Image.LANCZOS)

    f = font(FONT_DISP, cap, "Bold")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    gap = int(cap * 0.30)

    pre, post = "Rhym", "ex"          # 'v' is the accent letter
    w_pre = text_w(probe, pre, f)
    w_v = text_w(probe, "v", f)
    w_post = text_w(probe, post, f)
    total = mw + gap + w_pre + w_v + w_post

    pad = int(height * 0.12)
    canvas = Image.new("RGBA", (total + pad * 2, height + pad * 2), bg)
    d = ImageDraw.Draw(canvas)

    # Baseline-align the mark optically with the text.
    ascent, _ = f.getmetrics()
    text_y = pad + (height - ascent) // 2
    mark_y = pad + (height - mh) // 2

    canvas.alpha_composite(m, (pad, mark_y))

    x = pad + mw + gap
    d.text((x, text_y), pre, font=f, fill=(*text_color, 255))
    x += w_pre
    d.text((x, text_y), "v", font=f, fill=(*accent, 255))
    x += w_v
    d.text((x, text_y), post, font=f, fill=(*text_color, 255))
    return canvas


def paste_scaled(base: Image.Image, img: Image.Image, box, contain=True):
    """Paste img into box=(x0,y0,x1,y1) preserving aspect ratio, centred."""
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    scale = min(bw / img.width, bh / img.height) if contain else max(bw / img.width, bh / img.height)
    size = (max(1, int(img.width * scale)), max(1, int(img.height * scale)))
    r = img.resize(size, Image.LANCZOS)
    base.alpha_composite(
        r, (x0 + (bw - size[0]) // 2, y0 + (bh - size[1]) // 2)
    )


def save(img: Image.Image, path: Path, flatten=None) -> None:
    if flatten is not None:
        bg = Image.new("RGBA", img.size, (*flatten, 255))
        bg.alpha_composite(img)
        img = bg.convert("RGB")
    img.save(path, optimize=True)
    print(f"  {path.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}")


# --------------------------------------------------------------------------
# Backgrounds
# --------------------------------------------------------------------------

def grid_overlay(w: int, h: int, step: int = 64, opacity: int = 16) -> Image.Image:
    """Subtle Volt grid texture, matching the site's .rv-grid treatment."""
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x in range(0, w, step):
        d.line([(x, 0), (x, h)], fill=(*VOLT_RGB, opacity), width=1)
    for y in range(0, h, step):
        d.line([(0, y), (w, y)], fill=(*VOLT_RGB, opacity), width=1)
    return layer


def vignette(w: int, h: int) -> Image.Image:
    """Soft Volt glow used behind hero-style assets."""
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r = int(max(w, h) * 0.55)
    d.ellipse([w // 2 - r, h // 2 - r, w // 2 + r, h // 2 + r], fill=(*VOLT_RGB, 22))
    return layer.filter(ImageFilter.GaussianBlur(r // 5))


def canvas(w: int, h: int, bg=BLACK_RGB) -> Image.Image:
    img = Image.new("RGBA", (w, h), (*bg, 255))
    img.alpha_composite(grid_overlay(w, h))
    return img


# --------------------------------------------------------------------------
# Text helpers
# --------------------------------------------------------------------------

def wrap(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont,
         max_w: int) -> list[str]:
    """Greedy word-wrap; returns lines that fit within max_w."""
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if draw.textbbox((0, 0), trial, font=f)[2] <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def spaced_text(draw: ImageDraw.ImageDraw, xy, s: str,
                f: ImageFont.FreeTypeFont, fill, tracking: int = 0) -> int:
    """Draws char-by-char with manual tracking; returns the x after the text."""
    x, y = xy
    for ch in s:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textbbox((0, 0), ch, font=f)[2] + tracking
    return x


def rounded_panel(base: Image.Image, box, radius: int, fill) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=radius, fill=(*fill, 255))
    base.alpha_composite(layer)


def button(base: Image.Image, xy, label: str, f: ImageFont.FreeTypeFont,
           bg, fg, pad_x: int = 36, pad_y: int = 20, radius: int = 14) -> None:
    """Volt-style CTA button with centred label."""
    x, y = xy
    probe = ImageDraw.Draw(base)
    tw = text_w(probe, label, f)
    th = f.getmetrics()[0]
    w, h = tw + pad_x * 2, th + pad_y * 2
    rounded_panel(base, (x, y, x + w, y + h), radius, bg)
    d = ImageDraw.Draw(base)
    d.text((x + pad_x, y + (h - th) // 2), label, font=f, fill=(*fg, 255))


def small_mark(color, height: int) -> Image.Image:
    m = extract_mark()
    return recolor(m, color).resize(
        (int(m.width * height / m.height), height), Image.LANCZOS
    )


# --------------------------------------------------------------------------
# Profile pictures — Rv monogram on Black (>= 400x400 required)
# --------------------------------------------------------------------------

def build_profiles(size: int = 800) -> None:
    mark = extract_mark()
    for name, color in (("black", WHITE_RGB), ("volt", VOLT_RGB)):
        img = canvas(size, size, BLACK_RGB)
        img.alpha_composite(vignette(size, size))
        m = recolor(mark, color)
        paste_scaled(img, m, (size // 5, size // 5, size - size // 5, size - size // 5))
        save(img, PROFILE_DIR / f"rv-monogram-{name}.png")


# --------------------------------------------------------------------------
# Banners — LinkedIn 1584x396, YouTube 2560x1440, X 1500x500
# --------------------------------------------------------------------------

def banner(w: int, h: int, name: str, tagline: str) -> None:
    img = canvas(w, h, BLACK_RGB)
    img.alpha_composite(vignette(w, h))

    wm = wordmark(extract_mark(), text_color=WHITE_RGB, accent=VOLT_RGB,
                  height=int(h * 0.36))
    img.alpha_composite(wm, (int(w * 0.06), (h - wm.height) // 2))

    d = ImageDraw.Draw(img)
    f = font(FONT_DISP, int(h * 0.22), "Medium")
    tw = text_w(d, tagline, f)
    d.text((w - int(w * 0.06) - tw, (h - f.getmetrics()[0]) // 2),
           tagline, font=f, fill=(*WHITE_RGB, 200))

    save(img, BANNER_DIR / f"banner-{name}.png")


# --------------------------------------------------------------------------
# Post templates — 1080x1080, the four core types
# --------------------------------------------------------------------------

S = 1080  # template canvas size
MARGIN = 90


def template_header(img: Image.Image, label: str) -> None:
    """Volt tracked label top-left, small white mark top-right."""
    d = ImageDraw.Draw(img)
    f = font(FONT_DISP, 38, "Bold")
    spaced_text(d, (MARGIN, 72), label, f, (*VOLT_RGB, 255), tracking=8)
    m = small_mark(WHITE_RGB, 56)
    img.alpha_composite(m, (S - MARGIN - m.width, 72))


def template_case_study() -> None:
    img = canvas(S, S, BLACK_RGB)
    template_header(img, "CASE STUDY")

    # Visual panel — abstract ascending bars (placeholder for a real mockup).
    panel = (MARGIN, 180, S - MARGIN, 620)
    rounded_panel(img, panel, 28, SLATE_RGB)
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = panel
    bar_w, gap, base_y = 96, 56, y1 - 70
    heights = [120, 190, 260, 340, 430]
    for i, bh in enumerate(heights):
        bx = x0 + 90 + i * (bar_w + gap)
        col = VOLT_RGB if i == len(heights) - 1 else (*VOLT_RGB, 90)
        d.rounded_rectangle((bx, base_y - bh, bx + bar_w, base_y),
                            radius=10, fill=col)

    # Result bullets.
    #
    # These are example copy for a template, and the line they must not cross is
    # inventing a result. An earlier version read "20+ templates shipped across
    # every channel", which is a statistic nobody had measured, and this file is
    # rendered onto the home page where a visitor reads it as a claim about the
    # studio. Each line now names the shape of a result and leaves the substance
    # to whoever fills the template in.
    f_b = font(FONT_REG, 34, "Medium")
    bullets = [
        "Positioning rebuilt around one core message",
        "Templates shipped across every channel",
        "Team handoff documented and walked through",
    ]
    y = 680
    for b in bullets:
        d.rounded_rectangle((MARGIN, y + 12, MARGIN + 22, y + 34), radius=6,
                            fill=(*VOLT_RGB, 255))
        d.text((MARGIN + 48, y), b, font=f_b, fill=(*WHITE_RGB, 235))
        y += 62

    f_cta = font(FONT_DISP, 32, "SemiBold")
    button(img, (S - MARGIN - 330, 920), "See full case study", f_cta,
           VOLT_RGB, BLACK_RGB)
    save(img, TEMPLATE_DIR / "template-case-study.png")


def template_quote() -> None:
    img = canvas(S, S, BLACK_RGB)
    img.alpha_composite(vignette(S, S))

    d = ImageDraw.Draw(img)
    f_q = font(FONT_DISP, 200, "Bold")
    d.text((MARGIN - 10, 60), "\u201C", font=f_q, fill=(*VOLT_RGB, 255))

    f_t = font(FONT_DISP, 76, "Bold")
    lines = wrap(d, "Your brand is a system. Build it like one.", f_t,
                 S - MARGIN * 2)
    y = 330
    for line in lines:
        d.text((MARGIN, y), line, font=f_t, fill=(*WHITE_RGB, 255))
        y += 96

    f_a = font(FONT_REG, 36, "Medium")
    d.text((MARGIN, y + 30), "\u2014 Rhymvex", font=f_a, fill=(*WHITE_RGB, 130))

    m = small_mark((*WHITE_RGB, 70), 64)
    img.alpha_composite(m, (S - MARGIN - m.width, S - MARGIN - m.height))
    save(img, TEMPLATE_DIR / "template-quote.png")


def template_offer() -> None:
    img = canvas(S, S, BLACK_RGB)
    template_header(img, "OFFER")

    # Ember urgency badge. "NEW" rather than "LIMITED": a scarcity badge is a
    # claim about how many slots are left, and this studio has never run an
    # offer. The badge demonstrates the treatment without asserting a campaign.
    d = ImageDraw.Draw(img)
    f_badge = font(FONT_DISP, 30, "Bold")
    bw = text_w(d, "NEW", f_badge) + 56
    rounded_panel(img, (MARGIN, 190, MARGIN + bw, 258), 12, EMBER_RGB)
    d.text((MARGIN + 28, 208), "NEW", font=f_badge, fill=(*BLACK_RGB, 255))

    # The headline and body state what belongs in them. This one used to read
    # "3 Brand Slots — Now Booking", which looked like a live offer with three
    # places left, and it was rendering on the home page.
    f_h = font(FONT_DISP, 92, "Bold")
    lines = wrap(d, "Your offer, named", f_h, S - MARGIN * 2 - 200)
    y = 330
    for line in lines:
        d.text((MARGIN, y), line, font=f_h, fill=(*WHITE_RGB, 255))
        y += 108

    f_d = font(FONT_REG, 38, "Regular")
    for line in wrap(d, "One line on what it is, who it is for, and what it costs.",
                    f_d, S - MARGIN * 2):
        d.text((MARGIN, y + 20), line, font=f_d, fill=(*WHITE_RGB, 170))
        y += 50

    f_cta = font(FONT_DISP, 34, "SemiBold")
    button(img, (MARGIN, 850), "Book a call", f_cta, VOLT_RGB, BLACK_RGB)
    save(img, TEMPLATE_DIR / "template-offer.png")


def template_process() -> None:
    img = canvas(S, S, BLACK_RGB)
    template_header(img, "PROCESS")

    steps = [
        ("01", "Audit", "We map what exists and where it breaks."),
        ("02", "System", "Message, rules, tokens, templates."),
        ("03", "Build", "Assets shipped on an agreed cadence."),
        ("04", "Repeat", "Review, iterate, stay on rhythm."),
    ]
    f_n = font(FONT_DISP, 52, "Bold")
    f_t = font(FONT_DISP, 42, "Bold")
    f_d = font(FONT_REG, 30, "Regular")

    d = ImageDraw.Draw(img)
    y = 220
    for i, (num, title, desc) in enumerate(steps):
        d.text((MARGIN, y), num, font=f_n, fill=(*VOLT_RGB, 255))
        d.text((MARGIN + 130, y + 6), title, font=f_t, fill=(*WHITE_RGB, 255))
        d.text((MARGIN + 130, y + 62), desc, font=f_d, fill=(*WHITE_RGB, 160))
        if i < len(steps) - 1:
            d.line([(MARGIN + 26, y + 138), (MARGIN + 26, y + 196)],
                   fill=(*VOLT_RGB, 90), width=3)
        y += 200

    m = small_mark(WHITE_RGB, 56)
    img.alpha_composite(m, (S - MARGIN - m.width, S - MARGIN - m.height))
    save(img, TEMPLATE_DIR / "template-process.png")


# --------------------------------------------------------------------------
# Open Graph image — 1200x630, used for link cards (auto-detected by Next.js)
# --------------------------------------------------------------------------

def opengraph(w: int = 1200, h: int = 630) -> None:
    img = canvas(w, h, BLACK_RGB)
    img.alpha_composite(vignette(w, h))

    wm = wordmark(extract_mark(), text_color=WHITE_RGB, accent=VOLT_RGB,
                  height=120)
    img.alpha_composite(wm, ((w - wm.width) // 2, h // 2 - wm.height - 20))

    d = ImageDraw.Draw(img)
    f = font(FONT_DISP, 52, "Medium")
    tag = "Build with rhythm."
    tw = text_w(d, tag, f)
    d.text(((w - tw) // 2, h // 2 + 50), tag, font=f, fill=(*WHITE_RGB, 190))

    save(img, ROOT / "web" / "app" / "opengraph-image.png")


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main() -> None:
    mark = extract_mark()  # fail fast if the master PNG is unusable
    del mark

    print("Profile pictures:")
    build_profiles()

    print("Banners:")
    banner(1584, 396, "linkedin", "Build with rhythm.")
    banner(2560, 1440, "youtube", "Build with rhythm.")
    banner(1500, 500, "x", "Build with rhythm.")

    print("Post templates:")
    template_case_study()
    template_quote()
    template_offer()
    template_process()

    print("Open Graph image:")
    opengraph()


if __name__ == "__main__":
    main()
