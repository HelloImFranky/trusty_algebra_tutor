#!/usr/bin/env python3
"""
Bring the original classroom scaffolds from the "Algebra Scaffolds__891"
document into the app, one image set per scaffold section, attached to the
lesson each section teaches.

Usage:
    python3 scripts/ingest_scaffold_images.py "scripts/Algebra Scaffolds__891.docx"
    python3 scripts/ingest_scaffold_images.py scaffolds.pdf

A .docx input is converted to PDF first (requires LibreOffice: `soffice`).
The document is one continuous flow — each scaffold starts with its title
paragraph and runs until the next title — so instead of assuming fixed page
breaks, the script finds every section title in the rendered PDF and slices
the document between consecutive titles. Each slice is rendered whole
(text, tables, photos, and vector-drawn math alike), whitespace-cropped,
and stitched into the section's image(s). Nothing is re-typeset: students
see the scaffold exactly as it was made for class.

Outputs:
    web/public/scaffolds/<lesson>-<slug>-<n>.jpg    section images
    server/src/content/scaffoldImages.json          lesson/section -> images

Then run `npm run seed` (happens automatically on server start) to sync the
manifest into lesson_scaffolds.images.

Dependencies: pymupdf, pillow  (pip install pymupdf pillow)
"""
from __future__ import annotations

import io
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "web/public/scaffolds"
MANIFEST = REPO / "server/src/content/scaffoldImages.json"

ZOOM = 2.0            # ~144 dpi render
JPEG_QUALITY = 78
CROP_PAD = 18         # px of white padding kept around content after autocrop
PIECE_GAP = 28        # px between stitched page-pieces of one section
MAX_IMAGE_H = 6200    # split a section into multiple images past this height
MIN_CONTENT = 40      # pieces smaller than this (px) are blank -> skipped

