from __future__ import annotations

from fastapi import FastAPI

from app.line_webhook import router as line_webhook_router
from app.rag_service import rag_service

app = FastAPI(title="Fuyun Travel LINE RAG Bot")
app.include_router(line_webhook_router)


@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "service": "line-webhook-rag-v2", "knowledge_documents": rag_service.document_count()}
