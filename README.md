# 🎬 AI Auto Video Generator

画像と音楽からAIが自動で動画を生成するWebアプリケーションです。

## ✨ 機能

- 📷 **画像アップロード**: ドラッグ&ドロップで複数画像をアップロード、並び替え可能
- 🎵 **音源アップロード**: MP3/WAVなどの音源をアップロード、波形表示で範囲選択
- 🤖 **AI分析**: Claude APIが画像と音源を分析し、最適な編集計画を生成
- 🎥 **プレビュー再生**: リアルタイムでプレビューを再生、音声と同期
- 📤 **動画出力**: FFmpeg.wasmでブラウザ内でMP4動画を生成・ダウンロード
- 📱 **PWA対応**: スマートフォンにインストールしてアプリのように使用可能

## 🚀 デモ

[デプロイ後にURLを追加]

## 🛠️ 技術スタック

- **フロントエンド**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **AI**: Claude API (Anthropic)
- **音源分析**: wavesurfer.js, Web Audio API
- **動画生成**: FFmpeg.wasm
- **ドラッグ&ドロップ**: @dnd-kit
- **PWA**: next-pwa

## 📦 インストール

```bash
# リポジトリをクローン
git clone https://github.com/your-username/ai-video-generator.git
cd ai-video-generator

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env.local
# .env.local にANTHROPIC_API_KEYを設定

# 開発サーバーを起動
npm run dev
```

## ⚙️ 環境変数

`.env.local` に以下を設定:

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

## 🚢 デプロイ

### Vercel（推奨）

1. GitHubにリポジトリをプッシュ
2. [Vercel](https://vercel.com)にログイン
3. "New Project" → リポジトリを選択
4. 環境変数 `ANTHROPIC_API_KEY` を設定
5. "Deploy" をクリック

### 手動デプロイ

```bash
npm run build
npm start
```

## 📝 使い方

1. **画像をアップロード**: 2枚以上の画像をドラッグ&ドロップ
2. **音源をアップロード**: MP3/WAVファイルをアップロード
3. **範囲を選択**: 波形上で動画に使用する範囲を選択
4. **AI分析を実行**: 「AIで分析する」ボタンをクリック
5. **プレビューを確認**: 再生ボタンでプレビュー
6. **動画を生成**: 「動画を生成する」→「ダウンロード」

## 📂 プロジェクト構造

```
src/
├── app/
│   ├── api/analyze/    # AI分析APIルート
│   ├── layout.tsx      # レイアウト
│   └── page.tsx        # メインページ
├── components/
│   ├── ImageUploader.tsx    # 画像アップロード
│   ├── AudioUploader.tsx    # 音源アップロード
│   ├── VideoPreview.tsx     # プレビュー再生
│   ├── VideoExporter.tsx    # 動画出力
│   └── ...
├── hooks/
│   └── useVideoAnalysis.ts  # 分析状態管理
├── lib/
│   ├── audioAnalyzer.ts     # 音源分析
│   ├── videoRenderer.ts     # 動画レンダリング
│   └── claude.ts            # Claude APIクライアント
└── types/
    └── index.ts             # 型定義
```

## 🔒 セキュリティ

- APIキーはサーバーサイドでのみ使用
- 動画生成はすべてブラウザ内で実行（アップロードなし）

## 📄 ライセンス

MIT License

## 🙏 謝辞

- [Anthropic](https://anthropic.com) - Claude API
- [FFmpeg](https://ffmpeg.org) - 動画エンコード
- [wavesurfer.js](https://wavesurfer-js.org) - 波形表示
