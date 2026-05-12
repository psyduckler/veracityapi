export const WELCOME_RIGHT_CLICK_PATH = "/welcome/right-click-menu.webp";
export const WELCOME_RESULT_PATH = "/welcome/result-window.webp";
export const WELCOME_PLACEHOLDER_CONTENT_TYPE = "image/svg+xml; charset=utf-8";

// Real baked-label WebP screenshots are not available in this Worker repo yet.
// These tiny SVG placeholders keep the documented /welcome/*.webp URLs live
// without embedding giant fake assets. Replace with real WebP bytes when ready.
export function welcomeRightClickSvg(): string {
  return svgPlaceholder(
    "Right-click menu",
    ["Selected text on page", "──────────────", "Copy", "Search the web", "✓ Check with Veracity"],
    "#b8ff00",
  );
}

export function welcomeResultSvg(): string {
  return svgPlaceholder(
    "Result window",
    ["risk level: medium", "recommended_action: human_review", "evidence: unsupported generic claims", "trust score: 42%", "analysis ID: ana_demo_welcome"],
    "#00d4ff",
  );
}

function svgPlaceholder(title: string, lines: string[], accent: string): string {
  const escapedTitle = escapeXml(title);
  const textLines = lines.map((line, index) => `<text x="76" y="${154 + index * 42}" class="line">${escapeXml(line)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480" role="img" aria-labelledby="title desc">
  <title id="title">${escapedTitle}</title>
  <desc id="desc">Temporary Veracity welcome screenshot placeholder.</desc>
  <style>
    .bg{fill:#f0ede7}.window{fill:#fffdf4;stroke:#0a0a0a;stroke-width:4}.bar{fill:#c8c3bb;stroke:#0a0a0a;stroke-width:4}.dot{stroke:#0a0a0a;stroke-width:3}.title{font:bold 32px system-ui,sans-serif;fill:#0a0a0a}.line{font:700 24px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#0a0a0a}.badge{fill:${accent};stroke:#0a0a0a;stroke-width:4}.shadow{fill:#0a0a0a;opacity:.18}
  </style>
  <rect class="bg" width="720" height="480"/>
  <path d="M36 44h612v360H36z" class="shadow" transform="translate(12 12)"/>
  <rect x="36" y="44" width="612" height="360" rx="10" class="window"/>
  <rect x="36" y="44" width="612" height="58" rx="10" class="bar"/>
  <circle cx="76" cy="73" r="12" fill="#ff2d8a" class="dot"/><circle cx="114" cy="73" r="12" fill="#ffd84d" class="dot"/><circle cx="152" cy="73" r="12" fill="#b8ff00" class="dot"/>
  <rect x="480" y="64" width="126" height="58" rx="6" class="badge" transform="rotate(6 543 93)"/>
  <text x="62" y="128" class="title">${escapedTitle}</text>
  ${textLines}
</svg>`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}
