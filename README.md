# 異世界Truck Crash!! — 公開版 v0.2

角度とパワーを決めて勇者を飛ばし、街道の仲間とSPECIALで飛距離を伸ばす軽量ブラウザゲームです。Canvas図形・文字、同梱の勇者スプライトと軽量な合成SEで構成し、外部ライブラリ・外部サービスへの通信は使いません。

## 操作

ゲーム画面への**1クリック（左）／1タップだけ**で最後まで操作できます。

1. READYでタップ → 角度をタップで固定 → パワーをタップで確定して発射。
2. 飛行中のタップは上昇中ならAERIAL DOWN、下降中ならAERIAL UPを自動選択。
3. UPは3回。DOWNは初期100%、使用後0%となり、通常飛行中に自動充電して100%で再使用可能です。初期充電時間は1.5秒（`aerialDownRechargeTime`で調整）。SPECIAL受付・成功／失敗表示・商人登場（merchantVisual）・Type C浮遊中は充電が止まります。ANGLE / POWER / RESULT中も充電しません。使えないときは何も発動しません。地面・浮遊中も使用不可。
4. SPECIAL受付は1.0秒。タップはSPECIALだけを成功させ、AERIALは同時発動しません。
5. RESULT画面をタップするとRETRYして角度選択から再開します。

判定は垂直速度が+40px/s超でDOWN、−40px/s未満でUP。±40の間は直前モードを維持します。発射直後の既定値はDOWN。ゲーム操作ボタン・通常キーボード操作はなく、開発用Dキーだけを残しています。

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

合成SEは `js/audio.js` に分離しています。最初の画面入力でAudioContextを開始し、通常成功・STOPPER専用・GUARD専用の音を鳴らします。STOPPERは白金フラッシュ・強い残像・大きなリングも表示します。音声不可・開始拒否でもゲームは動作します。ヘッダーのSE ON / OFFでミュートを切り替え、設定をlocalStorageへ保存します（保存不可時は起動中のみ保持）。切替ではゲームは進みません。

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

勇者のみ、FLYING中は `js/sprites.js` から同梱の `assets/sprites/hero/flight_loop/hero_flight_loop_sheet_96x96.png` とJSONを相対ロードします。96×96・横8枚・8fps（1秒ループ）、足元pivot (48,88)、表示倍率1.25（セル120×120）、画像補間OFFです。既存の足元座標と回転をそのまま使い、当たり判定は変えません。AERIAL・SPECIAL・バウンド中も同じループを使い、他8職業と飛行以外の勇者は従来のCanvas図形です。ゲームのphaseTimeを再利用し、タブ復帰時の時間リセット・QA一時停止に追従します。動きを減らす設定では先頭フレームを表示します。

AERIAL UP / DOWN成功時は、`assets/sprites/hero/hero_aerial_up_v1_bundle/` と `hero_aerial_down_v1_bundle/` のシート（96×96・横8枚・**12fps・非ループ**、足元pivot (48,88)、表示倍率1.25、画像補間OFF）を1回だけ再生し、終了後（8/12≈0.67秒）にFLIGHT_LOOPへ戻ります。再生中に新しいAERIALが成功すると、その方向（同じ方向を含む）で最初から再生し直します。失敗したAERIALや、地面効果などAERIAL以外の効果では開始しません。FLYING中だけ表示し、READY・角度／パワー選択・RESULTは従来のCanvas勇者です。RETRYでは再生状態を消去します。判定は `js/ui.js` が `game.effect` の新規AERIALを表示用に検出するだけで、ゲーム状態・物理・入力は変更しません。動きを減らす設定では、AERIALの先頭フレームを同じ時間だけ静止表示してから、FLIGHT_LOOPの先頭フレームに戻ります。

