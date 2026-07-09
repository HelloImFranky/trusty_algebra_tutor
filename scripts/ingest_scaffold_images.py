#!/usr/bin/env python3
"""
Bring the images/diagrams from the "Algebra Scaffolds__891" document into the
app, attached to the scaffold section each one belongs to.

Usage:
    python3 scripts/ingest_scaffold_images.py <scaffolds.pdf | scaffolds.docx>

Preferred input is the PDF export (File > Download > PDF): the scaffolds are a
mix of embedded images AND vector-drawn math/graphs, so each page is rendered
whole (and whitespace-cropped) to preserve every worked example, diagram, and
anchor chart exactly as the teacher made it. Each page maps to one scaffold
section by the fixed table below.

A .docx export is also accepted (extracts embedded raster images by heading);
that path loses vector-drawn content, so the PDF is recommended.

Outputs:
    web/public/scaffolds/<lesson>-<slug>-<n>.<ext>   image files
    server/src/content/scaffoldImages.json           section -> images manifest

Then run `npm run seed` to sync the manifest into lesson_scaffolds.images.
"""
import hashlib
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "web/public/scaffolds"
MANIFEST = REPO / "server/src/content/scaffoldImages.json"


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def slugify(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40] or "img"


# ---------------------------------------------------------------------------
# PDF path: fixed page -> (lesson, section title) map for the 92-page export.
# Section titles match server/src/content/classroomScaffolds.ts (normalized)
# so images merge into the existing text section; titles with no text match
# become image-only sections. Continuation pages repeat their parent's entry.
# ---------------------------------------------------------------------------
PDF_PAGE_MAP = {
    1: ("1.5", "Converting Measurements"),
    2: ("1.5", "Converting Rates"),
    3: ("1.1", "Square Roots & Cube Roots"),
    4: ("1.1", "Square Roots & Cube Roots"),
    5: ("1.1", "Exponents Rules"),
    6: ("1.4", "Rational vs Irrational"),
    7: ("1.6", "Properties of Real Numbers"),
    8: ("2.1", "Classifying Polynomials"),
    9: ("2.1", "Evaluating Polynomials & Expressions"),
    10: ("2.2", "Simplifying Expressions & Polynomials, Standard Form"),
    11: ("2.2", "Multi-Step Simplifying Polynomials"),
    12: ("2.2", "Writing Expressions"),
    13: ("2.3", "Adding vs Subtracting Polynomials"),
    14: ("2.3", "Multiplying Monomials and Polynomials"),
    15: ("2.3", "Multiplying Binomials"),
    16: ("2.3", "Multiplying Polynomials"),
    17: ("3.1", "Solving Equations Review (two-step equations)"),
    18: ("3.2", "Solving Equations with Variables on Both Sides"),
    19: ("3.3", "Solving Inequalities Review (two-step inequalities)"),
    20: ("3.3", "Solving Multi-Step Inequalities"),
    21: ("3.3", "Solving Inequalities with Variables on Both Sides"),
    22: ("3.3", "Real-world inequalities"),
    23: ("3.2", "Literal Equations"),
    24: ("4.1", "Understanding Functions"),
    25: ("4.2", "Input/Output — Evaluating Functions"),
    26: ("4.2", "Equality of Functions"),
    27: ("4.2", "Adding, Subtracting & Multiplying Functions"),
    28: ("4.2", "Domain & Range"),
    29: ("4.2", "Domain & Range Real-World Application"),
    30: ("4.2", "Interpreting Graphs"),
    31: ("4.2", "Interpreting Graphs"),
    32: ("4.2", "Interpreting Graphs"),
    33: ("4.2", "Interpreting Graphs"),
    34: ("5.3", "Intro to Graphing with Desmos"),
    35: ("5.1", "Identifying Linear Functions — EQUATIONS"),
    36: ("5.1", "Identifying Linear Functions — Tables & Word Problems"),
    37: ("5.2", "Finding Slope and Intercepts from a graph"),
    38: ("5.2", "Finding Slope and Intercepts from a table"),
    39: ("5.3", "Slope-Intercept Form"),
    40: ("5.2", "Rate of Change"),
    41: ("5.3", "Graphing y = mx + b"),
    42: ("5.3", "Writing Linear Functions"),
    43: ("5.3", "Interpreting & Modeling Linear Functions"),
    44: ("5.3", "Linear Regression & Correlation Coefficient"),
    45: ("5.4", "Solving Systems of Linear Equations by Graphing"),
    46: ("5.4", "Solving Systems of Linear Equations by Substitution"),
    47: ("5.5", "Solving Systems of Linear Equations by Elimination"),
    48: ("5.5", "Solving Systems of Linear Equations by Elimination"),
    49: ("5.5", "Systems — Cumulative Review (choosing a method)"),
    50: ("5.5", "Graphing Linear Inequalities & Systems of Inequalities"),
    51: ("5.5", "Graphing Linear Inequalities & Systems of Inequalities"),
    52: ("5.5", "Graphing Linear Inequalities & Systems of Inequalities"),
    53: ("5.5", "Graphing Linear Inequalities & Systems of Inequalities"),
    54: ("5.1", "Unit 5 Vocabulary"),
    55: ("5.1", "Unit 5 Vocabulary"),
    56: ("5.1", "Unit 5 Vocabulary"),
    57: ("6.1", "Graphing Exponential Functions"),
    58: ("6.1", "Writing Exponential Functions"),
    59: ("6.2", "Exponential Growth vs Decay"),
    60: ("6.2", "Exponential Growth vs Decay"),
    61: ("6.2", "Linear vs Exponential"),
    62: ("7.1", "Greatest Common Factor (GCF) of Monomials"),
    63: ("7.1", "Factors Cheat Sheet"),
    64: ("7.1", "Factoring Polynomials by using GCF"),
    65: ("7.1", "Factoring Polynomials by using GCF"),
    66: ("7.2", "Factoring Trinomials when a=1"),
    67: ("7.2", "Factoring a Difference of Squares (DOTS METHOD)"),
    68: ("7.2", "Factoring a Difference of Squares (DOTS METHOD)"),
    69: ("7.2", "Factoring Polynomials: Mixed Practice"),
    70: ("9.2", "Identifying Quadratic vs Exponential vs Linear Functions"),
    71: ("8.1", "Solving ax²−c=0 using Square Roots"),
    72: ("8.1", "RECALL: Simplifying Radicals"),
    73: ("8.1", "Solving a(x+b)²=c using Square Roots"),
    74: ("8.1", "Solving a(x+b)²=c using Square Roots"),
    75: ("8.2", "Solving Quadratic Equations by Factoring (a=1)"),
    76: ("8.2", "Solving Quadratic Equations by Factoring (a=1)"),
    77: ("8.2", "Solving Quadratics by Completing the Square"),
    78: ("8.2", "Solving Quadratics using the Quadratic Formula"),
    79: ("8.2", "Solving Quadratics using the Quadratic Formula"),
    80: ("8.2", "Solving Quadratics using Different Methods"),
    81: ("8.3", "Graphing Quadratic Functions"),
    82: ("8.3", "Using the Graphing Calculator"),
    83: ("8.3", "Identifying the VERTEX (graph, table, vertex-form)"),
    84: ("8.3", "Completing the Square to Identify the Vertex"),
    85: ("8.3", "Minimum vs Maximum"),
    86: ("8.3", "Axis of Symmetry"),
    87: ("8.3", "Identifying the Zeros/X-intercepts/Roots"),
    88: ("8.4", "Examples of Real-World Quadratics"),
    89: ("8.4", "System of Linear & Quadratic Equations"),
    90: ("9.1", "Transforming Functions"),
    91: ("9.1", "Transforming Functions"),
    92: ("9.2", "Piecewise Functions"),
}

