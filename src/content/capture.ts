import { CAPTURE_EVENT, CAPTURE_RESPONSE_EVENT } from './capture-event';

export { CAPTURE_EVENT, CAPTURE_RESPONSE_EVENT };

interface HookableWindow {
  fetch: typeof fetch;
  XMLHttpRequest?: typeof XMLHttpRequest;
  dispatchEvent: (e: Event) => boolean;
  CustomEvent: typeof CustomEvent;
}

const RESPONSE_URL_PATTERNS = [
  /\/x\/web-interface\/(?:wbi\/)?index\/top\/feed\/rcmd/,
  /\/x\/web-interface\/(?:wbi\/)?index\/top\/rcmd/,
  /\/x\/web-interface\/(?:wbi\/)?search\/(?:all\/v2|type)/,
  /\/x\/web-interface\/(?:wbi\/)?(?:archive|view)\/related/,
];

const MAX_RESPONSE_CHARS = 2_000_000;

export function isObservableResponseUrl(url: string): boolean {
  return RESPONSE_URL_PATTERNS.some((re) => re.test(url));
}

function emit(w: HookableWindow, url: string, body: string | null): void {
  w.dispatchEvent(new w.CustomEvent(CAPTURE_EVENT, { detail: { url, body } }));
}

function emitResponse(w: HookableWindow, url: string, text: string): void {
  w.dispatchEvent(new w.CustomEvent(CAPTURE_RESPONSE_EVENT, { detail: { url, text } }));
}

function requestUrl(input: RequestInfo | URL): string {
  try {
    return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  } catch {
    return '';
  }
}

export function installCaptureHook(w: HookableWindow): void {
  const origFetch = w.fetch.bind(w);
  w.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = requestUrl(input);
    try {
      let body: string | null = null;
      const raw = init?.body ?? (input instanceof Request ? input.body : null);
      if (typeof raw === 'string') body = raw;
      else if (raw instanceof URLSearchParams) body = raw.toString();
      emit(w, url, body);
    } catch {
      /* 捕获失败不影响请求 */
    }
    const promise = origFetch(input as RequestInfo, init);
    if (url && isObservableResponseUrl(url)) {
      promise.then(
        (res) => {
          try {
            res.clone().text().then(
              (text) => {
                if (text.length <= MAX_RESPONSE_CHARS) emitResponse(w, url, text);
              },
              () => {},
            );
          } catch {
            /* 不可克隆时忽略 */
          }
        },
        () => {},
      );
    }
    return promise;
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
    if (this.__bcfUrl && isObservableResponseUrl(this.__bcfUrl)) {
      const url = this.__bcfUrl;
      this.addEventListener(
        'load',
        () => {
          try {
            let text: string | null = null;
            if (this.responseType === '' || this.responseType === 'text') text = this.responseText;
            else if (this.responseType === 'json' && this.response != null) text = JSON.stringify(this.response);
            if (text && text.length <= MAX_RESPONSE_CHARS) emitResponse(w, url, text);
          } catch {
            /* 读取失败忽略 */
          }
        },
        { once: true },
      );
    }
    return origSend.call(this, body ?? null);
  };
}

if (typeof window !== 'undefined') {
  installCaptureHook(window as unknown as HookableWindow);
}