GROUND_BOUNCE（勇者の通常の地面バウンド、12fps・非ループ・pivot (48,88)・表示倍率1.25）は v1素材（Grok動画 ground_bounce_v2b の元フレーム 32,38,42,46,50,108,110,112、FLIGHT_LOOPと同じ縮尺）を同梱し、`enabled: true` です。`js/sprites.js` の `GROUND_BOUNCE.enabled: false` にすると画像を要求しなくなり（404やコンソールエラーは出ません）、表示は従来どおりになります。その場合は素材フォルダも外してください（テストがフラグとファイルの一致を確認します）。素材は `assets/sprites/hero/hero_ground_bounce_v1_bundle/`（`hero_ground_bounce.json` と `hero_ground_bounce_sheet_96x96.png`。JSONの形式はAERIALと同じで、animationは `GROUND_BOUNCE`）に置き、`enabled: true` で有効になります。ファイルの有無とフラグが食い違うと `tests/sprites-ground-bounce.cjs` が失敗します。発生条件は、FLYING中の地面接触（body.bounces増加）のうち、反発して再び空中にいるものだけです。最後に転がりへ移る接地と、商人Type DのBOUND BOOSTバウンドでは発生しません（Type D終了後の通常バウンドでは発生します）。AERIALとGROUND_BOUNCEは同じ優先度で、後から起きた方に切り替わり最初から再生します（ただし今の一発アニメが1コマ分＝1/12秒表示されるまでは切り替えません。下の「勇者スプライトの切り替え規則」参照）。GROUND_BOUNCE素材が読めない場合、バウンドしても再生中のAERIALは続きます。検知は画面の更新タイミングで行うため、開始は最大1描画フレーム遅れることがあります。

GROUND_BOUNCEの見え方の調整（表示のみ。物理・当たり判定・状態・効果・入力は変更なし）：検知は反発した後なので、JSONの `sequence`（シートのコマ番号の再生順。省略時は0から順番）を `[4,4,5,5,6,6,7,7]` にし、一番深く潰れたコマ（シート4）から跳ね返り→直立の順に再生します（合計8コマ・12fps・0.667秒は従来どおり。着地コマ0〜3はシートに残していますが再生しません）。GROUND_BOUNCEの再生中は落下速度による勇者の傾きを0にし、終了後0.12秒かけて元の傾きに戻します（AERIAL・素材なし・動きを減らす設定の挙動は従来どおり）。連続再始動は次の2条件で抑えます（どちらも表示のみで、バウンド自体は通常どおり起きます）。(1) GROUND_BOUNCE開始から0.3秒以内の新しいバウンドでは再始動しません。(2) 反発後の滞空時間の見込み（2×vy÷重力）が0.25秒未満の小さな跳ねでは開始しません。根拠は200回分のシミュレーション（通常の空中バウンド1434回）です。前のバウンドとの間隔は5パーセンタイルが0.325秒で、0.3秒未満は1238回中30回でした。滞空時間の見込みは5パーセンタイルが0.217秒で、0.25秒未満は134回でした。0.25秒未満の跳ねでは再生途中で次の接地が来るため、開始しません。AERIALによる割り込みは従来どおり常に即座です。AERIAL再生中のバウンドには0.3秒の制限はかかりません。

HIT（トラックに当たった瞬間、留美子飛び風の吹き飛びポーズ、12fps・非ループ・8コマ・pivot (48,88)・表示倍率1.25、FLIGHT_LOOPと同じ縮尺 1/4.6）は v2素材（Grok動画 hit_v2a の元フレーム 13,18,20,22,26,50,80,120。背中を向けて両手を挙げ、がに股になるポーズ。フォルダ名は v1_bundle のまま）を `assets/sprites/hero/hero_hit_v1_bundle/` に同梱し、`enabled: true` です（フラグとファイルの一致はテストで確認します）。発射（AIM_POWER→FLYING）の瞬間に1回だけ再生し、その後FLIGHT_LOOPに戻ります。JSONの `sequence` は `[0,0,1,2,3,4,5,6,7]` で、9ステップ・0.75秒です。コマの順は、衝撃でかがむ（2ステップ保持）→振り向く→背面に切り替わる→マントが広がる→硬直した留美子飛びポーズ、です。元動画に一回転はないので、コードで回転を足すことはしていません。再生中は落下速度による傾きを0にします（終了後0.12秒で戻します）。再生中にAERIALや通常バウンドが起きた場合は、AERIAL・GROUND_BOUNCEと同じく新しい方が優先です。動きを減らす設定では、同じ時間だけ代表コマ（シート4、硬直したポーズ）を表示します。素材がない場合は従来どおりで、最初からFLIGHT_LOOPを表示します。描画に失敗した場合はFLIGHT_LOOP→Canvas勇者の順に戻ります。

