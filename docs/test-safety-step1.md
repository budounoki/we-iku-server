# テストによる本番データへの影響を防ぐ：ステップ1

> この文書はステップ1時点の記録です。現在のDBテストは、新規作成して
> 所有確認する一時PostgreSQL方式に更新されています。
> 手動で接続設定を登録せず、最新の手順は `docs/ephemeral-test-environment.md` を参照してください。

## 今回の範囲

コード変更と、DB・ネットワークを使わない安全確認だけ。
DB接続、DB作成、構造変更、ビルド、既存テスト、ブラウザ操作、
アプリ起動・再起動、環境設定変更、公開は実施しない。

## ビルドとテストの分離

package.json の prebuild にあった自動テストを外した。
通常のビルドからDBを使う認可テストを呼ばない。
既存テストは削除せず、専用の実行入口を通す。
script/build.ts はVite/esbuildによる変換と静的ファイルの配置を行う。
このプロジェクトのビルドコードに、アプリ起動やDB接続の呼出しはない。
依存ライブラリを含む実際のビルド動作は今回未検証。
scripts/post-merge.sh の npm install は別の自動処理であり、今回は実行していない。

## 接続を伴うテストの必須設定（今回は設定しない）

- TEST_DATABASE_URL：管理者が確認したテスト専用DBの接続設定。
- TEST_DATABASE_APPROVED_SHA256：承認した接続先の照合用指紋。
  ホスト、ポート、DB名、接続ユーザー、TLS指定を正規化して照合する。
  パスワードは指紋の対象から除き、出力もしない。
- 通常の DATABASE_URL へは自動的に戻らない。
- BASE_URL、SUPPORTER_DEV_BASE_URL の指定は禁止。localhostも例外ではない。
- REPLIT_DEV_DOMAIN はテスト対象の決定に使わない。

指紋の計算関数は tests/safety/policy.mjs の
databaseTargetFingerprint。管理者が管理画面で対象DBを確認した後、
承認値を別途管理するためのもの。実行のたびに自動承認するためではない。
今回は承認値の作成・登録、実際の接続先の比較は行っていない。

### コードだけでは証明できないこと

専用の変数に入れた接続先が本当に本番と別であることは、
変数名や指紋だけでは証明できない。本番を誤って承認すれば照合は通る。
同じホスト名の転送先・DNS・プロキシが変更される場合も、文字列照合だけでは
データの実体を保証できない。

Database管理画面で開発・本番・テストの実体を区別し、
テスト用ユーザーに本番DBへの権限を与えないことを確認する。
Secrets/環境変数の適用先と、接続先の上書きがないことも確認する。
接続文字列やホスト名、パスワードをチャットに貼らない。

## テスト用サーバーの所有確認

tests/run-managed-tests.mjs が設定を確認した後だけテストを起動する。
認可・ブラウザテストは、実行入口が専用設定で起動したサーバーだけを対象とする。
入口が作る一時的な権限ファイルと起動元の関係を確認し、
個別テストを直接起動して既存アプリへ接続する経路は拒否する。
一般のログイン情報やDB接続設定を子プロセスへ丸ごと引き継がない。
テスト用のセッション秘密情報は実行ごとに生成する。

この確認はLinuxの /proc を使う。確認できない環境では停止する。
コードを改変できる利用者に対する完全な隔離装置ではなく、
通常のテスト操作で誤った接続先を使うことを防ぐ仕組み。

サーバーが実際に待受を開始した通知を、その子プロセスから受け取るまで
HTTPによる確認は行わない。ポート番号の推測やlocalhostへの応答だけで
所有確認をしない。テスト用サーバーはループバックだけで待受し、
同じポートを他のプロセスと共有しない。
子プロセスのホームは実行ごとの専用フォルダに分離し、
通常のホームにあるDBパスワード設定を読み込ませない。

## セッション秘密情報

SESSION_SECRET が未設定・空文字・空白だけなら停止する。
本番だけでなく開発でも固定代替値は使わない。
起動入口ではアプリ・DB関連モジュールを読み込む前に確認し、
認証設定時にもDB操作より前に確認する。
既存の秘密情報は変更していない。
本番公開時には、本番に必要な秘密情報が適用されていることを確認する。
過去のログイン状態を意図せず無効化しないよう、無断で値を変更しない。

## 今回実行できる検証

新設した test:safety は専用の読み込み制限を使う。
純粋な判定処理と架空の文字列だけで確認し、
DB・アプリ・通信・子プロセス用モジュールの読み込みを拒否する。
fetch と WebSocket も通信前に停止させる。
今回の実行では既存の追加読み込み設定も子プロセス限りで除外する。

## 将来、管理画面の確認と実行許可を得てから使うコマンド

以下は今回実行していない。設定が未承認なら停止する。

- npm run test:authz
- npm run test:supporter
- npm run test:supporter:provisioning
- npm run test:supporter:development
- npm run test:supporter:browser

個別ファイルの直接実行や、既存プレビューを使う以前の手順は使用しない。
接続を伴うテストと実際の起動・ビルドの確認は、別途許可を得るまで未実施とする。

## 今回の検証結果

接続しない新規テスト15件が成功。既存の認可テスト、ブラウザテスト、
ビルド、アプリ起動、DB接続は未実施。
テスト起動入口の実際の起動・終了、DBドライバー接続、画面操作の成功は
この結果では保証していない。これらは管理画面の確認と別途の実行許可が必要。
本番のコード・設定は変更していないため、本番にはまだ今回の対策は反映されない。

## 変更ファイル一覧

- package.json
- server/auth.ts
- server/index.ts
- server/session-security.mjs
- tests/run-authz-tests.mjs
- tests/run-managed-tests.mjs
- tests/safety/policy.mjs
- tests/safety/require-managed.mjs
- tests/safety/managed-server.mjs
- tests/safety/server-bootstrap.mjs
- tests/safety/offline-loader.mjs
- tests/safety/offline-lockdown.mjs
- tests/test-safety.unit.test.mjs
- tests/session-security.unit.test.mjs
- tests/offline-boundary.unit.test.mjs
- tests/create-authz.test.mjs
- tests/family-id-rotation.test.mjs
- tests/log-authz.test.mjs
- tests/resource-authz.test.mjs
- tests/sleep-linkage.test.mjs
- tests/supporter-browser.mts
- tests/supporter-browser.test.mts
- tests/supporter-development-browser.test.mts
- tests/supporter-development.test.mts
- tests/supporter-integration.test.mts
- tests/supporter-provisioning.test.mts
- docs/supporter-se-handoff.md
- docs/test-safety-step1.md