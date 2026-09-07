const BV_RE = /BV[0-9A-Za-z]{10}/;

export function extractBvid(href: string | null | undefined): string | null {
  if (!href) return null;
  const m = BV_RE.exec(href);
  return m ? m[0] : null;
}

export function normalizeAid(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^\d+$/.exec(v.trim());
  return m ? String(Number(m[0])) : null;
}

export function extractAid(href: string | null | undefined): string | null {
  if (!href) return null;
  const av = /\/video\/av(\d+)/.exec(href);
  if (av) return String(Number(av[1]));
  try {
    const u = new URL(href, 'https://www.bilibili.com');
    return normalizeAid(u.searchParams.get('aid') ?? u.searchParams.get('av'));
  } catch {
    return null;
  }
}

export function extractMid(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^\d+$/.exec(v.trim());
  return m ? String(Number(m[0])) : null;
}
