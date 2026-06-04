import os
import sys
import hashlib
from pathlib import Path
from typing import List, Dict, Any

import yaml
import chromadb
from chromadb.utils import embedding_functions


BASE_DIR = Path(__file__).resolve().parents[1]
KB_DIR = BASE_DIR / "knowledge_base"
VECTOR_DB_PATH = os.getenv("VECTOR_DB_PATH", str(BASE_DIR / "chroma_db"))
COLLECTION_NAME = "fuyun_travel_kb"


def load_yaml_file(path: Path) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if data is None:
        return []

    if isinstance(data, list):
        items = data
    else:
        items = [data]

    docs = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            item = {"content": item}
        content = yaml.dump(item, allow_unicode=True, sort_keys=False)
        docs.append({
            "id": item.get("id", f"{path.stem}_{i}"),
            "content": content,
            "metadata": {
                "source": path.name,
                "type": "yaml",
                "category": str(item.get("category", "general")),
            }
        })
    return docs


def load_markdown_file(path: Path) -> List[Dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    chunks = chunk_text(text)

    docs = []
    for i, chunk in enumerate(chunks):
        docs.append({
            "id": f"{path.stem}_{i}",
            "content": chunk,
            "metadata": {
                "source": path.name,
                "type": "markdown",
                "category": "general",
            }
        })
    return docs


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 120) -> List[str]:
    text = text.strip()
    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)

    return chunks


def stable_id(raw_id: str, content: str) -> str:
    digest = hashlib.md5(content.encode("utf-8")).hexdigest()[:12]
    return f"{raw_id}_{digest}"


def get_embedding_function():
    openai_key = os.getenv("OPENAI_API_KEY")

    if openai_key:
        return embedding_functions.OpenAIEmbeddingFunction(
            api_key=openai_key,
            model_name="text-embedding-3-small"
        )

    return embedding_functions.DefaultEmbeddingFunction()


def ingest():
    if not KB_DIR.exists():
        raise FileNotFoundError(f"找不到 knowledge_base 目錄：{KB_DIR}")

    all_docs = []

    for path in KB_DIR.glob("**/*"):
        if path.suffix.lower() in [".yaml", ".yml"]:
            all_docs.extend(load_yaml_file(path))
        elif path.suffix.lower() in [".md", ".markdown"]:
            all_docs.extend(load_markdown_file(path))

    if not all_docs:
        print("沒有找到可匯入的知識庫文件")
        return

    client = chromadb.PersistentClient(path=VECTOR_DB_PATH)

    embedding_function = get_embedding_function()

    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_function
    )

    ids = []
    documents = []
    metadatas = []

    for doc in all_docs:
        doc_id = stable_id(doc["id"], doc["content"])
        ids.append(doc_id)
        documents.append(doc["content"])
        metadatas.append(doc["metadata"])

    existing = collection.get()
    if existing and existing.get("ids"):
        collection.delete(ids=existing["ids"])

    collection.add(
        ids=ids,
        documents=documents,
        metadatas=metadatas
    )

    print(f"完成匯入 Chroma Vector DB")
    print(f"知識庫目錄：{KB_DIR}")
    print(f"向量庫路徑：{VECTOR_DB_PATH}")
    print(f"Collection：{COLLECTION_NAME}")
    print(f"匯入筆數：{len(documents)}")


if __name__ == "__main__":
    try:
        ingest()
    except Exception as e:
        print(f"匯入失敗：{e}")
        sys.exit(1)
