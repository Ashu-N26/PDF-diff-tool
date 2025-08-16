import re
from typing import Dict, List

NUM = r"(?:\d+(?:\.\d+)?)"
DEG = r"(?:\d{2,3}(?:\.\d+)?(?:°|º)?)"
NM = r"(?:NM|nm)"
FT = r"(?:FT|ft)"

KEY_PATTERNS = {
    "MDA": re.compile(r"\bMDA\b[:\-\s]*("+NUM+r")\s*"+FT, re.I),
    "DA": re.compile(r"\bDA\b[:\-\s]*("+NUM+r")\s*"+FT, re.I),
    "OCA": re.compile(r"\bOCA\b[:\-\s]*("+NUM+r")\s*"+FT, re.I),
    "OCH": re.compile(r"\bOCH\b[:\-\s]*("+NUM+r")\s*"+FT, re.I),
    "RVR": re.compile(r"\bRVR\b[:\-\s]*("+NUM+r")\b", re.I),
    "VIS": re.compile(r"\bVIS\b[:\-\s]*("+NUM+r")\b", re.I),
    "CAT": re.compile(r"\bCAT\s*(I{1,3}|[123])\b", re.I),
    "COURSE": re.compile(r"\b(?:FINAL\s+COURSE|COURSE|QDM|QDR|TRACK)\b[:\-\s]*("+DEG+")", re.I),
    "DME": re.compile(r"\bDME\b.*?("+NUM+r")\s*"+NM, re.I | re.S),
    "REMARKS": re.compile(r"\b(?:REMARKS?|NOTES?)\b[:\-]?", re.I),
}

def _findall(rx, text: str) -> List[str]:
    return [m.group(1) if m.groups() else m.group(0) for m in rx.finditer(text)]

def extract_signals(text: str) -> Dict[str, List[str]]:
    found = {}
    for k, rx in KEY_PATTERNS.items():
        if k == "REMARKS":
            blocks = []
            for m in rx.finditer(text):
                start = m.end()
                block = text[start:start+400]
                blocks.append(block.strip())
            if blocks:
                found[k] = blocks
        else:
            vals = _findall(rx, text)
            if vals:
                found[k] = vals
    return found

def numeric_delta(a: str, b: str) -> str:
    try:
        da, db = float(a), float(b)
        d = db - da
        sign = "+" if d >= 0 else ""
        return f" ({sign}{d})"
    except Exception:
        return ""

def compare_signals(old: Dict[str, List[str]], new: Dict[str, List[str]]) -> Dict[str, List[str]]:
    """
    Return lines to print for a Minima panel, key -> list of 2-line entries (OLD/NEW)
    Only include keys that changed.
    """
    keys = ["MDA","DA","OCA","OCH","RVR","VIS","CAT","COURSE","DME"]
    out: Dict[str, List[str]] = {}
    for k in keys:
        ov = old.get(k, [])
        nv = new.get(k, [])
        if not ov and not nv:
            continue
        n = max(len(ov), len(nv))
        lines = []
        changed = False
        for i in range(n):
            a = ov[i] if i < len(ov) else None
            b = nv[i] if i < len(nv) else None
            if a != b:
                changed = True
                delta = ""
                if a and b:
                    # if both look numeric, append delta
                    na = re.findall(r"\d+(?:\.\d+)?", a)
                    nb = re.findall(r"\d+(?:\.\d+)?", b)
                    if na and nb:
                        delta = numeric_delta(na[0], nb[0])
                lines.append(("OLD", a or "—"))
                lines.append(("NEW", (b or "—") + delta))
        if changed and lines:
            out[k] = lines
    return out
