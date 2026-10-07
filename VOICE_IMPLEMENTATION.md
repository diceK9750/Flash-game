# 異世界Truck Crash!! キャラクターボイス実装・納品ドキュメント

## 1. 概要
本作「異世界Truck Crash!!」に、Google Gemini TTS仕様に準拠した日本語キャラクターボイス機能を追加しました。
既存のWeb Audio合成SEと完全に調和し、操作感やテンポを損なわないよう、優先度制御・重複防止・SE自動ダッキング・掛け合い同期・iOS Safariアンロック・読込失敗時フォールバックを実装しています。

---

## 2. キャラクター音声仕様・Gemini Prebuilt Voice対応表

| キャラクター | 性別 / 特徴 | Gemini Voice | 演技スタイル / 音声パラメータ | 台詞テキスト | 日本語読み |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **勇者** (Launch) | 男性 / 熱血 | `Puck` | 元気な発射シャウト (f0: 160Hz) | うおおおっ、ぶっ飛ぶぜー！ | うおおおっ、ぶっとぶぜー！ |
| **勇者** (Flight) | 男性 / 熱血 | `Puck` | 飛行・空中気合 (f0: 175Hz) | まだまだ行くぞー！ | まだまだいくぞー！ |
| **勇者** (Stop) | 男性 / 熱血 | `Puck` | 着地・停止敗北リアクション (f0: 130Hz) | ぐはっ…ここまでか… | ぐはっ…ここまでか… |
| **魔法使い** (BOOST) | 女性 / 自信 | `Aoede` | 高音の魔力詠唱 (f0: 260Hz) | 爆裂斜光 | ばくれつしゃこう |
| **武闘家** (BOUNCE) | 男性 / 豪快 | `Orus` | 力強い打撃の気合 (f0: 140Hz) | 巨神昇天拳 | きょしんしょうてんけん |
| **戦士** (DASH) | 男性 / 剛健 | `Charon` | 武骨な突進号令 (f0: 125Hz) | 戦陣突破 | せんじんとっぱ |
| **僧侶** (STOPPER) | 女性 / 清楚 | `Kore` | 凛とした神聖な祈り (f0: 240Hz) | 聖光反転 | せいこうはんてん |
| **盗賊** (BRAKE) | 男性 / 軽快 | `Umbriel` | 影に溶けるささやき (f0: 165Hz) | 影すり抜け | かげすりぬけ |
| **遊び人** (ANGLE) | 中性 / 陽気 | `Sadachbia` | コミカルな曲芸掛け声 (f0: 220Hz) | 水平曲芸 | すいへいきょくげい |
| **賢者** (GUARD) | 女性 / 静謐 | `Sadaltager` | 落ち着いた障壁展開 (f0: 200Hz) | 聖護結界 | せいごけっかい |
| **商人A** (秘薬) | 中性 / 商人 | `Achird` | 怪しげな薬売りトーン (低め) | 倍化の秘薬 | ばいかのひやく |
| **商人B** (護符) | 中性 / 商人 | `Achird` | 厳かな祈祷トーン (引き締め) | 蓄光の護符 | ちっこうのごふ |
| **商人C** (絨毯) | 中性 / 商人 | `Achird` | 軽やかな空飛ぶ商人 (上機嫌) | 浮遊の絨毯 | ふゆうのじゅうたん |
| **商人D** (靴) | 中性 / 商人 | `Achird` | 弾むような早口商人 (弾み声) | 弾跳の靴 | だんちょうのくつ |
| **合体技** (Witch Call) | 男性 / 武闘家 | `Orus` | 連携の呼びかけ | 合わせるぞ！ | あわせるぞ！ |
| **合体技** (Witch Blast)| 女性 / 魔法使い| `Aoede` | フィニッシュ大魔法 | 一気に吹き飛びなさい！エクスプロージョン！ | いっきにふきとびなさい！えくすぷろーじょん！ |
| **合体技** (Fighter Call)| 女性 / 魔法使い| `Aoede` | 強化バフ詠唱 | 力、授けます！ | ちから、さずけます！ |
| **合体技** (Fighter Upper)| 男性 / 武闘家| `Orus` | 巨大アッパー打撃シャウト | 唸れ我が拳！昇天撃破ァ！ | うなれわがこぶし！しょうてんげきはぁ！ |
| **合体短縮** (Witch) | 女性 / 魔法使い| `Aoede` | 短縮版呪文 | 吹き飛びなさい！ | ふきとびなさい！ |
| **合体短縮** (Fighter) | 男性 / 武闘家 | `Orus` | 短縮版必殺拳 | 昇天撃破ァ！ | しょうてんげきはぁ！ |

---

## 3. ファイル構成および役割

- `assets/audio/voices/dist/*.mp3` : ブラウザ配信用軽量MP3音源（20ファイル、96kbps）
- `assets/audio/voices/original/*.wav` : 高音質マスターWAV音源（20ファイル、24kHz 16bit PCM）
- `assets/audio/voices/manifest.json` : 音声メタデータ一覧定義
- `assets/audio/voices/inspection_report.json` : 音響品質機械検査レポート
- `js/audio.js` : ボイス優先度管理、ダッキング、重複防止、iOS Safariアンロック、フォールバック実装
- `js/ui.js` : 発射・停止・AERIAL・合体技の音声トリガー連携
- `tests/audio-voice.cjs` : Node.js単体テストスイート（7テスト項目全通過）
- `scripts/gemini_tts_generate.py` : Google Gemini公式TTS再生成スクリプト
- `scripts/inspect_audio.py` : 音響検査（クリッピング・音量・無音チェック）スクリプト

---

## 4. 本番Gemini APIキーによる再生成手順

公式のGoogle AI Studio / Gemini APIキーをお持ちの場合、以下のワンライナーで全音声を公式クラウドTTSで即座に再生成・MP3変換できます。

```bash
export GEMINI_API_KEY="AIzaSy..."
python3 scripts/gemini_tts_generate.py
```

- モデル：`gemini-3.8-flash-lite-tts`（または `--model gemini-3.8-flash-tts`）
- APIキーは環境変数からのみ読み込まれ、コードやGitには一切保存されません。

---

## 5. ロールバック手順（元に戻す方法）

ボイス導入前の状態に戻すには、以下のいずれかを実行してください：
- 保存されたバックアップファイルを使用：
  ```bash
  cp js/audio.orig.js js/audio.js
  git checkout js/ui.js
  ```
- またはGitから復元：
  ```bash
  git checkout HEAD -- js/audio.js js/ui.js
  ```
