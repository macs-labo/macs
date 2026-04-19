import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS 設定（各サイトからの呼び出し用）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1. 購読登録 (POST)
  if (req.method === 'POST') {
    const subscription = req.body;
    await kv.set(subscription.endpoint, JSON.stringify(subscription));
    return res.status(200).json({ success: true });
  }

  // 2. 購読解除 (DELETE)
  if (req.method === 'DELETE') {
    const { endpoint } = req.body; // クライアントから解除したい endpoint を送る
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
}