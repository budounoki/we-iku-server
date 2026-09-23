# サポーター機能 SE引き渡し

## 1. 認証コードの照合

SE回答を正とする：本アプリはLINE・Google・Apple、WebはLINEのみ。
メール・Guestは存在しない。ぶどうの木は専用Googleアカウントを利用する。

照合した基準コミット：
`715f6b9b89c2e438ef7961779102fa7cdaf2e35b`
（Implement dashboard and health monitoring page updates）

照合時の `server/auth.ts` SHA-256：
`5f5348ba88f54dad50729451c482811a26c9ec321dcd2de6adabaae65f1bdaba`
これは改修前の比較基準。今回 `/api/auth/me` の共通ユーザー再読込を追加している。

その版で確認したもの：

| 箇所 | 確認結果 |
|---|---|
| `server/auth.ts` | LINE認可、callbackでtoken/profile検証、LINE LIFF token検証 |
| `shared/schema.ts` の users | 共通numeric ID。外部IDはlineUserId必須・uniqueのみ |
| `client/src/App.tsx` / `Onboarding.tsx` | LINE/LIFFログイン |
| package / source | Google・Apple SDK/検証/callback、native bridgeは未収録 |
| `server/supporter.ts` | セッションuserId→実在users→supporter_accounts / parent_access |

不足しているのは「新しいGoogleログインの発注」ではなく、
**本アプリに既にあるGoogle・Apple認証の実ファイルと接続部分**。
SEは本アプリ版server/auth.ts、そこから参照するprovider検証ファイル、
ユーザー統合処理、native側の既存認証呼び出しをこのWeb版との差分で確認すること。
存在しないファイル名・エンドポイント名は推測していない。

既存認証成功処理が、検証済み主体を共通 `users.id` に解決し、
サーバーが管理する `req.session.userId` に格納する境界から先は実装済み。
Googleのtoken、クライアントが申告するuserId、familyId、roleを直接権限にしない。
本アプリがcookie以外を使う場合は、既存の検証済み認証middlewareとこの境界をSEが接続する。

重要：厳格モードのauth例外リストには、この版で確認できたLINE認証経路しかない。
SE版Google/Appleの**実在する検証済みログイン経路**を、実際のHTTPメソッドとともに
明示的に登録・テストすること。`/api/auth/*` 全体を無条件に許可しない。

## 2. 開発環境での手動操作

開発環境だけに設定済み：

```text
SUPPORTER_ACCESS_ENABLED=true
SUPPORTER_DEV_FIXTURES_ENABLED=true
SUPPORTER_DEV_DATABASE_NAME=heliumdb
```

本番設定は変更していない。SUPPORTER_AUTH_MIGRATION_READYは設定していない。

1. プレビューで `/supporter/development` を開く。
2. 説明を確認し、固定の「架空の親」で開始する。
3. 親の管理画面 `/supporter/manage` で架空児童を選ぶ。
   施設公開コード `BUDOUNOKI-DEV`、開始・終了日時（日本時間）を指定して招待する。
4. 開発入口で「架空の施設」へ切り替え、`/supporter` で招待を受諾する。
5. 対象児童の記録作成・訂正・削除・PDF印刷を操作する。
6. 親へ戻って延長/取消し、施設へ戻ってアクセスを確認する。
   開始前/終了後、重複招待、別児童も確認できる。

開始を現在より少し前にするとすぐ記録できる。睡眠は過去の開始時刻と実睡眠時間を入力し、
終了時刻も現在以前とする。日時は明示的に日本時間で扱う。

同じブラウザのタブはcookieを共有するため、役割切替は他のタブにも影響する。
親と施設を同時に操作するには、別ブラウザプロファイルやシークレットウィンドウを使う。
この入口は新しい本番ログインではない。**Google認証の検証にはならない**。
架空レコードは開発DB内にのみ保存され、役割切替で消去・初期化しない。

## 3. SEが取り込むもの

単一ファイルだけのコピーは不可。関連変更を一式で取り込む。

- 認可/監査/期間：`server/supporter.ts`, `shared/supporter-*.ts`
- 既存ユーザー紐付け：`server/supporter-provisioning.ts`、管理画面のAccountLinking
- 共通ユーザー接続：`server/auth.ts`、middleware/route配線：`server/routes.ts`
- 表・列定義：`shared/schema.ts`。既存ログ取得/ポイント除外：`server/storage.ts`
- 施設/親管理画面、supporter components/lib、App/Settingsの入口
- 親のHome/Dashboard/Timeline/Health等の施設表示・ポイント/件数分離
- 各supporterテストと既存の認可・睡眠回帰テスト
- package/lockfileの日本語フォント依存 `@fontsource/noto-sans-jp` とビルドされるフォント資産
- 開発専用workbenchは本番利用禁止。SE側で除外するならroute/importも一緒に除く

