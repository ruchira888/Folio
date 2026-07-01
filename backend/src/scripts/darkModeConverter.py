import pikepdf
from pikepdf import Name, Object
import sys
import os
import math
from decimal import Decimal, ROUND_HALF_UP

# Dark mode colors
DARK_BG = Decimal('0.071')      # #121212
DARK_BG_RGB = (0.071, 0.071, 0.071)
LIGHT_TEXT = Decimal('0.918')   # #eaeaea
LIGHT_TEXT_RGB = (0.918, 0.918, 0.918)
FACTOR = Decimal('0.847')       # 0.918 - 0.071

# Text threshold for scanned detection
TEXT_THRESHOLD = 100


def quantize(val):
    """Quantize a float to a 3-decimal PDF numeric value."""
    d = Decimal(str(val)).quantize(Decimal('0.001'), rounding=ROUND_HALF_UP)
    return d


def compute_luminance(r, g, b):
    """Compute approximate luminance from RGB."""
    return 0.299 * r + 0.587 * g + 0.114 * b


def map_rgb(r, g, b):
    """
    Map an RGB color to dark-mode equivalent.
    - Near-black (text)  -> light (#eaeaea)
    - Near-white (bg)    -> dark (#121212)
    - Mid-tones          -> scaled inversion for contrast
    """
    max_val = max(r, g, b)
    min_val = min(r, g, b)
    luminance = (max_val + min_val) / 2.0

    if luminance < 0.15:
        # Near-black: map to light text
        return LIGHT_TEXT_RGB

    if luminance > 0.9:
        # Near-white: map to dark background (invisible on dark bg)
        return DARK_BG_RGB

    # Mid-tones: scaled inversion to preserve contrast on dark bg
    # Map [0,1] -> [0.918, 0.071]
    new_r = max(0.071, 0.918 - r * 0.847)
    new_g = max(0.071, 0.918 - g * 0.847)
    new_b = max(0.071, 0.918 - b * 0.847)
    return (new_r, new_g, new_b)


def map_gray(gray):
    """Map a gray value to dark-mode equivalent."""
    if gray < 0.15:
        return 0.918
    if gray > 0.9:
        return 0.071
    return max(0.071, 0.918 - gray * 0.847)


def cmyk_to_rgb(c, m, y, k):
    """Convert CMYK to RGB."""
    r = 1.0 - min(1.0, c * (1.0 - k) + k)
    g = 1.0 - min(1.0, m * (1.0 - k) + k)
    b = 1.0 - min(1.0, y * (1.0 - k) + k)
    return r, g, b