SPECIAL_REACTION（SPECIAL成功時の決めポーズ、12fps・非ループ・8コマ・pivot (48,88)・表示倍率1.25）は v1素材（Grok動画 special_reaction_v1b の元フレーム 4,6,8,10,13,14,16,28）を `assets/sprites/hero/hero_special_reaction_v1_bundle/` に同梱し、`enabled: true` です（フラグとファイルの一致はテストで確認します）。コマの順は、飛行姿勢→身構えて剣を下げる→剣を斜め上前方へ振り上げる→決めポーズ、です。決めポーズは3ステップ保持するので、JSONの `sequence` は `[0,1,2,3,4,5,6,7,7,7]`、10ステップ・0.833秒になります。縮尺は0.205です。この動画は縦長（464x688）で、HIT・STOP_RESULTの0.2174はそのまま使えません。同じ縦長の v1a の1コマ目（FLIGHT_LOOPの0コマ目と同じ絵）から求めると、v1aでは0.1827になります。盾を照合すると v1b の勇者は v1a の0.89倍の大きさなので、0.1827÷0.89でFLIGHT_LOOPと同じピクセル縮尺になります。発生条件はFLYING中に `game.specialSuccesses` が増えたとき（`resolveSpecial(true)` の成功。MISSでは増えません）と、商人SPECIALの成功（`merchantStats.successes` の増加）で、1回再生してFLIGHT_LOOPに戻ります。HIT・AERIAL・GROUND_BOUNCEより優先度が高く、再生中にそれらが起きても途中で切れません。再生の最初の0.12秒で落下速度による傾きを0まで戻し（急に起き上がりません）、終了後0.12秒で元の傾きに戻します。素材は全コマを4px左へずらし、胴体の横位置をFLIGHT_LOOPに合わせています（残りの差は約4px。それ以上ずらすと0コマ目の剣先がセルの端にかかります）。縦方向の胴体位置はFLIGHT_LOOPと1〜2pxの差で、足が高く見えるのは脚をたたんだ飛行ポーズのためです。動きを減らす設定では、同じ時間だけ決めポーズ（シート7）を表示します。成功の瞬間に出る既存の白フラッシュ（0.18秒、STOPPERでは0.32秒）と軌跡エフェクトは、最初の数コマに重なります。物理・当たり判定・SPECIALルール・入力は変更しません。

STOP_RESULT（勇者の停止〜リザルト、12fps・非ループ・pivot (48,88)・表示倍率1.25、FLIGHT_LOOPと同じ縮尺 1/4.6）は v1素材（Grok動画 stop_result_v1b の元フレーム 22,24,28,56,82,84,86,100）を `assets/sprites/hero/hero_stop_result_v1_bundle/` に同梱し、`enabled: true` です（フラグとファイルの一致はテストで確認します）。勇者が地面の上で完全に止まった瞬間（body.stopped、FLYINGまたはRESULT）から1回だけ再生します。JSONの `sequence` `[0,0,1,2,3,3,4,5,6,7]` の順で、ブレーキ→体勢を戻す→踏ん張る→ぐらつき→剣を上げる→決めポーズと進み、10ステップ・0.833秒です。その後はRESULT表示中ずっと最後のコマ（決めポーズ）を表示します。RETRYで消え、READY・AIMは従来どおりCanvas勇者に戻ります。滑走中ではなく完全停止から始める理由は2つあります。滑走時間の中央値が0.62秒と短く、10パーセンタイルでは0.05秒しかないこと（300回のシミュレーション）。そして停止直前はほぼ動いていないため、ブレーキのコマを停止後に見せても違和感がないことです。STOPPERによる空中停止（同シミュレーションで約21%、地面から12〜64px）では立ちポーズが浮いて見えるため再生せず、従来の表示のままにします。停止とRESULT画面（半透明のオーバーレイ）は同じフレームで切り替わるので、アニメーションはオーバーレイ越しに見えます。動きを減らす設定では最初から最後のコマを表示します。RESULTのオーバーレイは、STOP_RESULTが実際に再生される場合だけ、再生中（0.833秒）は透明にし、その後0.2秒かけて通常の表示に戻します（表示のみ）。オーバーレイの内容・読み上げ・タップの受け付けは変えていないので、透明な間にタップしても従来どおりすぐRETRYになります。空中停止・素材なし・動きを減らす設定では、従来どおりすぐに表示します。素材がない・読み込み失敗・描画失敗の場合は従来の表示（RESULTではCanvas勇者）に戻ります。元フレーム6〜20は使っていません。足元に白い砂ぼこりがあるか、この縮尺では96pxのセルに収まらない（剣先がはみ出る）ためです。

