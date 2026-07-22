import { NextResponse } from "next/server";
import { saveOrder } from "../../../lib/orders";

function cleanEnv(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function createOrderId() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `CT${v.year}${v.month}${v.day}${v.hour}${v.minute}${v.second}`;
}

export async function POST(req) {
  try {
    const data = await req.json();
    const required = ["date", "product", "size", "pickupTime", "name", "phone", "paymentMethod"];
    for (const key of required) {
      if (!String(data[key] || "").trim()) {
        return NextResponse.json({ error: "請完整填寫所有必填欄位。" }, { status: 400 });
      }
    }

    const token = cleanEnv(process.env.LINE_CHANNEL_ACCESS_TOKEN);
    const to = cleanEnv(process.env.LINE_ADMIN_USER_ID);
    if (!token) return NextResponse.json({ error: "網站尚未設定 LINE Token。" }, { status: 500 });
    if (!to) return NextResponse.json({ error: "網站尚未設定 LINE 收件人 User ID。" }, { status: 500 });

    const orderId = createOrderId();
    const paymentLabel = data.paymentMethod === "bank" ? "銀行匯款（待確認）" : "現場付款（現金）";
    const text = [
      "🎂 初甜趣｜網站新訂單",
      "────────────",
      `訂單編號：${orderId}`,
      `取貨日期：${String(data.date).trim()}`,
      `取貨時間：${String(data.pickupTime).trim()}`,
      `品項：${String(data.product).trim()}`,
      `尺寸：${String(data.size).trim()}`,
      `用途：${String(data.occasion || "未填").trim() || "未填"}`,
      `享用人數：${String(data.people || "未填").trim() || "未填"}`,
      `付款方式：${paymentLabel}`,
      `姓名：${String(data.name).trim()}`,
      `電話：${String(data.phone).trim()}`,
      `LINE 名稱：${String(data.lineName || "未填").trim() || "未填"}`,
      `備註：${String(data.note || "無").trim() || "無"}`,
      "────────────",
      "請盡快與客人確認，確認後訂單才正式成立。",
    ].join("\n");

    const order = {
      orderId,
      date: String(data.date).trim(),
      pickupTime: String(data.pickupTime).trim(),
      product: String(data.product).trim(),
      size: String(data.size).trim(),
      occasion: String(data.occasion || "").trim(),
      people: String(data.people || "").trim(),
      paymentMethod: data.paymentMethod,
      paymentLabel,
      name: String(data.name).trim(),
      phone: String(data.phone).trim(),
      lineName: String(data.lineName || "").trim(),
      note: String(data.note || "").trim(),
      status: data.paymentMethod === "bank" ? "待匯款" : "待確認",
      createdAt: new Date().toISOString(),
    };

    // 先確認店家確實收到 LINE 通知；只有 LINE 成功才對客戶回傳成功。
    const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
      cache: "no-store",
    });
    const lineBody = await lineResponse.text();

    if (!lineResponse.ok) {
      console.error("LINE push failed", lineResponse.status, lineBody);
      if (lineResponse.status === 401) {
        return NextResponse.json({ error: "LINE Token 無效或已失效，請重新發行後更新 Vercel。" }, { status: 502 });
      }
      if (lineResponse.status === 400) {
        return NextResponse.json({ error: "LINE User ID 不正確，或你尚未加入官方帳號好友。" }, { status: 502 });
      }
      return NextResponse.json({ error: `LINE 通知傳送失敗（${lineResponse.status}）。` }, { status: 502 });
    }

    // LINE 已成功送達後，再嘗試寫入後台。Redis 故障不會讓客戶誤以為未送達。
    let savedToBackend = false;
    try {
      savedToBackend = await saveOrder(order);
      if (!savedToBackend) {
        console.warn("Order delivered to LINE, but Redis is not configured", orderId);
      }
    } catch (redisError) {
      console.error("Order delivered to LINE, but Redis save failed", redisError);
    }

    return NextResponse.json({
      ok: true,
      orderId,
      savedToBackend,
      message: "訂單資料已送達店家，須待店家確認後才正式成立。",
    });
  } catch (error) {
    console.error("Order API error", error);
    return NextResponse.json({ error: "訂單送出失敗，請稍後再試或直接電話聯絡店家。" }, { status: 500 });
  }
}
