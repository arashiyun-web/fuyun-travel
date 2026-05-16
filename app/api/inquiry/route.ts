import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type InquiryPayload = {
  name?: string;
  phone?: string;
  date?: string;
  passengers?: string;
  service?: string;
  note?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as InquiryPayload;

    if (!payload.name || !payload.phone) {
      return NextResponse.json(
        { error: "姓名與電話為必填" },
        { status: 400 }
      );
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const to = process.env.INQUIRY_TO_EMAIL || user;
    const from = process.env.INQUIRY_FROM_EMAIL || user;

    if (!host || !user || !pass || !to || !from) {
      return NextResponse.json(
        { error: "尚未設定寄信環境變數" },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass
      }
    });

    const text = [
      "雲驛旅行社 / 雲陞通運 網站詢價",
      "",
      `姓名：${payload.name}`,
      `電話：${payload.phone}`,
      `出發日期：${payload.date || "未填"}`,
      `人數：${payload.passengers || "未填"}`,
      `需求類型：${payload.service || "未填"}`,
      "",
      "行程與備註：",
      payload.note || "未填"
    ].join("\n");

    await transporter.sendMail({
      from,
      to,
      subject: `網站詢價｜${payload.name}｜${payload.service || "包車旅遊"}`,
      text,
      replyTo: from
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "表單送出失敗" },
      { status: 500 }
    );
  }
}
