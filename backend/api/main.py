"""FastAPI app entry. Wires all route modules."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import translator

app = FastAPI(title="yt-subtitle-maker API", version="2.0.0a1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(translator.router)


@app.get("/")
def root():
    return {"service": "yt-subtitle-maker", "version": "2.0.0a1"}
