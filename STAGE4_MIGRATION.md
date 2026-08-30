# STAGE 4 図書室

STAGE 4「図書室」は `feature/stage4-library` で最新 main 向けに移植されています。

- `js/stages/library.js`: 図書室レイアウト、擬態対象、スポーン、巡回路、イベント地点
- `js/stage.js`: `library` ビルダー登録
- `js/main.js` / `index.html`: STAGE 4 の解放・選択・開始導線
- `js/stageEvents.js`: 「📚 本が崩れた！」イベント
- `js/audio.js`: 本崩れ専用SE
- `tests/unit/libraryStage.test.mjs`: 配置・導線検証
- `tests/e2e/library.spec.mjs`: ブラウザ上のSTAGE 4起動・イベント検証

古いドラフトPR #21を直接マージせず、現在のステージ分割・GPU解放・BGM/設定構造を維持したまま必要部分だけを移植しています。