# ---------------------------------------------------------------------------
# The scaffold sections, in document order. Each entry is:
#   (lesson code, section title, [search aliases])
# The title is the canonical name used across the app (it matches the
# transcribed sections in server/src/content/classroomScaffolds.ts). The
# aliases are text snippets actually present in the document's title
# paragraph, used to locate the section's start. When no alias is given the
# title itself is searched (punctuation-insensitively).
# ---------------------------------------------------------------------------
SECTIONS: list[tuple[str, str, list[str]]] = [
    ("1.5", "Converting Measurements", []),
    ("1.5", "Converting Rates", []),
    ("1.1", "Square Roots & Cube Roots", []),
    ("1.1", "Exponents Rules", []),
    ("1.4", "Rational vs Irrational", []),
    ("1.6", "Properties of Real Numbers", []),
    ("2.1", "Classifying Polynomials", []),
    ("2.1", "Evaluating Polynomials & Expressions", []),
    ("2.2", "Simplifying Expressions & Polynomials, Standard Form",
     ["Simplifying Expressions & Polynomials"]),
    ("2.2", "Multi-Step Simplifying Polynomials", []),
    ("2.2", "Writing Expressions", []),
    ("2.3", "Adding vs Subtracting Polynomials", []),
    ("2.3", "Multiplying Monomials and Polynomials", []),
    ("2.3", "Multiplying Binomials", []),
    ("2.3", "Multiplying Polynomials", []),
    ("3.1", "Solving Equations Review (two-step equations)",
     ["Solving Equations Review"]),
    ("3.1", "Solving Multi-Step Equations", []),
    ("3.2", "Solving Equations with Variables on Both Sides", []),
    ("3.3", "Solving Inequalities Review (two-step inequalities)",
     ["Solving Inequalities Review"]),
    ("3.3", "Solving Multi-Step Inequalities", []),
    ("3.3", "Solving Inequalities with Variables on Both Sides", []),
    ("3.3", "Real-world inequalities", []),
    ("3.2", "Literal Equations", []),
    ("4.1", "Understanding Functions", []),
    ("4.2", "Input/Output — Evaluating Functions",
     ["Input/Output - Evaluating Functions", "Evaluating Functions"]),
    ("4.2", "Equality of Functions", []),
    ("4.2", "Adding, Subtracting & Multiplying Functions",
     ["Adding & Subtracting Functions"]),
    ("4.2", "Domain & Range", []),
    ("4.2", "Domain & Range Real-World Application",
     ["Real-World Application"]),
    ("4.2", "Interpreting Graphs", []),
    ("5.3", "Intro to Graphing with Desmos", ["Intro to Graphing"]),
    ("5.1", "Identifying Linear Functions — EQUATIONS",
     ["Identifying Linear Functions - EQUATIONS"]),
    ("5.1", "Identifying Linear Functions — Tables & Word Problems",
     ["Identifying Linear Functions - Tables"]),
    ("5.2", "Finding Slope and Intercepts from a graph", []),
    ("5.2", "Finding Slope and Intercepts from a table", []),
    ("5.3", "Slope-Intercept Form", []),
    ("5.2", "Rate of Change", []),
    ("5.3", "Graphing y = mx + b", ["Graphing y=mx+b", "Graphing y = mx + b"]),
    ("5.3", "Writing Linear Functions", []),
    ("5.3", "Interpreting & Modeling Linear Functions",
     ["Interpreting & Modeling"]),
    ("5.3", "Linear Regression & Correlation Coefficient",
     ["Linear Regression"]),
    ("5.4", "Solving Systems of Linear Equations by Graphing", []),
    ("5.4", "Solving Systems of Linear Equations by Substitution", []),
    ("5.5", "Solving Systems of Linear Equations by Elimination", []),
    ("5.5", "Systems — Cumulative Review (choosing a method)",
     ["Cumulative Review"]),
    ("5.5", "Graphing Linear Inequalities & Systems of Inequalities",
     ["Graphing Linear Inequalities"]),
    ("5.1", "Unit 5 Vocabulary", ["Linear Functions Vocabulary"]),
    ("6.1", "Graphing Exponential Functions", []),
    ("6.1", "Writing Exponential Functions", []),
    ("6.2", "Exponential Growth vs Decay", []),
    ("6.2", "Linear vs Exponential", []),
    ("7.1", "Greatest Common Factor (GCF) of Monomials",
     ["Greatest Common Factor"]),
    ("7.1", "Factors Cheat Sheet", ["FACTORS CHEAT SHEET"]),
    ("7.1", "Factoring Polynomials by using GCF", []),
    ("7.2", "Factoring Trinomials when a=1", ["Factoring Trinomials"]),
    ("7.2", "Factoring a Difference of Squares (DOTS METHOD)",
     ["Difference of Squares"]),
    ("7.2", "Factoring Polynomials: Mixed Practice", ["Mixed Practice"]),
    ("9.2", "Identifying Quadratic vs Exponential vs Linear Functions",
     ["Identifying Quadratic"]),
    ("8.1", "Solving ax²−c=0 using Square Roots", ["using Square Roots"]),
    ("8.1", "RECALL: Simplifying Radicals", ["Simplifying Radicals"]),
    ("8.1", "Solving a(x+b)²=c using Square Roots", ["using Square Roots"]),
    ("8.2", "Solving Quadratic Equations by Factoring (a=1)",
     ["Solving Quadratic Equations by Factoring"]),
    ("8.2", "Solving Quadratics by Completing the Square", []),
    ("8.2", "Solving Quadratics using the Quadratic Formula",
     ["Solving Quadratics using the"]),
    ("8.2", "Solving Quadratics using Different Methods",
     ["Different Methods"]),
    ("8.3", "Graphing Quadratic Functions", []),
    ("8.3", "Using the Graphing Calculator", ["Graphing Calculator"]),
    ("8.3", "Identifying the VERTEX (graph, table, vertex-form)",
     ["Identifying the"]),
    ("8.3", "Completing the Square to Identify the Vertex",
     ["Completing the Square to Identify"]),
    ("8.3", "Minimum vs Maximum", []),
    ("8.3", "Axis of Symmetry", []),
    ("8.3", "Identifying the Zeros/X-intercepts/Roots", ["Identifying the"]),
    ("8.4", "Examples of Real-World Quadratics", ["Real-World Quadratics"]),
    ("8.4", "System of Linear & Quadratic Equations",
     ["System of Linear & Quadratic"]),
    ("9.1", "Transforming Functions", []),
    ("9.2", "Piecewise Functions", []),
]

