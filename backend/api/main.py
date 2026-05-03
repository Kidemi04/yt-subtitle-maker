"""FastAPI app entry. Wires all route modules."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import config as config_route
from api.routes import dependencies, metadata, process, translator, version

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
app.include_router(config_route.router)
app.include_router(dependencies.router)


@app.get("/")
def root():
    return {"service": "yt-subtitle-maker", "version": "2.0.0a1"}
