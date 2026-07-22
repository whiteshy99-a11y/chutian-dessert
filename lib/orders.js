function cleanEnv(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

async function redis(command) {
  const url = cleanEnv(process.env.UPSTASH_REDIS_REST_URL);
  const token = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token) return null;

  const r = await fetch(`${url}/${command.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Redis request failed (${r.status}): ${body.slice(0, 300)}`);
  }
  return r.json();
}

export async function saveOrder(order) {
  const key = `chutian:order:${order.orderId}`;
  const indexKey = "chutian:orders";
  const saved = await redis(["set", key, JSON.stringify(order)]);
  if (!saved) return false;
  await redis(["lpush", indexKey, order.orderId]);
  await redis(["ltrim", indexKey, "0", "499"]);
  return true;
}

export async function getOrders() {
  const list = await redis(["lrange", "chutian:orders", "0", "499"]);
  if (!list?.result?.length) return [];
  const orders = [];
  for (const id of list.result) {
    const item = await redis(["get", `chutian:order:${id}`]);
    if (item?.result) orders.push(JSON.parse(item.result));
  }
  return orders;
}

export async function updateOrderStatus(orderId, status) {
  const item = await redis(["get", `chutian:order:${orderId}`]);
  if (!item?.result) throw new Error("找不到訂單");
  const order = { ...JSON.parse(item.result), status, updatedAt: new Date().toISOString() };
  await redis(["set", `chutian:order:${orderId}`, JSON.stringify(order)]);
  return order;
}
