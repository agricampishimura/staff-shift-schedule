# 職員シフト作成サポート

福祉施設の職員シフト作成を支援するシステム。詳細な要件・アーキテクチャ方針は [CLAUDE.md](CLAUDE.md) を参照。

## セットアップ

```bash
# server
cd server
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev

# client(別ターミナル)
cd client
npm install
npm run dev
```

- server: http://localhost:3011
- client: http://localhost:5173(空いていない場合はViteが自動で別ポートを使用)
