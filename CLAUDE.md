# 職員シフト作成サポート — 開発ガイド(CLAUDE.md)

このファイルは Claude Code セッション開始時に自動で読み込まれる。作業前に必ず目を通すこと。

## プロジェクト概要

福祉施設(就労支援・放課後デイ等、複数事業所)の職員シフト作成を支援するシステム。現状はExcel等で毎月手作業により作成している([参考資料/全員　出勤表R8-9.pdf](../参考資料/全員　出勤表R8-9.pdf)が現行の出力イメージ)。

- **要件定義の正本(v0.1ドラフト)**: [docs/requirements-v0.1-draft.md](docs/requirements-v0.1-draft.md)。ヒアリング未実施の項目は「未確定」と明記してある。以後の仕様変更はまずこのファイルを更新する。
- **経緯・スコープ決定の記録**: [docs/decisions/2026-09-07-project-kickoff.md](docs/decisions/2026-09-07-project-kickoff.md)。
- [docs/decisions/2026-09-16-confirmed-shift-excel-export.md](docs/decisions/2026-09-16-confirmed-shift-excel-export.md) — シフト確定時のExcel出力(全体/内訳2シート)、共有ドライブ(`Z:\アソシエイト共有書類\全員出勤表\シフト表`)への保存、編集制限パスワード(シート保護)。
- [docs/decisions/2026-09-16-external-staff-api.md](docs/decisions/2026-09-16-external-staff-api.md) — 送迎プラン作成サポート向け職員マスタ参照API(`GET /api/external/staff`、`STAFF_API_KEY`)。`drivingCapacityBand`(8段階→7段階)・`employmentType`(nullable)の仕様差分に注意。

## 経緯(重要)

- 元々は「送迎プラン作成サポート」の要件定義で「④職員シフト管理機能」として構想されていたコンポーネント。
- 2026-09-02、送迎プラン作成サポート側でスコープ外化(職員シフトは月次でPDF/画像を外部取込する運用に変更)。
- 2026-09-07、**独立したプロジェクトとして本プロジェクトを新規発足**。

## アーキテクチャ方針(2026-09-07確定)

- **AgriCamp(`アプリ制作2026/アグリキャンプ/ソースコード/agricamp`)、送迎プラン作成サポート(`アプリ制作2026/送迎プラン作成サポート`)のいずれとも完全に独立したプロジェクト**として、この `code/` 配下に構築する。DB・認証・コードベースは一切共有しない。
- **AgriCampからは「外部から利用できるコンポーネント」として、APIキー認証付きの外部API(`/api/external/*`)経由でのみ連携する。** AgriCamp本体のSupabase/5層アーキテクチャには組み込まない。連携仕様(データ範囲・利用目的)は今後AgriCamp側と調整する。
- Staff(職員)・Facility(事業所)マスタはこのプロジェクト内にローカルで持つ。送迎プラン作成サポート側のStaffマスタ・AgriCamp側の職員データとはIDが対応しない(自動名寄せは行わない前提)。

## 技術スタック

送迎プラン作成サポートと同系統の構成を採用(開発効率・保守性のため):

| 領域 | 技術 |
| --- | --- |
| フロントエンド | React + TypeScript + Vite(`client/`) |
| バックエンド | Node.js + TypeScript + Express(`server/`) |
| ORM/DB | Prisma + SQLite(開発)。本番は PostgreSQL へ切り替え想定。Prisma は v6系に固定(v7で `datasource url` が廃止されたため) |
| 外部連携 | AgriCamp向け参照API(`/api/external/shift-assignments`)・送迎プラン作成サポート向け職員マスタ参照API(`/api/external/staff`)。x-api-keyヘッダによる認証(エンドポイントごとに別の環境変数) |

## ディレクトリ構成

