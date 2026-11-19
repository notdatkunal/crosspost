# Crosspost

Write once, publish everywhere. A lightweight, JS-first microblogging and publishing cross-poster with **zero database** and a **stateless thin proxy** (`/api/post`) so you can focus on business logic.

## Supported Platforms

| Platform | Char Limit | Title Support | Publishing Mode |
| :--- | :--- | :--- | :--- |
| **X (Twitter)** | 280 | No | Stateless proxy (`/api/post`) |
| **Threads** | 500 | No | Stateless proxy (`/api/post`) |
| **Medium** | 100,000 | Yes | Stateless proxy (`/api/post`, creates draft) |
| **Bluesky** | 300 | No | Direct from browser (CORS-enabled) |
| **Mastodon** | 500 | No | Direct from browser (CORS-enabled) |
| **LinkedIn** | 3,000 | No | Stateless proxy (`/api/post`) |
| **Dev.to** | 100,000 | Yes | Stateless proxy (`/api/post`, creates draft) |

## Architecture

- **Frontend (`src/app/page.js`)**: Composer with platform toggles, live character-limit indicators, and **BYOK (Bring Your Own Key)** token storage in `localStorage`.
- **Platform Registry (`src/lib/platforms.js`)**: Central config for character limits, token labels, and proxy/direct routing.
- **Stateless Proxy (`src/app/api/post/route.js`)**: Forwards requests to CORS-blocked APIs (X, Threads, Medium, LinkedIn, Dev.to) without storing credentials or needing a database.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **API Keys (BYOK)** to add your platform tokens, and start posting.
