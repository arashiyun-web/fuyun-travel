import { NextResponse } from "next/server";

export function verifyAdminRequest(request: Request) {
  const configured = process.env.ADMIN_ACCESS_TOKEN;
  if (!configured) return false;

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("admin_token");
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  return queryToken === configured || bearer === configured;
}

export function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}
