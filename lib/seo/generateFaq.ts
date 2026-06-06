export function generateFaq(topic: string, context = "包車旅遊") {
  return [
    {
      question: `${topic} 適合包車旅遊嗎？`,
      answer: `適合。${topic} 可依人數、行李、停靠點與旅遊節奏安排九人座、中巴或遊覽車。`,
    },
    {
      question: `${topic} 詢價要提供哪些資料？`,
      answer: "建議提供日期、人數、上車地點、目的地、停靠點、行李數與特殊需求。",
    },
    {
      question: `${topic} 可以安排長輩或親子友善行程嗎？`,
      answer: "可以。可降低步行量、增加休息點，並調整用餐與停留時間。",
    },
    {
      question: `${topic} 適合企業旅遊或校外教學嗎？`,
      answer: "可依活動性質安排分車、集合時間、保險資料與單一聯絡窗口。",
    },
    {
      question: `${topic} 可搭配 LINE 詢問嗎？`,
      answer: `可以。可透過 LINE 或詢價表單提供 ${context} 需求，客服會協助確認。`,
    },
  ];
}