初回追加DB定義の参照：`docs/supporter-development-schema.sql`。
新規5表：supporter_accounts / parent_access / supporter_grants /
supporter_idempotency / supporter_audit_logs。
logsへの追加6列：actor_account_id / supporter_account_id / supporter_grant_id /
care_source / recorder_display_name / deleted_at。
睡眠連携では既存logs.sleep_session_idも必要。
既存記録の推測バックフィル、既存pointsの再計算、session表の削除を行わない。
SQLファイルは開発用の定義資料であり、Agentによる本番実行スクリプトではない。

## 4. 実ユーザーとの紐付けと有効化

1. 本アプリ既存Googleログインで施設アカウントを認証する。
2. SEが実際の共通ユーザーID・既存家族情報への合流を確認する。
3. 管理者画面 `/admin` のサポーター紐付けで、その**既存ユーザー**を施設公開コードに登録。
   Google/LINE/Appleユーザーを新規生成する処理ではない。
   施設名は「ぶどうの木」。公開コードは秘密の認証情報ではない。
4. 親アカウントは管理者が本人/家族/役割を確認し、確認理由付きでparent_accessへ登録。
   自己申告familyIdだけの一括移行は禁止。
5. SE側のステージングで旧APIの本人/家族制限と既存親機能を検証する。
6. 本番スキーマ・バックアップ・復旧手段をSEが確認し、利用者の承認後に反映する。
   Replitで本番DBを管理している場合は公開時の差分確認を用い、
   session表などの削除を承認しない。起動時の独自DDLは追加しない。
7. 最終確認ができた時点でSEが、本番の
   SUPPORTER_ACCESS_ENABLED=true と SUPPORTER_AUTH_MIGRATION_READY=true を設定する。
   **この作業で本番の両設定は変更していない。**
8. 本番にSUPPORTER_DEV_FIXTURES_ENABLEDやSUPPORTER_DEV_DATABASE_NAMEを設定しない。
   NODE_ENVはproduction。開発用セッションからのデータ取得と開発入口は拒否される。

注意：有効化前でも新コードは追加列を参照する。機能フラグだけでは未適用DBとの不整合を防げない。
有効化後は未確認の従来familyId-onlyアクセスを拒否するため、既存親の移行と旧アプリの更新を
先に確認する。反映時には本アプリの既存認証実装をWeb版LINE-onlyファイルで上書きしない。

## 5. 反映後の最終確認

- 実機LINE・Google・Apple、Web LINEで本人/家族情報が正しく合流する
- 施設Googleアカウントは自分宛の招待だけ受諾でき、既存の家族所属を書き換えない
- 親の通常記録・設定・家族変更・ポイント・既存PDFが動く
- サポーターの旧API直アクセス、別児童、開始前日常記録、期限/取消後を拒否する
- 重複期間、終了日時ちょうど、再招待、過去記録非公開、訂正削除履歴が正しい
- 通信断時は保存されず、復旧後に権限を再確認する
- 本アプリのWebView/ブラウザで日本語PDF、複数ページの表、プリンタ出力を確認する
- 印刷用の同梱日本語フォントが配信され、読み込み完了前や失敗時に印刷を進めない
- 保存済みPDFは回収できない。院内保管ルールはアプリが勝手に決めない
- 開発入口/テストセッション/任意userIdによるなりすましが本番で使えない

## 6. 復元

今回の改修前コード：`.local/recovery/supporter-se-baseline.bundle`。
ReplitのチェックポイントまたはSEのコード管理から対象を確認して戻す。
コード控えはDBバックアップではない。新規表は履歴を含むため自動DROPしない。
設定・コード・スキーマの対応を確認して復元する。

## 7. 再現可能な検証

```sh
npm run check
npm run test:supporter
npm run test:supporter:provisioning
npm run test:supporter:development
npm run test:authz
npm run test:supporter:browser
npm run build
```

DBを使う各テストは承認済みテスト専用DBと管理された実行入口が必須。
通常の開発DB・本番DB・既存プレビューには接続しない。
先に docs/test-safety-step1.md の設定・管理画面での確認事項を読むこと。
通常の認可回帰runnerは子プロセスだけ厳格サポーターモードを無効にして、
既存互換動作を検証する。開発プレビューの有効化設定は変更しない。
サポーター/管理者紐付けのテストは厳格middlewareを有効にした別テストで検証する。
開発入口のテストはproduction設定・不一致DB名・任意userId指定を拒否することも確認する。

ブラウザテストには2種類ある：
- supporter-browser：架空API応答による通信断・遅延応答・期間境界などの画面テスト
- supporter-development-browser：架空ユーザーの通常セッションから実API・開発DBを通る操作テスト

後者もGoogle認証は使っていない。本人確認済みの共通ユーザーから先の検証である。