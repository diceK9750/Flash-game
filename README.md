# 異世界Truck Crash!! — 公開版 v0.2

角度とパワーを決めて勇者を飛ばし、街道の仲間とSPECIALで飛距離を伸ばす軽量ブラウザゲームです。図形・文字のみで描画し、画像・音声・外部ライブラリ・外部通信は使いません。

## 操作

1. START → タップで角度決定 → タップでパワー決定・発射。
2. 空中で画面タップ / UPボタン：上昇、1プレイ3回。
3. Space / DOWNボタン：下降、クールダウン1.5秒。
4. SPECIAL!受付中はタップ / Enterで成功。受付は共通1.0秒。UPは消費しません。受付中のDOWNは無効です。
5. 停止するとRESULT。RETRYで再挑戦。

## 正式SPECIAL条件

未使用キャラクターをx座標順に見て、間に別キャラクターがいない組を「隣接」とします。

| SPECIAL | 条件 | 成功時の初期速度・角度 |
| --- | --- | --- |
| BOOST / 爆裂斜光 | BOOST→BOUNCEの先頭に接触 | 2000 px/s・45° |
| BOUNCE / 連天蹴り | BOUNCE→BOOSTの先頭に接触 | 1700 px/s・60° |
| DASH / 戦陣突破 | DASH後、BOOST・BOUNCE・STOPPERに触れず再DASH | 2000 px/s・25° |
| STOPPER / 聖光反転 | BOOST・BOUNCE・DASH後、地面バウンド・GUARD接触なしでSTOPPER | 2300 px/s・35° |

ペアSPECIAL成功時は相手も使用済みになります。失敗時は接触元の通常効果だけ適用し、相手を残します。DASH準備は地面・BRAKE・ANGLE・GUARDでは解除されず、SPECIAL受付開始・成功・失敗で解除されます。STOPPER準備はBRAKE・ANGLEでは解除されず、地面バウンド・GUARD・STOPPERで解除されます。旧仕様の速度・飛距離しきい値は使用しません。

### 商人SPECIAL

通常配置は7職業だけ。100m整数倍の各地点に1人を配置し、その前後140pxでは追加の通常配置を抑制します。境界キャラも同じ出現率定義を使います。GUARD所持で区間最後の10mに到達し、境界ちょうどのBOOST・BOUNCE・DASH・STOPPERへ接触すると商人SPECIAL（1.0秒）。ゾーン内の任意位置では発生しません。

優先順位は **商人SPECIAL → 通常SPECIAL → GUARD BLOCK → 通常効果**。成功時のみGUARDを消費し、通常効果の代わりに下表の効果を獲得します。失敗時は二重受付せず通常処理へ戻り、STOPPERは残ったGUARDで防ぎます。

| 接触先 | 商人効果 | 終了条件 |
| --- | --- | --- |
| STOPPER | Type A / 倍化の秘薬：BOOST・BOUNCE・DASH・通常SPECIAL成功の正の加速量を2倍 | 3イベント |
| DASH | Type B / 蓄光の護符：有利な加速イベントごとにCHARGE、最大10。停止時に650＋CHARGE×115 px/s、40°で一度復活 | 復活後に消滅。通常STOPPERで水平速度が停止しきい値以下になった場合も対象 |
| BOOST | Type C / 浮遊の絨毯：高度190px・水平1600px/sで浮遊。接触・AERIAL無効 | 実際にx座標を追い越した100人で終了し、通常BOOSTを1回 |
| BOUNCE | Type D / 弾跳の靴：地面衝突前速度の1.2倍を基準に加速バウンド | 地面衝突5回。6回目から通常反発 |

商人効果は1種類だけ保持し、新規獲得で旧カウンターごと上書きします。Type Aは最終速度の倍化ではなく加速差分の倍化で、発射・AERIAL・ANGLE・通常地面反発等は対象外です。すべての加速に既存の安全上限（水平2000・垂直1500 px/s）を適用します。数値は `js/config.js` で調整できます。RETRYで準備状態・商人効果・接触履歴を初期化します。

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
| SPECIAL_ONLY | 商人（女） | 帽子・バッグ。商人SPECIAL時のみ登場、通常出現なし |

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
- `node tests/specials.cjs`：正式SPECIAL・準備解除・商人A〜D・境界生成・終了・上書き・入力・RETRY。
- `node tests/release.cjs`：上記に加え、公開版の描画・相対パス・既存の物理設定と入力コードの維持を照合。
- `node tests/release.cjs --serve`：サブパスのプレビュー。`/NANACACRASH/qa.html` は検証専用で、職業一覧・4通常SPECIAL・商人A〜Dを再現できます。各QAボタンは受付で一時停止します。画面タップ / Enterで成功、QA再生でタイマー・飛行を再開し、無入力なら時間切れを確認できます。QA RESULTで統計・中央RETRYも確認できます。QAプレイは保存しません。

ゲーム中のDキーでDEBUG切替。DEBUGは従来の固定順序・間隔を維持し、追加の100m境界生成を行いません。OFFで通常の境界＋ランダム生成に戻ります。一度でもDEBUGを使ったプレイは記録対象外です。テスト用のサーバー・QA画面はGitHub Pagesには必要ありません。
