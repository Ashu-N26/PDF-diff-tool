import os, uuid, difflib, textwrap
from typing import Dict, List, Tuple

import fitz  # PyMuPDF
from rapidfuzz import fuzz

from .aip_rules import extract_signals, compare_signals

RED = (0.95, 0.0, 0.0)     # latest changes
GREEN = (0.0, 0.6, 0.0)    # old values
CHANGE_BAR = (0.95, 0.0, 0.0)

def _short(s: str, n=240) -> str:
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n-1] + "…"

def _highlight_range(page, words, j1, j2, color):
    for k in range(j1, j2):
