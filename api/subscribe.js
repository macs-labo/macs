import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // OPTIONS メソッドへの応答（vercel.json でヘッダーが設定されるため、ここではステータスを返すのみ）
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. 購読登録 (POST)
    if (req.method === 'POST') {
      const subscription = req.body;
      if (!subscription?.endpoint) return res.status(400).json({ error: "Endpoint required" });
      await kv.set(subscription.endpoint, JSON.stringify(subscription));
      return res.status(200).json({ success: true });
    }

    // 2. 購読解除 (DELETE)
    if (req.method === 'DELETE') {
      const { endpoint } = req.body || {};
      if (endpoint) {
        await kv.del(endpoint);
        return res.status(200).json({ success: true, message: "Unsubscribed" });
      }
      return res.status(400).json({ error: "Endpoint required" });
    }

    // 3. 一覧取得 (GET)
    if (req.method === 'GET') {
      const keys = await kv.keys('*');
      if (keys.length === 0) return res.status(200).json([]);
      const subs = await Promise.all(keys.map(k => kv.get(k)));
      return res.status(200).json(subs);
    }
  } catch (error) {
    console.error('KV Storage Error:', error);
    return res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
}