勇者スプライトの切り替え規則（Phase B、表示のみ）：一発アニメの優先度は `Hop.Sprites.oneShotPriority` で、SPECIAL_REACTION 2、HIT・AERIAL UP/DOWN・GROUND_BOUNCE 1 です。再生中の一発アニメは、優先度が高いものには常に、同じ優先度のものには1コマ分（`minShow` = 1/12秒）表示した後に切り替わります。優先度が低いものでは切り替わりません。切り替えが見送られても、AERIALの加速やエフェクトの線、バウンドの物理はそのまま起きます。素材のない一発アニメは開始しないので、今の表示が途中で消えることはありません。傾きは一発アニメの切り替えで急に変わらないよう、切り替え時点の傾きから0.12秒かけて戻します（GROUND_BOUNCEとHITは、バウンド・発射の瞬間なので従来どおり直立から始めます）。RESULTでSTOP_RESULTが出ない場合（空中でSTOPPERに止められた、STOP_RESULT素材がない）は、Canvas勇者に戻さずFLIGHT_LOOPをRESULTに入った瞬間のコマで止めて表示します。RETRY（READY / AIM）では従来どおりCanvas勇者です。

仲間キャラのスプライト（Phase C、表示のみ）：道ばたの7人（BOOST・BOUNCE・BRAKE・ANGLE・DASH・GUARD・STOPPER）と商人（SPECIAL_ONLY）は、`js/sprites.js` の `definitions.CAST` に1人1枚の静止画を登録できます。形式は96x96の1コマ、pivot (48,88)、JSONは `id`（キャラID）、`animation`（`IDLE`。武闘家は接触後の `KICK` も可）、`frames: 1`、`fps: 1`、`loop: false` です。素材は `assets/sprites/cast/<名前>/` に置き、その枠を `enabled: true` にします（フラグとファイルの一致は `tests/sprites-cast.cjs` が確認します）。`enabled: false` の枠は画像を要求せず、従来のCanvasの人物を描きます。読み込めた静止画は、Canvasの人物と同じ足元の位置に、勇者と同じ画素サイズ（表示倍率1.25）で描きます。名前ラベル、READY表示、接触後の不透明度35%はそのままです。武闘家の接触後は `KICK` を、なければ `IDLE` を使います。商人は勇者の横に出る位置で、従来の比率（1.25/1.365）の大きさで描きます。`flip: true` で左右を反転できます。素材がない・壊れている・描画に失敗した場合は、Canvasの人物に戻ります。勇者の素材は従来どおり8コマ必須です。現在有効なのは魔法使い（BOOST、`assets/sprites/cast/boost_witch/`、57x84）、武闘家（BOUNCE、`assets/sprites/cast/bounce_fighter/`、IDLE 38x76・接触後KICK 61x71、軸足を足元に固定）、盗賊（BRAKE、`assets/sprites/cast/brake_thief/`、57x81、`flip: true` でCanvasと同じくフックを右手に）、僧侶（STOPPER、`assets/sprites/cast/stopper_cleric/`、43x77、杖は右手）、遊び人（ANGLE、`assets/sprites/cast/angle_jester/`、49x78、`flip: true` でCanvasと同じくボールを右手に）、戦士（DASH、`assets/sprites/cast/dash_warrior/`、66x84、`flip: true` でCanvasと同じく剣を右手・盾を左手に）、賢者（GUARD、`assets/sprites/cast/guard_sage/`、53x85、本は左手・杖は右手）、商人（SPECIAL_ONLY、`assets/sprites/cast/merchant/`、62x85、箱は右手でアイテムの玉の下）で、8枠すべてが静止画になりました。

ロード中・画像欠落・不正JSON・画像寸法不一致・描画失敗時は、AERIAL / GROUND_BOUNCE / HIT / SPECIAL_REACTION → FLIGHT_LOOP → Canvas勇者の順に戻ります。GIFと個別8枚は確認用で、実行時には読み込みません。素材はユーザー提供の完成版を無加工で使用しています。

## ローカル起動

ビルド不要。HTTPプレビューを推奨します。Pythonがある場合、このフォルダで `python -m http.server 8000 --bind 127.0.0.1` を実行し、`http://127.0.0.1:8000/` を開きます。終了はCtrl+C。

Node.jsがある場合は `node tests/release.cjs --serve` でもプレビューできます。`http://127.0.0.1:8765/NANACACRASH/` を開きます。

`index.html` の直接表示も可能ですが、file://でJSON読込が制限される環境ではCanvas勇者に戻ります。スプライト確認には通常の静的HTTP/HTTPS配信を使ってください。遊ぶ側にNode.js・Python・npm・ビルドは不要です。

## GitHub Pages公開

