import { Readable } from 'node:stream';
import { URL } from 'node:url';

const ALLOWED_HOSTS = new Set([
  'drive.google.com',
  'docs.google.com',
  'drive.usercontent.google.com',
]);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function extractDriveId(url) {
  if (!url) return '';
  if (url.pathname.includes('/file/d/')) {
    const parts = url.pathname.split('/');
    const index = parts.indexOf('d');
    if (index !== -1 && parts[index + 1]) {
      return parts[index + 1];
    }
  }
  const id = url.searchParams.get('id');
  return id || '';
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawUrl = Array.isArray(req.query?.url) ? req.query.url[0] : req.query?.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  let target;
  try {
    target = new URL(rawUrl);
  } catch (err) {
    res.status(400).json({ error: 'Invalid url' });
    return;
  }

  if (!ALLOWED_HOSTS.has(target.hostname)) {
    res.status(400).json({ error: 'Host not allowed' });
    return;
  }

  if (target.hostname.endsWith('drive.google.com') || target.hostname.endsWith('docs.google.com')) {
    const fileId = extractDriveId(target);
    if (fileId) {
      target = new URL(`https://drive.google.com/uc?export=download&id=${fileId}`);
    }
  }

  try {
    const response = await fetch(target.toString(), { redirect: 'follow' });
    if (!response.ok || !response.body) {
      res.status(response.status || 502).json({ error: 'Upstream fetch failed' });
      return;
    }

    res.status(response.status);
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const contentLength = response.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'no-store');

    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);
  } catch (err) {
    res.status(502).json({ error: 'Proxy fetch failed' });
  }
}