MAX_LOOKAHEAD_PAGES = 8  # a section never starts more than this far ahead


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def slugify(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:44] or "img"


def docx_to_pdf(docx: Path) -> Path:
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        sys.exit("converting .docx requires LibreOffice (soffice); "
                 "or export the document as PDF and pass that instead")
    tmp = Path(tempfile.mkdtemp(prefix="scaffolds_"))
    # a plain-ascii copy avoids filename quirks in some soffice builds
    src = tmp / "scaffolds.docx"
    shutil.copyfile(docx, src)
    subprocess.run(
        [soffice, f"-env:UserInstallation=file://{tmp}/profile",
         "--headless", "--convert-to", "pdf", str(src), "--outdir", str(tmp)],
        check=True, capture_output=True,
    )
    pdf = tmp / "scaffolds.pdf"
    if not pdf.exists():
        sys.exit("LibreOffice did not produce a PDF")
    return pdf


def find_anchors(doc) -> list[tuple[int, float, str, str]]:
    """Locate each section's title in document order.

    Returns [(page_index, y, lesson, title), ...] — one per section. Searches
    only forward from the previous anchor, so repeated phrases later in the
    document (vocabulary cards, in-body mentions) can't hijack a boundary.
    """
    # exact-match index of standalone text blocks (title paragraphs)
    blocks: list[tuple[int, float, str]] = []
    for pno in range(doc.page_count):
        for b in doc[pno].get_text("dict")["blocks"]:
            if b.get("type") != 0:
                continue
            text = " ".join(
                s["text"] for l in b["lines"] for s in l["spans"]
            ).strip()
            if text and len(text) < 90:
                blocks.append((pno, b["bbox"][1], norm(text)))
    blocks.sort(key=lambda t: (t[0], t[1]))

    anchors: list[tuple[int, float, str, str]] = []
    pos = (0, -1.0)  # (page_index, y) of the previous anchor
    for lesson, title, aliases in SECTIONS:
        limit = min(doc.page_count, pos[0] + MAX_LOOKAHEAD_PAGES)
        candidates: list[tuple[int, float]] = []
        # 1) a whole block that IS the title (punctuation-insensitive)
        wanted = {norm(a) for a in aliases} | {norm(title)}
        candidates += [
            (p, y) for (p, y, n) in blocks
            if n in wanted and (p, y) > pos and p < limit
        ]
        # 2) literal text search for each alias (handles multi-line titles)
        for alias in aliases or [title]:
            for pno in range(pos[0], limit):
                for r in doc[pno].search_for(alias):
                    if (pno, r.y0) > pos:
                        candidates.append((pno, r.y0))
        if not candidates:
            sys.exit(f"could not locate section {lesson} “{title}” "
                     f"after page {pos[0] + 1} — has the document changed?")
        page, y = min(candidates)
        anchors.append((page, y, lesson, title))
        pos = (page, y + 1.0)
    return anchors


