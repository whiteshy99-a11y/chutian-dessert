import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const data = await req.json();
    const required = ["date", "product", "size", "pickupTime", "name", "phone"];

    for (const key of required) {
      if (!String(data[key] || "").trim()) {
        return NextResponse.json({ error: "請完整填寫所有必填欄位。" }, { status: 400 });
      }
    }

    const token = String(process.env.LINE_CHANNEL_ACCESS_TOKEN || "")
      .replace(/\s+/g, "")
      .trim();
    const to = String(process.env.LINE_ADMIN_USER_ID || "")
      .replace(/\s+/g, "")
      .trim();

    if (!token) {
      return NextResponse.json({ error: "網站尚未設定 LINE Token。" }, { status: 500 });
    }
    if (!to) {
      return NextResponse.json({ error: "網站尚未設定 LINE 收件人 User ID。" }, { status: 500 });
    }

    const text = [
      "🎂 初甜趣｜網站新訂單",
      "────────────",
      `取貨日期：${String(data.date).trim()}`,
      `取貨時間：${String(data.pickupTime).trim()}`,
      `品項：${String(data.product).trim()}`,
      `尺寸：${String(data.size).trim()}`,
      `姓名：${String(data.name).trim()}`,
      `電話：${String(data.phone).trim()}`,
      `LINE 名稱：${String(data.lineName || "未填").trim() || "未填"}`,
      `備註：${String(data.note || "無").trim() || "無"}`,
      "────────────",
      "請盡快與客人確認，確認後訂單才正式成立。"
    ].join("\n");

    const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        to,
        messages: [{ type: "text", text }]
      }),
      cache: "no-store"
    });

    const lineBody = await lineResponse.text();

    if (!lineResponse.ok) {
      console.error("LINE push failed", lineResponse.status, lineBody);

      if (lineResponse.status === 401) {
        return NextResponse.json(
          { error: "LINE Token 無效或已失效，請重新發行後更新 Vercel。" },
          { status: 502 }
        );
      }

      if (lineResponse.status === 400) {
        return NextResponse.json(
          { error: "LINE User ID 不正確，或你尚未加入官方帳號好友。" },
          { status: 502 }
        );
      }

      return NextResponse.json(
        { error: `LINE 通知傳送失敗（${lineResponse.status}）。` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Order API error", error);
    return NextResponse.json(
      { error: "訂單送出失敗，請稍後再試或直接電話聯絡店家。" },
      { status: 500 }
    );
  }
}
