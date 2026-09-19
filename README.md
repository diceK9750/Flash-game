# 異世界Truck Crash!! — 公開版 v0.2

角度とパワーを決めて勇者を飛ばし、街道の仲間とSPECIALで飛距離を伸ばす軽量ブラウザゲームです。Canvas図形・文字と軽量な合成SEだけで構成し、外部素材・外部ライブラリ・外部通信は使いません。

## 操作

ゲーム画面への**1クリック（左）／1タップだけ**で最後まで操作できます。

1. READYでタップ → 角度をタップで固定 → パワーをタップで確定して発射。
2. 飛行中のタップは上昇中ならAERIAL DOWN、下降中ならAERIAL UPを自動選択。
3. UPは3回、DOWNは1.5秒クールダウン。使えないときは何も発動しません。地面・浮遊中も使用不可。
4. SPECIAL受付は1.0秒。タップはSPECIALだけを成功させ、AERIALは同時発動しません。
5. RESULT画面をタップするとRETRYして角度選択から再開します。

判定は垂直速度が+40px/s超でDOWN、−40px/s未満でUP。±40の間は直前モードを維持します。発射直後の既定値はDOWN。操作ボタン・通常キーボード操作はなく、開発用Dキーだけを残しています。

## 通常接触

| 種類 | 効果 |
| --- | --- |
| BOOST | 現在速度へ800px/s・45°のベクトルを加算 |
| BOUNCE | 880px/s・60°を加算（BOOSTの1.10倍） |
| DASH | 880px/s・25°を加算（BOOSTの1.10倍） |
| BRAKE | vx・vyとも50%。方向を維持 |
| ANGLE | 速度量を完全維持し、90°−abs(現在角)の前方上向きへ。下降30°も上向き60°になる |
| GUARD | normalGuard ×1を付与 |
| STOPPER | 強制停止。防御・SPECIAL・Type B復活を優先 |

## 正式SPECIAL条件

未使用キャラクターをx座標順に見て、間に別キャラクターがいない組を「隣接」とします。

| SPECIAL | 条件 | 成功時の初期速度・角度 |
| --- | --- | --- |
| BOOST / 爆裂斜光 | BOOST→BOUNCEの先頭に接触 | 2000 px/s・45° |
| BOUNCE / 連天蹴り | BOUNCE→BOOSTの先頭に接触 | 1700 px/s・60° |
| DASH / 戦陣突破 | DASH後、BOOST・BOUNCE・STOPPERに触れず再DASH | 2000 px/s・25° |
| STOPPER / 聖光反転 | BOOST・BOUNCE・DASH後、地面バウンド・GUARD接触なしでSTOPPER | 2300 px/s・35° |
| BRAKE / 影すり抜け | AERIAL DOWN成功後、地面・他キャラ・UPなしでBRAKE | 接触前の速度・角度を完全維持 |
| ANGLE / 水平曲芸 | 接触時10%抽選（Gameのrandomを使用） | 速度量を維持して0°へ |
| GUARD / 聖護結界 | normalGuard所持で次の相手がGUARD | STOPPER専用防御10秒 |

ペアSPECIAL成功時は相手も使用済みになります。失敗時は接触元の通常効果だけ適用し、相手を残します。DASH準備は地面・BRAKE・ANGLE・GUARDでは解除されず、SPECIAL受付開始・成功・失敗で解除されます。STOPPER準備はBRAKE・ANGLEでは解除されず、地面バウンド・GUARD・STOPPERで解除されます。旧仕様の速度・飛距離しきい値は使用しません。

BRAKE準備に時間制限はありません。地面バウンド、BRAKE以外への接触、UP成功、BRAKE受付開始、RETRYで解除します。BRAKE失敗は通常50%減速、ANGLE失敗は通常の相補角への変更です。

### 2種類のGUARD

normalGuardは次の誰か1人への接触で必ず終了します。BOOST・BOUNCE・DASH・STOPPERを防ぎ、BRAKE・ANGLEは防ぎません。SPECIAL判定は接触直前の保持状態で行い、受付後は通常GUARDを持ち越しません。失敗時の防御も、その接触に確保した1回分だけを使用します。

GUARD SPECIALはSTOPPERの通常効果だけを1回防ぐか、プレイ可能時間10秒で消滅します。STOPPER SPECIAL成功時は温存、失敗時は専用防御で防ぎ消費します。受付・成功／失敗表示・商人登場演出・商人Type C中はタイマー停止。普通の接触エフェクト中は減少します。

専用防御中にGUARDへ再接触しても残時間は更新せず、normalGuardだけを追加します。この場合は両方保持でき、STOPPERに対して通常GUARD→専用防御の順で最大2回防げます。専用防御中の再GUARDではSPECIALを再受付しません。