ZOOM = 2.0          # ~144 dpi render
JPEG_QUALITY = 78
CROP_PAD = 18       # px of white padding kept around content after autocrop


def ingest_pdf(pdf_path: str) -> list[dict]:
    import fitz  # pymupdf
    from PIL import Image, ImageChops
    import io

    doc = fitz.open(pdf_path)
    if doc.page_count not in (92, len(PDF_PAGE_MAP)):
        print(
            f"warning: expected 92 pages, got {doc.page_count}. The page map "
            f"is calibrated to the known export; results may be misaligned."
        )

    def autocrop(im: Image.Image) -> Image.Image:
        rgb = im.convert("RGB")
        bg = Image.new("RGB", rgb.size, (255, 255, 255))
        diff = ImageChops.difference(rgb, bg)
        bbox = diff.getbbox()
        if not bbox:
            return rgb
        l, t, r, b = bbox
        l = max(0, l - CROP_PAD)
        t = max(0, t - CROP_PAD)
        r = min(rgb.width, r + CROP_PAD)
        b = min(rgb.height, b + CROP_PAD)
        return rgb.crop((l, t, r, b))

    # group pages by section, preserving order
    sections: dict[tuple[str, str], list[int]] = {}
    for page_no in range(1, doc.page_count + 1):
        key = PDF_PAGE_MAP.get(page_no)
        if key is None:
            print(f"warning: page {page_no} has no mapping; skipping")
            continue
        sections.setdefault(key, []).append(page_no)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []
    total = 0
    mat = fitz.Matrix(ZOOM, ZOOM)

    for (lesson, title), pages in sections.items():
        slug = slugify(title)
        urls: list[str] = []
        for i, page_no in enumerate(pages, start=1):
            pix = doc[page_no - 1].get_pixmap(matrix=mat, alpha=False)
            im = Image.open(io.BytesIO(pix.tobytes("png")))
            im = autocrop(im)
            # blank page (nothing but whitespace) -> skip
            if im.width < 40 or im.height < 40:
                continue
            name = f"{lesson.replace('.', '-')}-{slug}-{i}.jpg"
            im.save(OUT_DIR / name, "JPEG", quality=JPEG_QUALITY, optimize=True)
            urls.append(f"/scaffolds/{name}")
            total += 1
        if urls:
            manifest.append({"lesson": lesson, "title": title, "images": urls})

    manifest.sort(key=lambda e: (e["lesson"], e["title"]))
    print(f"rendered {total} page images to {OUT_DIR.relative_to(REPO)}")
    return manifest


