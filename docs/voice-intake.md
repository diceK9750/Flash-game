# キャラクターボイス素材の受入

## 現状

`assets/audio/voices/original/` と `dist/` に既存のWAV/MP3が20組あります。ファイル形式・波形・MP3フレームの技術検査には通りますが、この検査も既存のmanifestや生成スクリプトの記述も、音声の出所やGemini生成、本物の台詞であることを証明しません。素材は保全し、出所と聴感を確認するまで未確認として扱います。

`assets/audio/voices/voice-registry.json` は台詞IDとゲームイベントの対応表です。20件すべてを特定イベントに接続しました。`hero_flight` は新たな物理イベントを追加せず、既存のAERIAL UP/DOWN成功エフェクトの最初の1回に接続し、1プレイ1回に制限しています。発射台詞より低く、SPECIAL/合体技より低い優先度です。各項目の `humanReviewed` は `false`、`sourceProvenance` は `null` のままです。出所と聴感を確認し、対象レコードを更新してトップレベル `authenticityStatus` を `reviewed` にするまで、任意ボイス経路は素材を読み込まず再生もしません。技術検査だけでこの確認欄を変更してはいけません。

## 技術検査

リポジトリルートで次を実行します。追加パッケージやAPIアクセスは不要です。

```sh
node scripts/accept_voice_assets.cjs
node tests/voice-acceptance.cjs
node tests/voice.cjs
node tests/release.cjs
```

ツールはWAVのPCM形式、チャンネル、サンプルレート、長さ、ピーク/RMS、無音率、クリッピング、DCオフセットと、MP3のフレーム構造・長さを検査します。MP3のブラウザーデコードや聴感は検査しません。全ファイル検査がPASSでも結果の `authenticity` は `UNVERIFIED` のままです。単一ファイルを検査する場合は `node scripts/accept_voice_assets.cjs <file.wav|file.mp3>` を使います。

## 実行時の安全動作

声はSEと同じAudioContextを使い、最初のユーザー操作後にだけ承認済み素材を非同期ロードします。同じ台詞の多重再生を抑止し、優先度の高いイベントだけが再生中の台詞を中断します。未確認/未採用、ミュート、AudioContext不在・停止、404、通信・デコード・再生失敗では無音にしてゲームを続けます。ロード世代を無効化するため、画面遷移やミュート後に完了した古い要求は再生対象になりません。HTMLAudioElementや追加の状態遷移は使いません。

回帰テストは固定シードのゲーム状態・距離・物理値を音声失敗あり/なしで比較します。これはブラウザー画面や実音の聴感を確認したことを意味しません。
