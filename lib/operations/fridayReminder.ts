import { exactTrue } from "@/lib/liveSwitch";

type ReminderResult = { sent: true } | { sent: false; reason: "disabled" | "missing_configuration" | "invalid_private_recipient" | "delivery_failed" };

/** Reminder only. No content sync, approval, website writes or social publication. */
export async function sendFridayHighlightsReminder(): Promise<ReminderResult> {
  if (!exactTrue(process.env.FRIDAY_TELEGRAM_REMIND_ENABLED)) return { sent: false, reason: "disabled" };
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_BOSS_CHAT_ID?.trim();
  if (!botToken || !chatId) return { sent: false, reason: "missing_configuration" };
  // Telegram private user chats have positive numeric ids. Reject groups, channels and recipient lists.
  if (!/^[1-9]\d{0,15}$/.test(chatId)) return { sent: false, reason: "invalid_private_recipient" };
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "該整理小羽旅遊趣新貼文、送待審" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { sent: false, reason: "delivery_failed" };
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) return { sent: false, reason: "delivery_failed" };
    return { sent: true };
  } catch {
    // Errors and upstream response bodies can contain the bot token or recipient. Never echo or log them.
    return { sent: false, reason: "delivery_failed" };
  }
}
