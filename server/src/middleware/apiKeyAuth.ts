import type { NextFunction, Request, Response } from "express";

// 外部システムから /api/external/* の各エンドポイントを呼び出す際の認証。
// x-api-key ヘッダが指定した環境変数の値と一致する場合のみ通す。
// 環境変数が未設定の場合は常に拒否する(安全側に倒す)。
// エンドポイントごとに別々のAPIキーを使えるよう、環境変数名を引数で受け取る
// (2026-09-16追加。例: shift-assignmentsはEXTERNAL_API_KEY、staffはSTAFF_API_KEY)。
export function apiKeyAuth(envVarName: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    const expected = process.env[envVarName];
    const provided = req.header("x-api-key");

    if (!expected || provided !== expected) {
      res.status(401).json({ error: "invalid or missing x-api-key" });
      return;
    }

    next();
  };
}