def process_content_stream(page, pdf, processed_xobjects=None):
    """
    Parse a page's content stream, replace color operators, add dark bg,
    and recursively process Form XObjects.
    Returns the modified content stream bytes.
    """
    if processed_xobjects is None:
        processed_xobjects = set()

    ops = pikepdf.parse_content_stream(page)
    new_ops = []

    # Get page dimensions from MediaBox
    mediabox = page.mediabox
    page_width = float(mediabox[2] - mediabox[0])
    page_height = float(mediabox[3] - mediabox[1])

    # Insert dark background rectangle at the beginning
    # We use a save/restore to isolate our background from the original graphics state
    new_ops.append(([], 'q'))                           # save graphics state
    new_ops.append(([DARK_BG, DARK_BG, DARK_BG], 'rg'))  # set fill color
    new_ops.append(([0, 0, page_width, page_height], 're'))  # rectangle
    new_ops.append(([], 'f'))                           # fill
    new_ops.append(([], 'Q'))                           # restore graphics state

    # Get resources for XObject lookup
    resources = page.Resources if hasattr(page, 'Resources') else {}
    xobjects = resources.get(Name.XObject, {}) if resources else {}

    for op in ops:
        op_name = str(op.operator)
        operands = list(op.operands)

        # Handle XObject references (images and forms)
        if op_name == 'Do' and len(operands) >= 1:
            xobj_name = str(operands[0]).lstrip('/')
            xobj_key = Name('/' + xobj_name)

            if xobj_key in xobjects:
                xobj = xobjects[xobj_key]
                # Check if it's a Form XObject (recursive processing)
                subtype = xobj.get(Name.Subtype) if hasattr(xobj, 'get') else None
                if subtype == Name.Form and xobj.objgen not in processed_xobjects:
                    processed_xobjects.add(xobj.objgen)
                    # Process the Form XObject's content stream recursively
                    _process_xobject(xobj, pdf, processed_xobjects)
            # Preserve the Do operator unchanged (images stay untouched)
            new_ops.append((operands, op_name))
            continue

        # Replace color operators
        if op_name == 'rg':
            # Non-stroking RGB (text fill, shape fill)
            r, g, b = float(operands[0]), float(operands[1]), float(operands[2])
            new_r, new_g, new_b = map_rgb(r, g, b)
            new_ops.append(([quantize(new_r), quantize(new_g), quantize(new_b)], 'rg'))

        elif op_name == 'RG':
            # Stroking RGB (line/border color)
            r, g, b = float(operands[0]), float(operands[1]), float(operands[2])
            new_r, new_g, new_b = map_rgb(r, g, b)
            new_ops.append(([quantize(new_r), quantize(new_g), quantize(new_b)], 'RG'))

        elif op_name == 'g':
            # Non-stroking gray
            gray = float(operands[0])
            new_gray = map_gray(gray)
            new_ops.append(([quantize(new_gray)], 'g'))

        elif op_name == 'G':
            # Stroking gray
            gray = float(operands[0])
            new_gray = map_gray(gray)
            new_ops.append(([quantize(new_gray)], 'G'))

        elif op_name == 'k':
            # Non-stroking CMYK
            c, m, y, k = float(operands[0]), float(operands[1]), float(operands[2]), float(operands[3])
            if abs(c) < 0.001 and abs(m) < 0.001 and abs(y) < 0.001:
                # Pure gray: convert to gray operator
                gray_val = 1.0 - k
                new_gray = map_gray(gray_val)
                new_ops.append(([quantize(new_gray)], 'g'))
            else:
                # Convert to RGB then map
                r, g, b = cmyk_to_rgb(c, m, y, k)
                new_r, new_g, new_b = map_rgb(r, g, b)
                new_ops.append(([quantize(new_r), quantize(new_g), quantize(new_b)], 'rg'))

        elif op_name == 'K':
            # Stroking CMYK
            c, m, y, k = float(operands[0]), float(operands[1]), float(operands[2]), float(operands[3])
            if abs(c) < 0.001 and abs(m) < 0.001 and abs(y) < 0.001:
                gray_val = 1.0 - k
                new_gray = map_gray(gray_val)
                new_ops.append(([quantize(new_gray)], 'G'))
            else:
                r, g, b = cmyk_to_rgb(c, m, y, k)
                new_r, new_g, new_b = map_rgb(r, g, b)
                new_ops.append(([quantize(new_r), quantize(new_g), quantize(new_b)], 'RG'))

        else:
            # Preserve all other operators unchanged (text, paths, transformations, etc.)
            new_ops.append((operands, op_name))

    return pikepdf.unparse_content_stream(new_ops)


