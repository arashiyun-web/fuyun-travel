import type { Metadata } from "next";
import Link from "next/link";
import { explorePageMeta } from "@/lib/travelExplore";
import {
  getKnowledgeByCategory,
  knowledgeCategories,
  type KnowledgeCategory,
} from "@/src/data/knowledge";

export const metadata: Metadata = explorePageMeta({
  title: "台灣旅遊知識庫",
  description: "浮雲輕鬆遊知識庫，整理包車、景點、行程、校外教學、機場接送與常見問題。",
  path: "/knowledge",
});

type KnowledgePageProps = { searchParams: { category?: string } };

function isKnowledgeCategory(value?: string): value is KnowledgeCategory {
  return knowledgeCategories.includes(value as KnowledgeCategory);
}

// The hub reveals entries only after a category is selected, keeping the default page visually quiet.
export default function KnowledgePage({ searchParams }: KnowledgePageProps) {
  const selectedCategory = isKnowledgeCategory(searchParams.category) ? searchParams.category : undefined;
  const selectedEntries = selectedCategory ? getKnowledgeByCategory(selectedCategory) : [];

  return (
    <div className="travel-explore-shell knowledge-hub">
      <header className="knowledge-hub__hero">
        <p className="travel-section__eyebrow">TRAVEL KNOWLEDGE</p>
        <h1>旅遊知識庫</h1>
        <span>提供旅客、搜尋引擎與 AI 客服使用的結構化旅遊資訊。</span>
      </header>

      <section className="knowledge-grid" aria-label="知識庫分類">
        {knowledgeCategories.map((category, index) => {
          const count = getKnowledgeByCategory(category).length;
          return (
            <Link
              className={selectedCategory === category ? "is-active" : ""}
              aria-current={selectedCategory === category ? "page" : undefined}
              href={`/knowledge?category=${encodeURIComponent(category)}`}
              key={category}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{category}</h2>
              <p>{count > 0 ? `${count} 則決策型知識` : "FAQ 整合於各篇知識卡"}</p>
            </Link>
          );
        })}
      </section>

      {selectedCategory ? (
        <section className="knowledge-selection" aria-labelledby="knowledge-selection-title">
          <div>
            <p className="travel-section__eyebrow">SELECTED CATEGORY</p>
            <h2 id="knowledge-selection-title">{selectedCategory}</h2>
          </div>
          {selectedEntries.length > 0 ? (
            <div className="knowledge-selection__links">
              {selectedEntries.map((entry) => (
                <Link href={`/knowledge/${entry.slug}`} key={entry.slug}>
                  <span>{entry.title}</span>
                  <small>{entry.description}</small>
                  <strong aria-hidden="true">→</strong>
                </Link>
              ))}
            </div>
          ) : (
            <p className="knowledge-selection__empty">
              常見問題已整合到每篇知識卡，讓答案保留在對應決策情境中。
            </p>
          )}
        </section>
      ) : null}

      <Link className="travel-back-link" href="/travel">← 返回旅遊探索中心</Link>
    </div>
  );
}