```
code/
  docs/
    requirements-v0.1-draft.md     要件定義の正本(v0.1ドラフト)
    decisions/                     設計変更・経緯の記録
  server/                          Express + TypeScript API
    prisma/schema.prisma           データモデル(Facility, Staff, RequiredStaffing, ShiftAssignment)
    src/index.ts                   エントリポイント
    src/middleware/apiKeyAuth.ts   外部API用のAPIキー認証
    src/routes/                    facilities.ts, staff.ts, requiredStaffing.ts,
                                    shiftAssignments.ts, external.ts
  client/                          React + TypeScript + Vite
    src/App.tsx                    トップナビ(シフト作成/職員マスタ/事業所マスタ/必要配置人数マスタ)
    src/{Staff,Facilities,RequiredStaffing,ShiftAssignments}Section.tsx  各画面
    src/api.ts                     fetchラッパー
    src/types.ts                   型定義・選択肢の日本語ラベル
```

## データモデルの実装状況

`server/prisma/schema.prisma` に以下を実装済み(キックオフ時点の初期実装):

- `Facility`(事業所マスタ、シンプルな名称のみ)
- `Staff`(職員マスタ。氏名・権限設定・職制区分・在籍ステータス・運転可能量区分・電話番号・メールアドレス。[参考資料/職員情報マスター登録の内容について...txt](../参考資料/職員情報マスター登録の内容について以下の項目を登録項目とする改修を行っ.txt) 準拠)
- `RequiredStaffing`(必要配置人数マスタ。**現状は事業所×曜日の固定値のみ**。当日利用人数に応じた変動ルールは未実装、今後の検討事項)
- `ShiftAssignment`(職員シフト割当。日付・職員・事業所・時間帯・状態(下書き/確定))

命名は Prisma 慣習の camelCase に変換。enumの日本語選択肢は英語識別子にマッピングしている(`client/src/types.ts` の `*_LABELS` でUI表示用に日本語へ戻す)。

## API実装状況(キックオフ時点)

- `/api/facilities`, `/api/staff`, `/api/required-staffing`, `/api/shift-assignments`: 基本CRUD。
- `/api/external/shift-assignments`(GET、`month=YYYY-MM`必須、`facilityId`任意): 確定(CONFIRMED)シフトのみ返す。`x-api-key` ヘッダが `EXTERNAL_API_KEY` 環境変数と一致しないと401。
- `/api/external/staff`(GET、2026-09-16追加): 送迎プラン作成サポート向け。在籍ステータス問わず全職員を返す。`x-api-key` ヘッダが `STAFF_API_KEY` 環境変数と一致しないと401。仕様差分は[decisions/2026-09-16-external-staff-api.md](docs/decisions/2026-09-16-external-staff-api.md)参照。
- 未着手: 認証(職員向けマジックリンク+SMS OTP)、LINE連携、法定労働時間チェック、必要配置人数の変動ロジック、AgriCampとの実連携仕様確定。

## セットアップ・起動方法

```bash
# server
cd server
cp .env.example .env   # 初回のみ。EXTERNAL_API_KEYも設定するとdev環境で外部APIを試せる
npm install
npx prisma migrate dev   # 初回のみ(DB作成)
npm run dev               # http://localhost:3011

# client(別ターミナル)
cd client
npm install
npm run dev               # http://localhost:5173 (vite proxyで /api を server(3011)に転送)
```

## 開発時の留意点

- **本プロジェクトはAgriCamp・送迎プラン作成サポートのDBに一切書き込まない・読み込まない**。連携が必要になった場合も、必ずHTTP API経由(かつAPIキー認証)にすること。直接DB参照やコード共有は行わない。
- 必要配置人数・法定労働時間まわりは未確定事項が多い。実装時に仕様を先回りで作り込みすぎず、[docs/requirements-v0.1-draft.md](docs/requirements-v0.1-draft.md) の「未確定事項まとめ」を都度更新すること。
- Prisma v6を使い続ける限り `datasource { url = env("DATABASE_URL") }` 方式で問題ない。v7へ上げる際はmigrate関連コマンドの挙動が変わる点に注意。