公開URL：[異世界Truck Crash!!](https://dicek9750.github.io/Flash-game/)

GitHub Pagesで公開済みです。この作業ではcommit・push・Pages設定変更を行っていないため、ローカルの未コミット改善は公開URLへ未反映です。

相対パスでサブパス配信に対応し、ルートの `.nojekyll` を維持します。共有用のタイトル・説明・theme-colorと、外部素材を使わない `favicon.svg` を用意しています。OGP画像はありません。再公開時は既存の公開設定を維持し、公開URLで発射・スマホ操作・SPECIAL・RETRY・記録保存を確認してください。

### CI（回帰テストのみ）

`.github/workflows/test.yml` はpush / pull_requestでubuntu-latestとNode LTSを使用します。`node tests/release.cjs` が `tests/*.cjs` を列挙し、共有の前提テストをCommonJSキャッシュで重複実行せず、最後に公開回帰チェックを実行します。npm install・secrets・デプロイ処理は不要です。

ワークフローはローカルに追加した段階です。GitHub上での初回実行結果は、後日commit・pushした後に確認してください。

## テスト

- `node tests/phase2.cjs`：物理・AERIAL・入力・停止の回帰テスト。
- `node tests/phase3.cjs`：上記に加え、7種類・SPECIAL・GUARD・保存・DEBUG・リセット。
- `node tests/specials.cjs`：正式SPECIAL・準備解除・商人A〜D・境界生成・終了・上書き・入力・RETRY。
- `node tests/guard-special.cjs`：通常ベクトル・新SPECIAL・2種類のGUARD・タイマー停止・商人との統合。
- `node tests/controls.cjs`：1入力・ヒステリシス・旧操作無効・音声不可時の安全性。
- `node tests/sprites.cjs`：画像／JSONロードと異常系、RGBA寸法、8fps・固定pivot、補間設定の復元、飛行時だけの置換、描画によるゲーム状態不変。QAの「HERO FLIGHT_LOOP」「HERO 画像欠落」で実画像と意図的な404フォールバックを比較できます。
- `node tests/sprites-aerial.cjs`：AERIAL UP / DOWNの素材仕様、ロード異常系、30/60/120/144Hzで同じ12fpsのフレーム、終了後のFLIGHT_LOOP復帰、再生中の再発動、pivot・補間、フォールバックの順序、動きを減らす設定、FLYING以外とRETRY、描画してもゲーム状態と物理が変わらないこと。QAの「HERO AERIAL UP」「HERO AERIAL DOWN」「HERO AERIAL 画像欠落」は準備時に一時停止し、「再生」で動きを確認できます。
- `node tests/sprites-ground-bounce.cjs`：GROUND_BOUNCEのパスとフラグの整合、無効時に画像を要求しないこと、テスト専用のモック素材による4種類のリフレッシュレートでのタイミング、転がり接地とType Dの除外、AERIALとの割り込み、素材がない場合は従来どおりであること、`sequence` の検証と再生順（潰れ→跳ね返り）、再生中に傾かないことと終了後に元の傾きへ戻ること、0.3秒の再始動制限と0.25秒の小さな跳ねの除外、フォールバック、動きを減らす設定、描画してもゲーム状態と物理が変わらないこと。QAの「HERO GROUND_BOUNCE」「HERO GROUND_BOUNCE 商人D」。
- `node tests/sprites-hit.cjs`：HITのフラグとファイルの整合、無効時に画像を要求しないこと、発射した更新で開始し30/60/120/144Hzで全8コマを再生した後FLIGHT_LOOPに戻ること（実素材のsequenceも確認）、再生中は傾けないことと終了後に戻ること、物理が変わらないこと、AERIAL・通常バウンドによる割り込み、動きを減らす設定では代表コマ（実素材はシート4）、素材なし・描画失敗時のフォールバック、発射以外では再生しないこと、描画してもゲーム状態が変わらないこと。
- `node tests/sprites-special-reaction.cjs`：SPECIAL_REACTIONのパスとフラグの整合、無効時に画像を要求しないこと、`specialSuccesses` 増加でのみ開始（MISSでは開始しない）、30/60/120/144Hzで全8コマ再生後FLIGHT_LOOP、再生中は傾けないことと終了後に戻ること、物理が変わらないこと、AERIAL・HIT・GROUND_BOUNCEとの割り込み、動きを減らす設定では代表コマ（実素材はシート7）、実素材のsequence、素材なし・描画失敗時のフォールバック、描画してもゲーム状態が変わらないこと。
- `node tests/sprites-cast.cjs`：仲間キャラ（CAST）の定義（8人、武闘家のKICK）、フラグとファイルの一致、無効時に画像を要求しないこと、1コマの静止画を受け付け、勇者は8コマのままであること、ロード異常系、すべて無効のときCanvasの描画呼び出しが従来と同じであること、同じ足元の位置と1.25倍で描くこと、名前ラベルと接触後35%、武闘家KICKの代替、商人の重ね表示、左右反転、描画失敗時のCanvasへの切り替え、動きを減らす設定、物理が変わらないこと。
- `node tests/hero-transitions.cjs`：実際のゲームループ（Game・UI・描画、実素材と実JSON）をシード固定で24回（`--runs N` で変更、`--log` で毎フレームの表示レイヤーをCSV出力）自動プレイし、30/60/120/144Hzで、毎フレーム勇者がちょうど1体描かれること、表示レイヤーとコマが規則どおりであること、SPECIAL_REACTIONがHIT・AERIAL・GROUND_BOUNCEで切れないこと、1/12秒未満の切り替えがないこと、一発アニメが残り続けないこと、切り替えで傾きが急に変わらないこと、RESULTでの静止表示とRETRY後の状態、商人SPECIALでも再生すること、動きを減らす設定の代表コマ、素材欠落時のフォールバックを確認します。
- `node tests/sprites-stop-result.cjs`：STOP_RESULTのフラグとファイルの整合、JSON（sequence）の検証、無効時に画像を要求しないこと、30/60/120/144Hzでのタイミング（停止したフレームで開始し、全コマを1回ずつ再生）、RESULT中は最後のコマを保持すること、RETRYでCanvas勇者に戻ること、動きを減らす設定では最後のコマ、素材なし・描画失敗時のフォールバック、空中停止の除外、Type Bの再出発で解除されること、描画してもゲーム状態と物理が変わらないこと。
- `node tests/sprites-result-overlay.cjs`：RESULTオーバーレイの不透明度の推移（30/60/120/144Hz）、ゲーム状態とRESULT画面の内容がすぐに表示する場合と同じであること、透明な間のタップでRETRYになること、空中停止・素材なし・動きを減らす設定ではすぐに表示すること。
- `node tests/release.cjs`：全テストに加え、描画・必須ファイル・.nojekyll・共有メタ情報・ローカルアセットのサブパス解決・維持した物理設定を照合。
- `node tests/release.cjs --serve`：`/NANACACRASH/qa.html` は検証専用。シナリオを選択して「準備」で通常効果・7SPECIAL・商人A〜D・BRAKE準備・GUARD期限／二重防御／浮遊中の時間停止を再現します。準備時は時間停止し、画面タップでSPECIAL成功、「再生」でタイマーを再開してMISSを確認できます。「次の通常STOPPER」「次のGUARD」で防御の順序も確認できます。QAプレイは保存しません。

ゲーム中のDキーでDEBUG切替。DEBUGは従来の固定順序・間隔を維持し、追加の100m境界生成を行いません。OFFで通常の境界＋ランダム生成に戻ります。一度でもDEBUGを使ったプレイは記録対象外です。テスト用のサーバー・QA画面はGitHub Pagesには必要ありません。

## プレイ中の表示・快適性

- FLYING中にステージ内から始めるジェスチャーはゲーム操作を優先します。ステージ外やREADY・角度／パワー選択・RESULTでは縦スクロールできます。
- ステージ左上に次のAERIAL操作とDOWN充電、右上に商人効果の残数を表示。Type Cは残り人数、Type BはCHARGEゲージです。
- SPECIAL READYは現在の準備状態から導出した対象職業、頭上SPECIALは現在条件が成立する画面内キャラです。途中の接触・バウンドで条件は変化します。ANGLEの抽選結果は先読みしません。
- 結界保持中、次の100m境界まで10m以内でMERCHANT ZONEを表示。対象境界キャラはMERCHANT表示を優先します。実際の接触条件・成功判定は従来どおりです。
- SPECIAL受付・成功／失敗、GUARD SPECIAL開始／終了、DOWN再充電完了だけを読み上げ領域へ通知します。充電率や秒数は毎フレーム読み上げません。動きを減らす設定では強いフラッシュ・点滅を抑えます。
- RESULTのハイライトは既存接触履歴から最大3件を抽出します。商人成功→僧侶SPECIAL→その他SPECIAL→GUARD BLOCKの順で、ない場合は接触・バウンド回数を表示します。
- UI追加検証：`node tests/ui-quality.cjs`（release.cjsからも実行）。
