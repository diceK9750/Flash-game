# GPT-6 Astra 移行記録

実施日: 2026-09-21

## 適用内容

開発用モデルをプロジェクトの `.codex/config.toml` に固定。

```toml
model = "gpt-6-astra"
model_reasoning_effort = "medium"
```

移行前はプロジェクト設定なし。ユーザー共通設定は既に同じ Astra / medium だったため、今回の変更はプロジェクト単位での明示化となる。AGENTS.md に構成、維持する仕様、検証手順を追加した。

公式資料:
- [モデル仕様](https://developers.openai.com/api/docs/models/gpt-6-astra)
- [プロジェクト設定と優先順位](https://learn.chatgpt.com/docs/config-file/config-basic)

プロジェクト設定は信頼済みプロジェクトで読み込まれる。CLIの明示指定など、優先度の高い設定がある場合はそちらが優先される。既存のデスクトップタスクのモデルが、このファイルだけで即時切り替わったとは確認していない。

## 保全

開始時の未コミット変更は12ファイル。全追跡対象ファイルのコピー、SHA-256一覧、HEADの識別子、HEADとの差分を以下のローカル一時フォルダに保存した。

`C:\Users\dicek\AppData\Local\Temp\nanacacrash-astra-20260921-045826`

このバックアップは一時フォルダにあるため長期保管用ではない。既存ファイルは今回の移行で編集しない。

## 検証結果

移行前に `node tests/release.cjs` が終了コード0で成功。

- 物理シミュレーション400回、FPS間の整合性確認。
- phase3: 32 SPECIALチェック。
- formalSpecials: 49ケース、40回の操作付き実行。
- guardAndContact: 57ケース。
- controlsAndAudio: 24ケース。
- Release: 物理設定、描画、状態遷移、相対パスの確認成功。

今回の適用は設定と文書だけで、ゲームの実行ファイル・既存テストは変更していない。実ブラウザの再確認、別モデルとの品質・時間・使用量比較、別のAstraセッションによる実行確認は未実施。共通設定が既にAstraのため、旧モデルとの比較基準はこの移行では得られていない。

## 切り戻し

今回追加した `.codex/config.toml` の2つの設定を除けば、従来の共通設定の継承に戻る。共通設定もAstraなので、これは別モデルへの切り戻しではない。別モデルへの変更が必要な場合は、利用可能な対象モデルを明示的に選ぶ。既存のゲームファイルを git reset 等で巻き戻す必要はない。
