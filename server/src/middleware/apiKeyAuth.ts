import type { NextFunction, Request, Response } from "express";

// AgriCamp等の外部システムから /api/external/* を呼び出す際の認証。
// x-api-key ヘッダが EXTERNAL_API_KEY と一致する場合のみ通す。
// EXTERNAL_API_KEY が未設定の環境では常に拒否する(安全側に倒す)。
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.EXTERNAL_API_KEY;
  const provided = req.header("x-api-key");

  if (!expected || provided !== expected) {
    res.status(401).json({ error: "invalid or missing x-api-key" });
    return;
  }

  next();
}
