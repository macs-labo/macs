// api/subscribe.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const subscription = req.body;
    // エンドポイントをキーとして保存
    await kv.set(subscription.endpoint, JSON.stringify(subscription));
    return res.status(200).json({ success: true });
  }
  
  if (req.method === 'GET') {
    // 全購読者リストを取得（GitHub Actions から叩く用）
    const keys = await kv.keys('*');
    const subs = await Promise.all(keys.map(k => kv.get(k)));
    return res.status(200).json(subs);
  }
}