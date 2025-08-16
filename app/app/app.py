from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader, select_autoescape
import os, uuid, shutil

# Uvicorn loads this object -> app.app:app
app = FastAPI(title="AIP PDF Compare")

BASE_DIR = os.path.dirname(__file__)
TPL_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)

env = Environment(loader=FileSystemLoader(TPL_DIR),
                  autoescape=select_autoescape(["html", "xml"]))

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

WORK_ROOT = os.path.join("/tmp", "aip-pdf-compare")
os.makedirs(WORK_ROOT, exist_ok=True)

def render(name: str, **ctx) -> HTMLResponse:
    return HTMLResponse(env.get_template(name).render(**ctx))

def save_upload(u: UploadFile, dest: str):
    with open(dest, "wb") as f:
        shutil.copyfileobj(u.file, f)

@app.get("/", response_class=HTMLResponse)
async def index():
    return render("index.html", download_annotated=None, download_sbs=None)

@app.post("/compare", response_class=HTMLResponse)
async def compare(
    request: Request,
    old_pdf: UploadFile = File(...),
    new_pdf: UploadFile = File(...),
    add_front_summary: str | None = Form(None),
    add_minima_panels: str | None = Form(None),
    detect_courses: str | None = Form(None),
    detect_dme: str | None = Form(None),
    detect_notes: str | None = Form(None),
):
    # session folder
    sid = str(uuid.uuid4())[:8]
    out_dir = os.path.join(WORK_ROOT, sid)
    os.makedirs(out_dir, exist_ok=True)

    old_path = os.path.join(out_dir, "old.pdf")
    new_path = os.path.join(out_dir, "new.pdf")
    save_upload(old_pdf, old_path)
    save_upload(new_pdf, new_path)

    annotated_path = os.path.join(out_dir, "annotated_latest.pdf")
    sbs_path = os.path.join(out_dir, "side_by_side.pdf")

    opt = lambda v: v is not None

    # import here to avoid startup-time import errors
    from app.diff_engine import build_annotated_latest, build_side_by_side

    build_annotated_latest(
        old_path,
        new_path,
        annotated_path,
        add_front_summary=opt(add_front_summary),
        add_minima_panels=opt(add_minima_panels),
        detect_courses=opt(detect_courses),
        detect_dme=opt(detect_dme),
        detect_notes=opt(detect_notes),
    )
    build_side_by_side(old_path, new_path, sbs_path)

    return render(
        "index.html",
        download_annotated=f"/download/{sid}/annotated_latest.pdf",
        download_sbs=f"/download/{sid}/side_by_side.pdf",
    )

@app.get("/download/{sid}/{filename}")
async def download(sid: str, filename: str):
    path = os.path.join(WORK_ROOT, sid, filename)
    if not os.path.isfile(path):
        return HTMLResponse("File not found", status_code=404)
    return FileResponse(path, media_type="application/pdf", filename=filename)
