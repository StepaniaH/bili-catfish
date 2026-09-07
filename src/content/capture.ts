export const CAPTURE_EVENT = 'bcf:capture';

interface HookableWindow {
  fetch: typeof fetch;
  XMLHttpRequest?: typeof XMLHttpRequest;
  dispatchEvent: (e: Event) => boolean;
  CustomEvent: typeof CustomEvent;
}

function emit(w: HookableWindow, url: string, body: string | null): void {
  w.dispatchEvent(new w.CustomEvent(CAPTURE_EVENT, { detail: { url, body } }));
}

export function installCaptureHook(w: HookableWindow): void {
  const origFetch = w.fetch.bind(w);
  w.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      let body: string | null = null;
      const raw = init?.body ?? (input instanceof Request ? input.body : null);
      if (typeof raw === 'string') body = raw;
      else if (raw instanceof URLSearchParams) body = raw.toString();
      emit(w, url, body);
    } catch {
      /* 捕获失败不影响请求 */
    }
    return origFetch(input as RequestInfo, init);
  } as typeof fetch;

  const XHR = w.XMLHttpRequest;
  if (!XHR) return;
  const origOpen = XHR.prototype.open;
  const origSend = XHR.prototype.send;
  XHR.prototype.open = function (this: XMLHttpRequest & { __bcfUrl?: string }, ...args: unknown[]) {
    this.__bcfUrl = String(args[1]);
    return origOpen.apply(this, args as Parameters<typeof origOpen>);
  };
  XHR.prototype.send = function (this: XMLHttpRequest & { __bcfUrl?: string }, body?: Document | XMLHttpRequestBodyInit | null) {
    try {
      let s: string | null = null;
      if (typeof body === 'string') s = body;
      else if (body instanceof URLSearchParams) s = body.toString();
      if (this.__bcfUrl) emit(w, this.__bcfUrl, s);
    } catch {
      /* 忽略 */
    }
    return origSend.call(this, body ?? null);
  };
}

if (typeof window !== 'undefined') {
  installCaptureHook(window as unknown as HookableWindow);
}
