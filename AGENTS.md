# NANACACRASH 開発ガイド

## 構成と仕様

- 軽量な静的ブラウザゲーム。HTML/CSS/JavaScript、Canvas、合成SEで動作する。ビルドや外部ライブラリ、外部通信は不要。
- 現行仕様は README.md と tests/ を確認する。両者が矛盾する場合は差異を報告し、変更対象に関係する仕様を確かめる。
- 設定は js/config.js、ゲーム進行は js/game.js、物理は js/physics.js、入力は js/input.js、描画は js/ui.js と js/graphics.js、音声は js/audio.js。
- ユーザーの未コミット変更を保全する。依頼に必要な範囲だけ変更する。

## 維持する動作

- 左クリック／1タップで角度、パワー、発射、AERIAL、SPECIAL、RETRYを操作できる。
- AERIALは垂直速度とヒステリシスで方向を選択する。UP回数、DOWN充電、時間停止条件は README.md とテストに従う。
- 接触優先順位は商人SPECIAL → 通常SPECIAL → normalGuard → GUARD SPECIAL → 通常効果。
- 物理定数、SPECIAL条件、商人A〜Dの効果、記録対象条件は、変更依頼なしに調整しない。
- localStorageや音声が利用できなくてもゲームは続行する。DEBUG使用プレイとQAプレイは記録しない。
- 静的配信のサブパスで動作する相対パスを維持する。

## 検証

- ゲームコード変更後は `node tests/release.cjs` を実行する。この入口は既存の各回帰テストを連鎖実行する。
- 操作・描画変更時は `node tests/release.cjs --serve` で起動し、通常画面と `/NANACACRASH/qa.html` をブラウザ確認する。
- 発射、AERIAL、SPECIAL、商人A〜D、RETRY、保存、スマホ幅の表示のうち変更に関係する項目を確認する。
- 自動テスト結果と実ブラウザでの確認を区別する。実機や公開URLの未実施確認を完了と記載しない。

## 開発モデル

- プロジェクトの既定値は `.codex/config.toml` の `gpt-6-astra` / `medium`。
- モデル設定は開発支援用。ゲーム実行時のAPI呼び出しを追加するものではない。
- 詳細な検証記録と切り戻し方法は `docs/astra-migration.md` を参照する。
