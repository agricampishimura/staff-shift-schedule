# 2026-09-16 送迎プラン作成サポート向け職員マスタ参照API(GET /api/external/staff)

## 背景

「送迎プラン作成サポート」は現状、自分自身のDBに職員マスタ(Staff)を持っているが、
このプロジェクト(職員シフト作成サポート)側の職員マスタを正として一本化する方針になった。
送迎側は本APIを定期的/手動で呼び出し、取得した一覧で自分のDBを上書き同期する
(一覧に無い職員=退職として過去の情報へ移行する運用のため、在籍ステータスによる
絞り込みは行わず全職員を返す)。

依頼書: `職員シフト作成サポート/staff-api-integration-prompt.md`(送迎側で作成、このプロジェクトの
Claude Codeセッションに貼り付けられたもの)。

## 実装方針: `/api/staff` ではなく `/api/external/staff` にした理由

依頼書はエンドポイントを`GET /api/staff`と指定していたが、このパスは既にこのプロジェクトの
SPA本体(職員マスタ画面等)がAPIキー無しで直接呼び出している内部CRUD API(`server/src/routes/staff.ts`)
であるため、そのまま認証必須化すると自アプリが壊れる。既存の外部連携の慣習(`/api/external/*` +
APIキー認証、`server/src/routes/external.ts`)に合わせ、`GET /api/external/staff`として実装した。

## 認証

- `apiKeyAuth`ミドルウェア(`server/src/middleware/apiKeyAuth.ts`)を、環境変数名を引数に取る
  ファクトリ関数に変更(2026-09-16)。エンドポイントごとに別々のAPIキーを使えるようにするため。
- 既存の`GET /api/external/shift-assignments`は`EXTERNAL_API_KEY`のまま(後方互換)。
- 新規の`GET /api/external/staff`は依頼書どおり`STAFF_API_KEY`環境変数、`X-API-Key`ヘッダで認証する。
- 発行したキー: `.env`参照(このファイルには書かない)。送迎プラン作成サポート側の`.env`にも
  同じ値を設定する必要がある。

## レスポンス仕様との既知の差分(要確認)

依頼書の仕様(`permissionLevel`/`employmentType`/`employmentStatus`必須、`drivingCapacityBand`は
BAND_1〜7の7段階)は、送迎側が過去に把握していたこのプロジェクトのデータモデルを前提にしており、
2026-09-07の実データ反映(`docs/decisions/2026-09-07-driving-capacity-band-real-data.md`)や
2026-09-07の職制区分の任意化より前の仕様である。そのため以下の差分が生じる:

1. **`drivingCapacityBand`**: 内部は`BAND_A`〜`BAND_H`の8段階(Hは「運転不可」)。
   依頼書の7段階(`BAND_1`〜`BAND_7`)に合わせ`BAND_A→BAND_1`…`BAND_G→BAND_7`と変換して返すが、
   `BAND_H`(運転不可)に対応する値が無いため`null`にしている。情報を失わないよう、
   依頼書に無い追加フィールド`drivingCapacityBandRaw`(内部の生の値。`BAND_H`等)を
   レスポンスに含めている。**送迎側で「運転不可」を判定する必要がある場合、
   `drivingCapacityBand: null`と「本当に未設定」を区別できないため、`drivingCapacityBandRaw`を
   見るよう実装する必要がある**(現時点で実際にBAND_Hの職員が18名中いるため無視できない)。
2. **`employmentType`**: 依頼書は必須(non-null)としているが、内部ではシステム管理者等
   職制の記載が無い職員(2026-09-07に任意化)は`null`になる。実データにも該当者が2名いるため、
   `null`が返るケースを送迎側で許容する必要がある。

対応が必要な場合はこのプロジェクト側の変換ロジック(`server/src/routes/external.ts`)を
見直すか、送迎側の仕様を更新して調整する。

## 動作確認

- 認証無し・誤ったキー → 401
- 正しいキー(`X-API-Key`)→ 200、全32名分を返却(在籍中以外も含む)を確認。
- 既存の`GET /api/external/shift-assignments`(EXTERNAL_API_KEY)への影響が無いことを確認。
