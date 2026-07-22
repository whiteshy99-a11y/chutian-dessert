# 初甜趣手作甜點 V4

正式營業整合版，包含：

- 2026 年 7–12 月可訂日期月曆
- 滿單／剩少量日期管理
- 現場付款（現金）與銀行匯款
- 連線商業銀行 824／111018312187（不顯示戶名）
- LINE 新訂單通知與 LINE 客服按鈕
- 訂單編號
- 訂單後台、搜尋與狀態管理
- 首頁公告、商品、匯款、地圖、Google 評論連結後台設定

## Vercel 必要環境變數

- `ADMIN_PASSWORD`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_ADMIN_USER_ID`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

沒有 Upstash 時，網站仍可顯示並傳送 LINE 通知，但後台設定與訂單無法永久保存。

## 後台

部署後開啟：`/admin`