def render_sections(pdf_path: Path) -> list[dict]:
    import fitz
    from PIL import Image, ImageChops

    doc = fitz.open(pdf_path)
    anchors = find_anchors(doc)
    mat = fitz.Matrix(ZOOM, ZOOM)

    def autocrop(im: Image.Image) -> Image.Image | None:
        rgb = im.convert("RGB")
        bg = Image.new("RGB", rgb.size, (255, 255, 255))
        bbox = ImageChops.difference(rgb, bg).getbbox()
        if not bbox:
            return None
        l, t, r, b = bbox
        if r - l < MIN_CONTENT or b - t < MIN_CONTENT:
            return None
        return rgb.crop((
            max(0, l - CROP_PAD), max(0, t - CROP_PAD),
            min(rgb.width, r + CROP_PAD), min(rgb.height, b + CROP_PAD),
        ))

    def render_clip(pno: int, y0: float, y1: float) -> Image.Image | None:
        page = doc[pno]
        clip = fitz.Rect(0, max(0, y0), page.rect.width,
                         min(page.rect.height, y1))
        if clip.height < 8:
            return None
        pix = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
        return autocrop(Image.open(io.BytesIO(pix.tobytes("png"))))

    def stitch(pieces: list[Image.Image]) -> Image.Image:
        w = max(p.width for p in pieces)
        h = sum(p.height for p in pieces) + PIECE_GAP * (len(pieces) - 1)
        out = Image.new("RGB", (w, h), (255, 255, 255))
        y = 0
        for p in pieces:
            out.paste(p, ((w - p.width) // 2, y))
            y += p.height + PIECE_GAP
        return out

    if OUT_DIR.exists():
        for old in OUT_DIR.glob("*.*"):
            old.unlink()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest: list[dict] = []
    total = 0
    for i, (page, y, lesson, title) in enumerate(anchors):
        if i + 1 < len(anchors):
            end_page, end_y = anchors[i + 1][0], anchors[i + 1][1]
        else:
            end_page, end_y = doc.page_count - 1, doc[-1].rect.height
        # slice the document flow between this title and the next one
        pieces: list[Image.Image] = []
        for pno in range(page, end_page + 1):
            y0 = y if pno == page else 0.0
            y1 = end_y if pno == end_page else doc[pno].rect.height
            im = render_clip(pno, y0, y1)
            if im is not None:
                pieces.append(im)
        if not pieces:
            print(f"warning: section {lesson} “{title}” rendered empty")
            continue
        # stitch page-pieces into one tall image; split if it gets huge
        groups: list[list[Image.Image]] = [[]]
        h = 0
        for p in pieces:
            if groups[-1] and h + p.height > MAX_IMAGE_H:
                groups.append([])
                h = 0
            groups[-1].append(p)
            h += p.height + PIECE_GAP
        slug = slugify(title)
        urls = []
        for n, group in enumerate(groups, start=1):
            name = f"{lesson.replace('.', '-')}-{slug}-{n}.jpg"
            stitch(group).save(OUT_DIR / name, "JPEG",
                               quality=JPEG_QUALITY, optimize=True)
            urls.append(f"/scaffolds/{name}")
            total += 1
        # repeated titles (e.g. a section's part 2) merge into one entry
        prev = next((e for e in manifest
                     if e["lesson"] == lesson and e["title"] == title), None)
        if prev:
            prev["images"] += [u for u in urls if u not in prev["images"]]
        else:
            manifest.append({"lesson": lesson, "title": title, "images": urls})

    # group by lesson but keep the document's teaching order within a lesson
    manifest.sort(key=lambda e: e["lesson"])
    print(f"rendered {total} images ({len(manifest)} sections) "
          f"to {OUT_DIR.relative_to(REPO)}")
    return manifest


def main(path: str) -> None:
    src = Path(path)
    if not src.exists():
        sys.exit(f"no such file: {src}")
    ext = src.suffix.lower()
    if ext == ".docx":
        print("converting .docx to PDF with LibreOffice…")
        pdf = docx_to_pdf(src)
    elif ext == ".pdf":
        pdf = src
    else:
        sys.exit(f"unsupported input: {ext} (use .docx or .pdf)")
    manifest = render_sections(pdf)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"manifest: {MANIFEST.relative_to(REPO)} ({len(manifest)} sections)")
    print("next: npm run seed   (runs automatically when the server starts)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
