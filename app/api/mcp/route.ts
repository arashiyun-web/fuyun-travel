import { serveMcp } from '@/lib/aiApi/mcp';
export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return serveMcp(request); }
export async function GET(request: Request) { return serveMcp(request); }
export async function DELETE(request: Request) { return serveMcp(request); }