### 商人SPECIAL

通常配置は7職業だけ。100m整数倍の各地点に1人を配置し、その前後140pxでは追加の通常配置を抑制します。境界キャラも同じ出現率定義を使います。normalGuardまたはGUARD SPECIAL所持で区間最後の10mに到達し、境界ちょうどのBOOST・BOUNCE・DASH・STOPPERへ接触すると商人SPECIAL（1.0秒）。ゾーン内の任意位置では発生しません。

優先順位は **商人SPECIAL → 通常SPECIAL → normalGuard → GUARD SPECIAL → 通常効果**。normalGuardは接触判定後に終了します。GUARD SPECIALは商人の受付・成功では消費せず、商人失敗後の通常STOPPER防御時だけ消費します。失敗で別のSPECIAL受付を開始することはありません。

| 接触先 | 商人効果 | 終了条件 |
| --- | --- | --- |
| STOPPER | Type A / 倍化の秘薬：BOOST・BOUNCE・DASH通常と加速SPECIALの正の加速差分を2倍 | 3イベント |
| DASH | Type B / 蓄光の護符：有利な加速イベントごとにCHARGE、最大10。停止時に650＋CHARGE×115 px/s、40°で一度復活 | 復活後に消滅。通常STOPPERの強制停止も対象 |
| BOOST | Type C / 浮遊の絨毯：高度190px・水平1600px/sで浮遊。接触・AERIAL無効 | 実際にx座標を追い越した100人で終了し、通常BOOSTを1回 |
| BOUNCE | Type D / 弾跳の靴：地面衝突前速度の1.2倍を基準に加速バウンド | 地面衝突5回。6回目から通常反発 |

商人効果は1種類だけ保持し、新規獲得で旧カウンターごと上書きします。Type Aは最終速度の倍化ではなく加速差分の倍化で、発射・AERIAL・ANGLE・通常地面反発等は対象外です。すべての加速に既存の安全上限（水平2000・垂直1500 px/s）を適用します。数値は `js/config.js` で調整できます。RETRYで準備状態・商人効果・接触履歴を初期化します。

A/BのSPECIAL対象はBOOST・BOUNCE・DASH・STOPPERのみ。BRAKE・ANGLE・GUARD SPECIALは回数やCHARGEを消費・追加しません。ANGLE通常／SPECIALは加速ではなく速度保存の回転なので成分別クランプを行いません（成分が加速上限を超える場合がありますが、回転自体は速度量を増やしません）。次の加速時には通常上限が適用されます。

合成SEは `js/audio.js` に分離しています。最初の画面入力でAudioContextを開始し、通常成功・STOPPER専用・GUARD専用の音を鳴らします。STOPPERは白金フラッシュ・強い残像・大きなリングも表示します。音声不可・開始拒否でもゲームは動作します。

自己ベストは同じブラウザ・同じオリジンのlocalStorageに保存します。プライベートモードや保存制限時もゲームは続きます。ローカルプレビューと公開URLの記録は別です。

## 職業と描画

| ID | 表示 | 特徴 |
| --- | --- | --- |
| HERO | 勇者（男） | 剣・盾・マント |
| BOOST | 魔法使い（女） | とんがり帽子・杖・爆風 |
| BOUNCE | 武闘家（女） | 鉢巻・拳・蹴り上げ |
| BRAKE | 盗賊（男） | 赤いフード・ワイヤーフック |
| ANGLE | 遊び人（男） | 黄色い二股帽子・曲芸 |
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
- `node tests/guard-special.cjs`：通常ベクトル・新SPECIAL・2種類のGUARD・タイマー停止・商人との統合。
- `node tests/controls.cjs`：1入力・ヒステリシス・旧操作無効・音声不可時の安全性。
- `node tests/release.cjs`：全テストに加え、描画・相対パス・維持した物理設定を照合。
- `node tests/release.cjs --serve`：`/NANACACRASH/qa.html` は検証専用。シナリオを選択して「準備」で通常効果・7SPECIAL・商人A〜D・BRAKE準備・GUARD期限／二重防御／浮遊中の時間停止を再現します。準備時は時間停止し、画面タップでSPECIAL成功、「再生」でタイマーを再開してMISSを確認できます。「次の通常STOPPER」「次のGUARD」で防御の順序も確認できます。QAプレイは保存しません。

ゲーム中のDキーでDEBUG切替。DEBUGは従来の固定順序・間隔を維持し、追加の100m境界生成を行いません。OFFで通常の境界＋ランダム生成に戻ります。一度でもDEBUGを使ったプレイは記録対象外です。テスト用のサーバー・QA画面はGitHub Pagesには必要ありません。
