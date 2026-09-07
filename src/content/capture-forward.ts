import { CAPTURE_EVENT } from './capture';

interface CaptureDetail {
  url: string;
  body: string | null;
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
