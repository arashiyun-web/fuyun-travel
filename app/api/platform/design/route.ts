import { NextResponse } from "next/server";
import { apiDesign, platformEntities } from "@/lib/platformSchema";

export async function GET() {
  return NextResponse.json({
    success: true,
    entities: platformEntities,
    apis: apiDesign,
    futureReadyFor: ["多旅行社", "多車隊", "多司機", "多供應商", "AI Agent", "RAG", "n8n", "LINE OA"],
  });
}
