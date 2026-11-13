import { servePublic } from '@/lib/aiApi/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return servePublic(request, 'get_quote'); }