# ---------------------------------------------------------------------------
# DOCX path (fallback): extract embedded raster images by heading.
# ---------------------------------------------------------------------------
NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "v": "urn:schemas-microsoft-com:vml",
}
MIN_BYTES = 1500
SKIP_EXT = {".emf", ".wmf"}
DOCX_HEADINGS = {norm(t): (l, t) for (l, t) in PDF_PAGE_MAP.values()}


def ingest_docx(docx_path: str) -> list[dict]:
    zf = zipfile.ZipFile(docx_path)
    rels_root = ET.fromstring(zf.read("word/_rels/document.xml.rels"))
    rid_to_target = {
        rel.get("Id"): rel.get("Target")
        for rel in rels_root.findall("rel:Relationship", NS)
        if "media/" in (rel.get("Target") or "")
    }
    body = ET.fromstring(zf.read("word/document.xml")).find("w:body", NS)

    current = None
    per_section: dict[tuple[str, str], list[str]] = {}
    for p in body.iter(f"{{{NS['w']}}}p"):
        text = "".join(p.itertext()).strip()
        if text and len(text) < 100:
            hit = DOCX_HEADINGS.get(norm(text))
            if hit:
                current = hit
        rids = [b.get(f"{{{NS['r']}}}embed") for b in p.iter(f"{{{NS['a']}}}blip")]
        rids += [i.get(f"{{{NS['r']}}}id") for i in p.iter(f"{{{NS['v']}}}imagedata")]
        for rid in rids:
            target = rid_to_target.get(rid or "")
            if target and current:
                per_section.setdefault(current, []).append(target)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest, seen, total = [], {}, 0
    for (lesson, title), targets in per_section.items():
        slug = slugify(title)
        urls, idx = [], 0
        for target in targets:
            try:
                data = zf.read("word/" + target.lstrip("/"))
            except KeyError:
                continue
            ext = Path(target).suffix.lower()
            if ext in SKIP_EXT or len(data) < MIN_BYTES:
                continue
            digest = hashlib.sha1(data).hexdigest()[:12]
            if digest in seen:
                if seen[digest] not in urls:
                    urls.append(seen[digest])
                continue
            idx += 1
            name = f"{lesson.replace('.', '-')}-{slug}-{idx}{ext}"
            (OUT_DIR / name).write_bytes(data)
            seen[digest] = f"/scaffolds/{name}"
            urls.append(seen[digest])
            total += 1
        if urls:
            manifest.append({"lesson": lesson, "title": title, "images": urls})
    manifest.sort(key=lambda e: (e["lesson"], e["title"]))
    print(f"extracted {total} embedded images to {OUT_DIR.relative_to(REPO)}")
    return manifest


def main(path: str) -> None:
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        manifest = ingest_pdf(path)
    elif ext == ".docx":
        manifest = ingest_docx(path)
    else:
        sys.exit(f"unsupported input: {ext} (use .pdf or .docx)")
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"manifest: {MANIFEST.relative_to(REPO)} ({len(manifest)} sections)")
    print("next: npm run seed   (syncs images into lesson_scaffolds)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
