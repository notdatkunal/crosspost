'use client';

import { useState, useEffect } from 'react';
import { PLATFORM_LIST, PLATFORMS } from '@/lib/platforms';

async function postDirectBluesky({ text, token }) {
  const [identifier, password] = token.split(':');
  if (!identifier || !password) {
    throw new Error('Use format handle:app-password for Bluesky');
  }
  const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const session = await sessionRes.json();
  if (!sessionRes.ok) throw new Error(session.message || 'Bluesky auth failed');

  const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
      },
    }),
  });
  const postData = await postRes.json();
  if (!postRes.ok) throw new Error(postData.message || 'Bluesky post failed');
  return { id: postData.uri };
}

async function postDirectMastodon({ text, token }) {
  const [instanceUrl, accessToken] = token.split('|');
  if (!instanceUrl || !accessToken) {
    throw new Error('Use format https://instance.social|access_token for Mastodon');
  }
  const cleanUrl = instanceUrl.replace(/\/$/, '');
  const res = await fetch(`${cleanUrl}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Mastodon post failed');
  return { id: data.id, url: data.url };
}

export default function Home() {
  const [selected, setSelected] = useState(['twitter', 'threads', 'bluesky']);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [tokens, setTokens] = useState({});
  const [showKeys, setShowKeys] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('crosspost_tokens');
      if (saved) setTokens(JSON.parse(saved));
    } catch {
      // ignore storage errors
    }
  }, []);

  const updateToken = (platformId, value) => {
    const next = { ...tokens, [platformId]: value };
    setTokens(next);
    try {
      localStorage.setItem('crosspost_tokens', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const togglePlatform = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const needsTitle = selected.some((id) => PLATFORMS[id]?.supportsTitle);

  const handlePublish = async () => {
    if (!text.trim() || selected.length === 0) return;
    setPublishing(true);
    setResults([]);

    const outcomes = await Promise.all(
      selected.map(async (id) => {
        const platform = PLATFORMS[id];
        const token = tokens[id]?.trim();
        if (!token) {
          return { id, name: platform.name, ok: false, error: 'Missing token' };
        }
        if (text.length > platform.maxChars) {
          return {
            id,
            name: platform.name,
            ok: false,
            error: `Exceeds ${platform.maxChars} char limit`,
          };
        }

        try {
          let res;
          if (id === 'bluesky') {
            res = await postDirectBluesky({ text, token });
          } else if (id === 'mastodon') {
            res = await postDirectMastodon({ text, token });
          } else {
            const apiRes = await fetch('/api/post', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ platform: id, title, text, token }),
            });
            res = await apiRes.json();
            if (!apiRes.ok || !res.ok) {
              throw new Error(res.error || 'Publish failed');
            }
          }
          return { id, name: platform.name, ok: true, data: res };
        } catch (err) {
          return { id, name: platform.name, ok: false, error: err.message };
        }
      })
    );

    setResults(outcomes);
    setPublishing(false);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Crosspost</h1>
            <p className="text-sm text-zinc-400">
              Write once, publish everywhere. Zero database, stateless proxy.
            </p>
          </div>
          <button
            onClick={() => setShowKeys((v) => !v)}
            className="px-3 py-1.5 text-sm rounded-lg border border-zinc-700 hover:bg-zinc-800 transition"
          >
            {showKeys ? 'Hide API Keys' : 'API Keys (BYOK)'}
          </button>
        </header>

        {showKeys && (
          <section className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-300">
              Platform Tokens (stored locally in your browser)
            </h2>
            <div className="grid gap-3">
              {PLATFORM_LIST.map((p) => (
                <div key={p.id} className="space-y-1">
                  <label className="text-xs text-zinc-400 flex justify-between">
                    <span>
                      {p.name} — {p.tokenLabel}
                    </span>
                    <span className="text-zinc-500">
                      {p.needsProxy ? 'via /api/post' : 'direct browser'}
                    </span>
                  </label>
                  <input
                    type="password"
                    value={tokens[p.id] || ''}
                    onChange={(e) => updateToken(p.id, e.target.value)}
                    placeholder={`Enter ${p.name} token...`}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PLATFORM_LIST.map((p) => {
              const active = selected.includes(p.id);
              const overLimit = active && text.length > p.maxChars;
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    active
                      ? overLimit
                        ? 'bg-red-950 border-red-600 text-red-200'
                        : 'bg-zinc-100 border-zinc-100 text-zinc-950'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {p.name} ({text.length}/{p.maxChars})
                </button>
              );
            })}
          </div>

          {needsTitle && (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title (for Medium / Dev.to)..."
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-zinc-500"
            />
          )}

          <textarea
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:border-zinc-500 resize-y"
          />

          <div className="flex justify-end">
            <button
              onClick={handlePublish}
              disabled={publishing || !text.trim() || selected.length === 0}
              className="px-5 py-2.5 rounded-xl bg-zinc-100 text-zinc-950 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40 transition"
            >
              {publishing ? 'Publishing...' : `Publish to ${selected.length} platform(s)`}
            </button>
          </div>
        </section>

        {results.length > 0 && (
          <section className="space-y-2">
            {results.map((r) => (
              <div
                key={r.id}
                className={`p-3 rounded-lg text-sm border ${
                  r.ok
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                    : 'bg-red-950/40 border-red-800 text-red-200'
                }`}
              >
                <span className="font-semibold">{r.name}:</span>{' '}
                {r.ok ? 'Published successfully' : r.error}
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
