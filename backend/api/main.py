"""FastAPI app entry. Wires all route modules."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import config as config_route
from api.routes import (
    cookies,
    dependencies,
    history,
    library,
    metadata,
    process,
    translator,
    version,
)
from api.routes import engines as engines_route
from api.routes import fs as fs_route
from api.routes import system as system_route

app = FastAPI(title="yt-subtitle-maker API", version="2.0.0a1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(metadata.router)
app.include_router(process.router)
app.include_router(translator.router)
app.include_router(version.router)
app.include_router(system_route.router)
app.include_router(engines_route.router)
app.include_router(config_route.router)
app.include_router(dependencies.router)
app.include_router(library.router)
app.include_router(history.router)
app.include_router(cookies.router)
app.include_router(fs_route.router)


@app.get("/")
def root():
    return {"service": "yt-subtitle-maker", "version": "2.0.0a1"}
