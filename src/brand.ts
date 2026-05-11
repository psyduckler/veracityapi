export function apiCubeLogoSvg(size = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512" role="img" aria-label="VeracityAPI">
  <defs><linearGradient id="apiCubeGradient" x1="129" y1="113" x2="383" y2="399" gradientUnits="userSpaceOnUse"><stop stop-color="#7C3AED"/><stop offset=".55" stop-color="#0EA5E9"/><stop offset="1" stop-color="#10B981"/></linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="#080B10"/>
  <path d="M256 92 389 169v154L256 400 123 323V169l133-77Z" fill="#0B1220" stroke="url(#apiCubeGradient)" stroke-width="20" stroke-linejoin="round"/>
  <path d="M256 92v154m133-77-133 77-133-77m133 77v154" fill="none" stroke="#1E293B" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M177 250 229 302 336 188" fill="none" stroke="#F8FAFC" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="256" cy="92" r="9" fill="#7C3AED"/><circle cx="389" cy="169" r="9" fill="#0EA5E9"/><circle cx="256" cy="400" r="9" fill="#10B981"/><circle cx="123" cy="169" r="9" fill="#38BDF8"/>
</svg>`;
}

export function logoMarkHtml(): string {
  return `<span class="mark" aria-hidden="true">${apiCubeLogoSvg(28)}</span>`;
}
