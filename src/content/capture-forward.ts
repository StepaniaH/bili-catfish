import { CAPTURE_EVENT, CAPTURE_RESPONSE_EVENT } from './capture-event';

interface CaptureDetail {
  url: string;
  body: string | null;
}

interface CaptureResponseDetail {
  url: string;
  text: string;
}

export function installCaptureForwarding(
  onCapture: (url: string, body: string | null) => void,
): () => void {
  const handler = (e: Event): void => {
    const detail = (e as CustomEvent<CaptureDetail>).detail;
    if (detail && typeof detail.url === 'string') {
      onCapture(detail.url, detail.body ?? null);
    }
  };
  window.addEventListener(CAPTURE_EVENT, handler);
  return () => window.removeEventListener(CAPTURE_EVENT, handler);
}

export function installResponseForwarding(onResponse: (url: string, text: string) => void): () => void {
  const handler = (e: Event): void => {
    const detail = (e as CustomEvent<CaptureResponseDetail>).detail;
    if (detail && typeof detail.url === 'string' && typeof detail.text === 'string') {
      onResponse(detail.url, detail.text);
    }
  };
  window.addEventListener(CAPTURE_RESPONSE_EVENT, handler);
  return () => window.removeEventListener(CAPTURE_RESPONSE_EVENT, handler);
}
