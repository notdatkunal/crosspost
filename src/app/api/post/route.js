import { NextResponse } from 'next/server';

const HANDLERS = {
  async twitter({ text, token }) {
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.title || 'Twitter API error');
    return { id: data.data?.id };
  },

  async threads({ text, token }) {
    // Step 1: Create media container
    const createRes = await fetch(
      `https://graph.threads.net/v1.0/me/threads?media_type=TEXT&text=${encodeURIComponent(text)}&access_token=${encodeURIComponent(token)}`,
      { method: 'POST' }
    );
    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.error?.message || 'Threads create error');

    // Step 2: Publish container
    const pubRes = await fetch(
      `https://graph.threads.net/v1.0/me/threads_publish?creation_id=${encodeURIComponent(createData.id)}&access_token=${encodeURIComponent(token)}`,
      { method: 'POST' }
    );
    const pubData = await pubRes.json();
    if (!pubRes.ok) throw new Error(pubData.error?.message || 'Threads publish error');
    return { id: pubData.id };
  },

  async medium({ title, text, token }) {
    const meRes = await fetch('https://api.medium.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    if (!meRes.ok) throw new Error(meData.errors?.[0]?.message || 'Medium auth error');

    const userId = meData.data.id;
    const postRes = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title || 'Untitled Post',
        contentFormat: 'markdown',
        content: text,
        publishStatus: 'draft',
      }),
    });
    const postData = await postRes.json();
    if (!postRes.ok) throw new Error(postData.errors?.[0]?.message || 'Medium post error');
    return { id: postData.data?.id, url: postData.data?.url };
  },

  async devto({ title, text, token }) {
    const res = await fetch('https://dev.to/api/articles', {
      method: 'POST',
      headers: {
        'api-key': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        article: {
          title: title || 'Untitled Post',
          body_markdown: text,
          published: false,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Dev.to API error');
    return { id: data.id, url: data.url };
  },

  async linkedin({ text, token }) {
    const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    if (!meRes.ok) throw new Error(meData.message || 'LinkedIn auth error');

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: `urn:li:person:${meData.sub}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'LinkedIn post error');
    return { id: data.id };
  },
};

export async function POST(request) {
  try {
    const { platform, title, text, token } = await request.json();

    if (!platform || !text || !token) {
      return NextResponse.json(
        { error: 'Missing required fields: platform, text, token' },
        { status: 400 }
      );
    }

    const handler = HANDLERS[platform];
    if (!handler) {
      return NextResponse.json(
        { error: `Unsupported proxy platform: ${platform}` },
        { status: 400 }
      );
    }

    const result = await handler({ title, text, token });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to publish' },
      { status: 500 }
    );
  }
}
