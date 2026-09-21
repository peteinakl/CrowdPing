import { useEffect, useState } from 'react';
import { toSvgString } from '../../lib/qr';

interface QrCodeDisplayProps {
  url: string;
  className?: string;
}

/**
 * Sized clamp(480px, 42vh, 720px) square — at a 1920×1080 presentation
 * viewport this stays >=480x480px (PRD §4 QR legibility requirement).
 */
export function QrCodeDisplay({ url, className = '' }: QrCodeDisplayProps) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let active = true;
    toSvgString(url).then((result) => {
      if (active) setSvg(result);
    });
    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div
      className={`aspect-square bg-white ${className}`}
      style={{ width: 'clamp(480px, 42vh, 720px)' }}
      role="img"
      aria-label="QR code to join this poll"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
