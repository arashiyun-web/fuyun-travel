import { openai } from '@ai-sdk/openai';
import { aiApi, aiDatabase } from '@/lib/aiApi/runtime';
import { notifyBooking } from '@/lib/aiApi/notify';
import { createChatStore } from '@/lib/chat/store';
import { createChatHandler } from '@/lib/chat/handler';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const store = createChatStore(aiDatabase);
export const POST = createChatHandler({
  apiKey: () => process.env.OPENAI_API_KEY,
  modelName: () => process.env.OPENAI_MODEL,
  model: name => openai(name),
  aiApi, store, notify: notifyBooking,
});