def _process_xobject(xobj, pdf, processed_xobjects):
    """Recursively process a Form XObject's content stream."""
    if not hasattr(xobj, 'get') or xobj.get(Name.Subtype) != Name.Form:
        return

    # Some Form XObjects may not have a stream
    if not hasattr(xobj, 'read_raw_bytes'):
        return

    try:
        # Parse the Form XObject's content stream
        ops = pikepdf.parse_content_stream(xobj)
        new_ops = []

        # Get resources for nested XObject lookup
        resources = xobj.get(Name.Resources, {}) if hasattr(xobj, 'get') else {}
        xobjects = resources.get(Name.XObject, {}) if resources else {}

        for op in ops:
            op_name = str(op.operator)
            operands = list(op.operands)

            if op_name == 'Do' and len(operands) >= 1:
                xobj_name = str(operands[0]).lstrip('/')
                xobj_key = Name('/' + xobj_name)
                if xobj_key in xobjects:
                    nested_xobj = xobjects[xobj_key]
                    subtype = nested_xobj.get(Name.Subtype) if hasattr(nested_xobj, 'get') else None
                    if subtype == Name.Form and nested_xobj.objgen not in processed_xobjects:
                        processed_xobjects.add(nested_xobj.objgen)
                        _process_xobject(nested_xobj, pdf, processed_xobjects)
                new_ops.append((operands, op_name))
                continue

            if op_name == 'rg':
                r, g, b = float(operands[0]), float(operands[1]), float(operands[2])
                new_r, new_g, new_b = map_rgb(r, g, b)
                new_ops.append(([quantize(new_r), quantize(new_g), quantize(new_b)], 'rg'))
            elif op_name == 'RG':
                r, g, b = float(operands[0]), float(operands[1]), float(operands[2])
                new_r, new_g, new_b = map_rgb(r, g, b)
                new_ops.append(([quantize(new_r), quantize(new_g), quantize(new_b)], 'RG'))
            elif op_name == 'g':
                gray = float(operands[0])
                new_gray = map_gray(gray)
                new_ops.append(([quantize(new_gray)], 'g'))
            elif op_name == 'G':
                gray = float(operands[0])
                new_gray = map_gray(gray)
                new_ops.append(([quantize(new_gray)], 'G'))
            elif op_name == 'k':
                c, m, y, k = float(operands[0]), float(operands[1]), float(operands[2]), float(operands[3])
                if abs(c) < 0.001 and abs(m) < 0.001 and abs(y) < 0.001:
                    gray_val = 1.0 - k
                    new_gray = map_gray(gray_val)
                    new_ops.append(([quantize(new_gray)], 'g'))
                else:
                    r, g, b = cmyk_to_rgb(c, m, y, k)
                    new_r, new_g, new_b = map_rgb(r, g, b)
                    new_ops.append(([quantize(new_r), quantize(new_g), quantize(new_b)], 'rg'))
            elif op_name == 'K':
                c, m, y, k = float(operands[0]), float(operands[1]), float(operands[2]), float(operands[3])
                if abs(c) < 0.001 and abs(m) < 0.001 and abs(y) < 0.001:
                    gray_val = 1.0 - k
                    new_gray = map_gray(gray_val)
                    new_ops.append(([quantize(new_gray)], 'G'))
                else:
                    r, g, b = cmyk_to_rgb(c, m, y, k)
                    new_r, new_g, new_b = map_rgb(r, g, b)
                    new_ops.append(([quantize(new_r), quantize(new_g), quantize(new_b)], 'RG'))
            else:
                new_ops.append((operands, op_name))

        # Write back the modified content stream
        new_stream = pikepdf.unparse_content_stream(new_ops)
        xobj.write(new_stream)
    except Exception as e:
        # If we can't process a Form XObject, leave it as-is
        print(f"Warning: Could not process Form XObject: {e}", file=sys.stderr)


def is_text_based_pdf(input_path):
    """
    Check if a PDF is text-based by extracting text from all pages.
    Returns True if total text >= TEXT_THRESHOLD characters.
    """
    try:
        from pdfminer.high_level import extract_text
        total_text = extract_text(input_path)
        return len(total_text.strip()) >= TEXT_THRESHOLD
    except Exception as e:
        print(f"Error checking text content: {e}", file=sys.stderr)
        return False


def convert_to_dark_mode(input_path, output_path):
    """
    Convert a text-based PDF to dark mode.
    Raises ValueError if the PDF is scanned/image-only.
    """
    # First check if it's text-based
    if not is_text_based_pdf(input_path):
        raise ValueError("UNSUPPORTED_SCANNED_PDF")

    pdf = pikepdf.open(input_path)

    processed_xobjects = set()

    for page in pdf.pages:
        # Process the page's content stream
        new_stream = process_content_stream(page, pdf, processed_xobjects)
        page.Contents = pdf.make_stream(new_stream)

    # Preserve all metadata, bookmarks, and structure
    pdf.save(output_path, min_version=pdf.pdf_version)
    pdf.close()


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python darkModeConverter.py <input.pdf> <output.pdf>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    try:
        convert_to_dark_mode(input_path, output_path)
        print(f"SUCCESS: {output_path}")
    except ValueError as e:
        if str(e) == "UNSUPPORTED_SCANNED_PDF":
            print("UNSUPPORTED_SCANNED_PDF")
            sys.exit(2)
        raise
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
