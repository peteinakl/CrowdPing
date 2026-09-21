import QRCode from 'qrcode';

/**
 * Generated entirely in application code from the canonical HTTPS voting URL — never an
 * external QR service. Dark modules on white, a four-module quiet zone (margin: 4), preserved
 * square proportions. Error correction is raised to 'H' (~30% redundancy budget) specifically
 * to make room for the centred logo overlay below — a plain code only needs 'M'.
 */
const QR_RENDER_OPTIONS = {
  margin: 4,
  errorCorrectionLevel: 'H' as const,
  color: {
    dark: '#151417',
    light: '#ffffff',
  },
};

// public/brand/crowdping-logo.svg's real intrinsic size (1311×293) — used to size the overlay
// to this specific wordmark-shaped (wide, not square) logo's actual proportions, not a guess.
const LOGO_ASPECT = 293 / 1311;
// Fraction of the QR's width the logo's own width occupies. The raw area-vs-error-budget math
// looks safe well past this value, but real decoding (jsQR) is payload-dependent — module
// placement varies per URL, so a fraction that decodes for one payload can fail for another at
// the same nominal "% of area" covered. 0.25 was verified via a real decode test (jsQR, not
// just area math) across 30+ random poll codes plus the two that failed at 0.35; re-verify with
// a fresh decode test (see scratchpad qr-verify script) before raising this value again.
const LOGO_WIDTH_FRACTION = 0.25;
const LOGO_PADDING_FRACTION = 0.14; // of the logo's own width, applied on every side

let logoDataUrlPromise: Promise<string> | null = null;

/** Fetched once and memoised — the same verbatim brand asset used everywhere else in the app. */
function loadLogoDataUrl(): Promise<string> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch('/brand/crowdping-logo.svg')
      .then((res) => res.text())
      .then((svgText) => `data:image/svg+xml;base64,${btoa(svgText)}`);
  }
  return logoDataUrlPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load logo image'));
    img.src = src;
  });
}

/** The `qrcode` package always emits a square `viewBox="0 0 N N"`; N is in module units. */
function parseQrSize(svg: string): number {
  const match = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) \d+(?:\.\d+)?"/);
  if (!match) throw new Error('Could not read QR SVG viewBox');
  return Number(match[1]);
}

function overlayGeometry(size: number) {
  const logoWidth = size * LOGO_WIDTH_FRACTION;
  const logoHeight = logoWidth * LOGO_ASPECT;
  const padding = logoWidth * LOGO_PADDING_FRACTION;
  return {
    logoWidth,
    logoHeight,
    logoX: (size - logoWidth) / 2,
    logoY: (size - logoHeight) / 2,
    backingX: (size - logoWidth) / 2 - padding,
    backingY: (size - logoHeight) / 2 - padding,
    backingWidth: logoWidth + padding * 2,
    backingHeight: logoHeight + padding * 2,
  };
}

export async function toSvgString(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { ...QR_RENDER_OPTIONS, type: 'svg' });
  const size = parseQrSize(svg);
  const g = overlayGeometry(size);
  const logoHref = await loadLogoDataUrl();

  const overlay =
    `<rect x="${g.backingX}" y="${g.backingY}" width="${g.backingWidth}" height="${g.backingHeight}" fill="#ffffff"/>` +
    `<image x="${g.logoX}" y="${g.logoY}" width="${g.logoWidth}" height="${g.logoHeight}" href="${logoHref}"/>`;

  return svg.replace('</svg>', `${overlay}</svg>`);
}

export async function toPngDataUrl(url: string, size = 1024): Promise<string> {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, url, { ...QR_RENDER_OPTIONS, width: size });

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  const g = overlayGeometry(size);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(g.backingX, g.backingY, g.backingWidth, g.backingHeight);

  const logoHref = await loadLogoDataUrl();
  const logoImage = await loadImage(logoHref);
  ctx.drawImage(logoImage, g.logoX, g.logoY, g.logoWidth, g.logoHeight);

  return canvas.toDataURL('image/png');
}
