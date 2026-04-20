import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORSヘッダーの設定
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // OPTIONSメソッド（プリフライト）への応答をコード側でも確実に行う
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // KVの接続確認 (環境変数が不足している場合の早期リターン)
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      throw new Error("KV environment variables are not configured.");
    }

    // 1. 購読登録 (POST)
    if (req.method === 'POST') {
      const subscription = req.body;
      if (!subscription?.endpoint) return res.status(400).json({ error: "Endpoint required" });
      // オブジェクトをそのまま渡すことで、kvライブラリが適切にシリアライズします
      await kv.set(subscription.endpoint, subscription);
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
      // すべてのキーを取得
      const keys = await kv.keys('*');
      if (keys.length === 0) return res.status(200).json([]);
      
      // mget を使用して一括取得することでパフォーマンスを向上
      // キー取得と値取得の間のわずかな時間にデータが削除された場合の null を除外
      const subs = (await kv.mget(...keys)).filter(s => s !== null);
      
      return res.status(200).json(subs);
    }

    // サポート外のメソッドが来た場合に 405 Method Not Allowed を返してハングを防ぐ
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (error) {
    console.error('KV Storage Error:', error);
    return res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
}