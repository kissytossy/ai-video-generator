import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Auto Video Generator',
  description: '画像と音楽からAIが自動で動画を生成します',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AI Video',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    title: 'AI Auto Video Generator',
    description: '画像と音楽からAIが自動で動画を生成します',
    siteName: 'AI Video Generator',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Auto Video Generator',
    description: '画像と音楽からAIが自動で動画を生成します',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0ea5e9',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="font-sans">
        <div className="min-h-screen flex flex-col">
          {/* ヘッダー */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎬</span>
                  <h1 className="text-xl font-bold text-gray-900">
                    AI Video Generator
                  </h1>
                </div>
                <nav className="flex items-center gap-4">
                  {/* 認証ボタン（Phase 2で実装） */}
                  <button className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                    ログイン
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
                    無料で始める
                  </button>
                </nav>
              </div>
            </div>
          </header>

          {/* メインコンテンツ */}
          <main className="flex-1">
            {children}
          </main>

          {/* フッター */}
          <footer className="bg-gray-50 border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-sm text-gray-500">
                  © 2025 AI Video Generator. All rights reserved.
                </p>
                <div className="flex gap-6">
                  <a href="#" className="text-sm text-gray-500 hover:text-gray-700">
                    利用規約
                  </a>
                  <a href="#" className="text-sm text-gray-500 hover:text-gray-700">
                    プライバシーポリシー
                  </a>
                  <a href="#" className="text-sm text-gray-500 hover:text-gray-700">
                    お問い合わせ
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </div>

        {/* PWAインストールプロンプト */}
        <InstallPrompt />
      </body>
    </html>
  )
}

// PWAインストールプロンプトコンポーネント
function InstallPrompt() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          let deferredPrompt;
          window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // インストールバナーを表示（任意のUI）
            const showInstallBanner = () => {
              if (deferredPrompt) {
                const banner = document.createElement('div');
                banner.id = 'install-banner';
                banner.innerHTML = \`
                  <div style="position: fixed; bottom: 20px; left: 20px; right: 20px; background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; padding: 16px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; justify-content: space-between; align-items: center; z-index: 9999; max-width: 500px; margin: 0 auto;">
                    <div>
                      <strong>📱 アプリとしてインストール</strong>
                      <p style="font-size: 14px; margin: 4px 0 0; opacity: 0.9;">ホーム画面に追加して快適に使えます</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                      <button id="install-btn" style="background: white; color: #0284c7; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer;">インストール</button>
                      <button id="close-banner" style="background: transparent; color: white; border: 1px solid white; padding: 8px 12px; border-radius: 8px; cursor: pointer;">✕</button>
                    </div>
                  </div>
                \`;
                document.body.appendChild(banner);
                
                document.getElementById('install-btn').addEventListener('click', async () => {
                  deferredPrompt.prompt();
                  const { outcome } = await deferredPrompt.userChoice;
                  deferredPrompt = null;
                  banner.remove();
                });
                
                document.getElementById('close-banner').addEventListener('click', () => {
                  banner.remove();
                  sessionStorage.setItem('install-banner-dismissed', 'true');
                });
              }
            };
            
            // 3秒後にバナーを表示（初回のみ）
            if (!sessionStorage.getItem('install-banner-dismissed')) {
              setTimeout(showInstallBanner, 3000);
            }
          });
        `,
      }}
    />
  )
}
