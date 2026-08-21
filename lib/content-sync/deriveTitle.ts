// 從 ContentSyncItem.summary 自動生成一個給 FeaturedSpot 用的短標題／地點。
// 這不是精準的地名擷取，只是去掉常見的敘述性開頭、在第一個標點符號前
// 截斷，給老闆一個可以直接用、也可以再手動編輯的預設值——避免「確認上
// 首頁」流程要求老闆一定要自己先打標題才能送出（這是先前按鈕看起來
// 「按不下去」的根因：標題欄位留空、按鈕沒有明顯提示就被 disabled）。
export function deriveTitleFromSummary(summary: string): string {
  const stripped = summary
    .replace(/^雲惠民帶隊(前往|出遊)/, "")
    .replace(/^社團成員分享/, "");
  const cut = stripped.split(/[，,。（(]/)[0]?.trim();
  return (cut || summary).slice(0, 20);
}
