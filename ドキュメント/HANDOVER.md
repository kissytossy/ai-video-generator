# 【プロジェクト引き継ぎ: AI Auto Video Generator】

## 基本情報

- **仕様書バージョン**: 0.3.0
- **現在のフェーズ**: Phase 4（AI 分析機能）進行中
- **最終更新**: 2025-12-31

---

## 完了済みフェーズ

### ✅ Phase 1: プロジェクト基盤

- [x] Next.js 14 + Tailwind CSS セットアップ
- [x] TypeScript 設定
- [x] プロジェクト構造作成

### ✅ Phase 3: コア UI

- [x] 画像アップロード UI（@dnd-kit でスムーズな並び替え）
- [x] 音源アップロード UI
- [x] 波形表示（wavesurfer.js 本物の波形）
- [x] 範囲選択スライダー（動画長さ設定）
- [x] アスペクト比選択 UI（16:9, 9:16, 1:1, 4:5）
- [x] 画像並び替え機能（ドラッグ&ドロップ）

### 🔄 Phase 4: AI 分析機能（進行中）

- [x] API Route: Claude API 中継エンドポイント
  - `/api/analyze/images` - 画像分析
  - `/api/analyze/audio` - 音源分析（未使用、クライアントで実行）
  - `/api/analyze/plan` - 編集計画生成
- [x] 画像分析機能実装
- [x] 音源分析機能（audioAnalyzer.ts）
  - BPM 検出
  - ビート検出
  - エネルギーレベル分析
  - セクション分割
- [x] 分析結果の状態管理（useVideoAnalysis.ts）
- [x] タイムライン UI 表示（TimelineView.tsx）
- [x] 分析進捗表示（AnalysisProgress.tsx）

---

## 未完了フェーズ

### ⬜ Phase 2: 認証システム

- [ ] Supabase Auth 設定
- [ ] ログイン/サインアップ UI
- [ ] Google OAuth 連携
- [ ] 認証状態管理
- [ ] 保護されたルート実装

### ⬜ Phase 5: 編集エンジン

- [ ] トランジション自動選択（ロジックは存在、適用未実装）
- [ ] ケンバーンズ効果設定（ロジックは存在、適用未実装）

### ⬜ Phase 6: プレビュー・出力

- [ ] Canvas/WebGL プレビュー実装
- [ ] リアルタイム再生機能
- [ ] FFmpeg.wasm 統合
- [ ] 動画エンコード・出力
- [ ] ダウンロード機能

### ⬜ Phase 7: 決済システム

- [ ] Stripe アカウント設定
- [ ] Checkout セッション API
- [ ] Webhook エンドポイント
- [ ] サブスクリプション状態管理

### ⬜ Phase 8: 使用量管理

- [ ] 使用量カウントロジック
- [ ] 月次リセット処理
- [ ] 制限到達時の UI 表示

### ⬜ Phase 9: PWA 対応

- [ ] next-pwa 設定
- [ ] マニフェストファイル作成
- [ ] Service Worker 設定

### ⬜ Phase 10: 仕上げ・リリース準備

- [ ] エラーハンドリング強化
- [ ] レスポンシブ対応確認
- [ ] パフォーマンス最適化
- [ ] Vercel デプロイ設定

---

## ファイル構造

```
ai-video-generator/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── analyze/
│   │   │       ├── images/route.ts    # 画像分析API
│   │   │       ├── audio/route.ts     # 音源分析API（未使用）
│   │   │       └── plan/route.ts      # 編集計画生成API
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                   # メインページ
│   ├── components/
│   │   ├── ImageUploader.tsx          # 画像アップロード（@dnd-kit）
│   │   ├── AudioUploader.tsx          # 音源アップロード（wavesurfer.js）
│   │   ├── AspectRatioSelector.tsx    # アスペクト比選択
│   │   ├── AnalysisProgress.tsx       # 分析進捗表示
│   │   └── TimelineView.tsx           # タイムライン表示
│   ├── hooks/
│   │   └── useVideoAnalysis.ts        # 分析状態管理フック
│   ├── lib/
│   │   ├── audioAnalyzer.ts           # 音源分析ロジック
│   │   └── claude.ts                  # Claude API クライアント
│   └── types/
│       └── index.ts                   # 型定義
├── .env.example
├── .env.local.example
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── SPEC_DOCUMENT.md                   # 仕様書
```

---

## 環境変数

```env
# .env.local に設定が必要
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx  # Claude APIキー
```

---

## 既知の問題/注意点

1. **Phase 2（認証）をスキップしている**

   - 現在は認証なしで動作
   - 収益化には必須

2. **動画生成は未実装**

   - 分析まではできるが、実際の動画出力は Phase 6

3. **layout.tsx の警告**
   - viewport/themeColor の metadata 警告あり（機能には影響なし）

---

## 次にやるべきこと

### オプション A: Phase 5-6（動画生成）を優先

- コア機能を完成させる
- 実際に動画が出力されるのを確認できる

### オプション B: Phase 2（認証）を先に

- 収益化に向けた基盤を先に整える
- Supabase 設定が必要

---

## 起動方法

```bash
cd ai-video-generator
npm install
npm run dev
# http://localhost:3000 で起動
```

---

## このドキュメントの使い方

新しいチャットを開始する際は、このドキュメント全体をコピーして冒頭に貼り付けてください。
