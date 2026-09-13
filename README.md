# 異世界Truck Crash!! — 公開版 v0.1

角度とパワーを決めて勇者を飛ばし、街道の仲間とSPECIALで飛距離を伸ばす軽量ブラウザゲームです。図形・文字のみで描画し、画像・音声・外部ライブラリ・外部通信は使いません。

## 操作

1. START → タップで角度決定 → タップでパワー決定・発射。
2. 空中で画面タップ / UPボタン：上昇、1プレイ3回。
3. Space / DOWNボタン：下降、クールダウン1.5秒。
4. SPECIAL!受付中はタップ / Enterで成功。受付は共通1.0秒。UPは消費しません。受付中のDOWNは無効です。
5. 停止するとRESULT。RETRYで再挑戦。

SPECIAL条件：僧侶（STOPPER）への接触速度87.5 m/s以上、武闘家（BOUNCE）への接触時の飛距離200 m以上、戦士（DASH）への接触水平速度50 m/s以下。結界（GUARD）はBRAKE・STOPPERの悪影響を優先して1回防ぎます。

自己ベストは同じブラウザ・同じオリジンのlocalStorageに保存します。プライベートモードや保存制限時もゲームは続きます。ローカルプレビューと公開URLの記録は別です。

## 職業と描画

| ID | 表示 | 特徴 |
| --- | --- | --- |
| HERO | 勇者（男） | 剣・盾・マント |
| BOOST | 魔法使い（女） | とんがり帽子・杖・爆風 |
| BOUNCE | 武闘家（女） | 鉢巻・拳・蹴り上げ |
| BRAKE | 遊び人（男） | 二股帽子・大ボケ |
| ANGLE | 盗賊（女） | フード・ワイヤーフック |
| DASH | 戦士（女） | 兜・大剣・突進線 |
| GUARD | 賢者（女） | 高帽・本・結界 |
| STOPPER | 僧侶（女） | 法帽・輪の杖・制止の輪 |
| SPECIAL_ONLY | 商人（女） | 帽子・バッグ。表示定義のみ、通常出現なし |

`js/graphics.js` の `Hop.CAST` に名称・色・性別・シルエット・演出名・将来のasset枠を集約しています。画像への差し替えは描画側で行い、ゲームのIDと当たり判定を維持してください。物理とSPECIAL設定は `js/config.js`、ゲーム処理は `js/game.js` / `physics.js` / `input.js` に分離しています。

## ローカル起動

ビルド不要。HTTPプレビューを推奨します。Pythonがある場合、このフォルダで `python -m http.server 8000 --bind 127.0.0.1` を実行し、`http://127.0.0.1:8000/` を開きます。終了はCtrl+C。

Node.jsがある場合は `node tests/release.cjs --serve` でもプレビューできます。`http://127.0.0.1:8765/NANACACRASH/` を開きます。

`index.html` の直接表示も可能ですが、ゲームはfile://専用の処理に依存していません。通常の静的HTTP/HTTPS配信で動作します。遊ぶ側にNode.js・Python・npm・ビルドは不要です。

## GitHub Pages公開（今回未実施）

1. 公開するリポジトリのルートに `index.html`、`css/`、`js/`、`.nojekyll` を置きます。
2. 公開時に選んだブランチへcommit・pushします。
3. GitHubのSettings → Pages → Build and deploymentで「Deploy from a branch」、対象ブランチ、`/(root)` を選び保存します。
4. 配備完了後のURLでSTART、スマホ操作、SPECIAL、RETRY、記録保存を最終確認します。

パスはすべて相対パスで、`https://ユーザー.github.io/リポジトリ/` のようなサブパスに対応します。独自サーバーやAPIは不要です。公開手順は[GitHub公式ドキュメント](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)を参照してください。

## テスト

- `node tests/phase2.cjs`：物理・AERIAL・入力・停止の回帰テスト。
- `node tests/phase3.cjs`：上記に加え、7種類・SPECIAL・GUARD・保存・DEBUG・リセット。
- `node tests/release.cjs`：上記に加え、公開版の描画・相対パス・元ロジックのSHA-256照合。
- `node tests/release.cjs --serve`：サブパスのプレビュー。`/NANACACRASH/qa.html` は検証専用で、職業一覧と任意SPECIALを表示できます。QAプレイは保存しません。

ゲーム中のDキーでDEBUG切替。DEBUGは固定順序で配置します。一度でもDEBUGを使ったプレイは記録対象外です。テスト用のサーバー・QA画面はGitHub Pagesには必要ありません。
