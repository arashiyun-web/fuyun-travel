import { readFile } from "node:fs/promises";

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) {
  console.error("Missing LINE_CHANNEL_ACCESS_TOKEN");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

const richMenu = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: "浮雲輕鬆遊客服選單",
  chatBarText: "服務選單",
  areas: [
    { bounds: { x: 0, y: 0, width: 625, height: 843 }, action: { type: "message", text: "包車" } },
    { bounds: { x: 625, y: 0, width: 625, height: 843 }, action: { type: "message", text: "國旅" } },
    { bounds: { x: 1250, y: 0, width: 625, height: 843 }, action: { type: "message", text: "校外教學" } },
    { bounds: { x: 1875, y: 0, width: 625, height: 843 }, action: { type: "message", text: "機場接送" } },
    { bounds: { x: 0, y: 843, width: 2500, height: 843 }, action: { type: "message", text: "客服" } },
  ],
};

async function lineFetch(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

const created = await lineFetch("https://api.line.me/v2/bot/richmenu", {
  method: "POST",
  headers,
  body: JSON.stringify(richMenu),
});

const image = await readFile("public/line-rich-menu.png");
await fetch(`https://api-data.line.me/v2/bot/richmenu/${created.richMenuId}/content`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "image/png",
  },
  body: image,
}).then(async (response) => {
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
});

await lineFetch(`https://api.line.me/v2/bot/user/all/richmenu/${created.richMenuId}`, {
  method: "POST",
  headers,
});

console.log(`Created and set default rich menu: ${created.richMenuId}`);
