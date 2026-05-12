import { canonicalFooter, canonicalNav, cookieConsentScript, navScript, y2kCss } from "./y2k";

const BASE_URL = "https://veracityapi.com";
const DEFAULT_EXTENSION_ID = "__CHROME_STORE_EXTENSION_ID_TBD__";
const CHROME_WEB_STORE_URL = "/docs";

export function welcomeHtml(): string {
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to use the Veracity Chrome extension",
    description: "Highlight text, right-click, and choose Check with Veracity from Chrome's context menu.",
    step: [
      { "@type": "HowToStep", name: "Highlight text", text: "Highlight text on any webpage or draft." },
      { "@type": "HowToStep", name: "Right-click", text: "Right-click the highlighted text." },
      { "@type": "HowToStep", name: "Check with Veracity", text: "Choose Check with Veracity from the context menu." },
    ],
  });

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Veracity is installed — How to use Veracity</title><meta name="description" content="Learn how to use the Veracity Chrome extension: highlight text, right-click, and choose Check with Veracity."/>
<link rel="canonical" href="${BASE_URL}/welcome"/><meta property="og:title" content="Veracity is installed"/><meta property="og:description" content="Check any passage from your browser’s right-click menu."/><meta property="og:type" content="website"/><meta property="og:url" content="${BASE_URL}/welcome"/><link rel="icon" type="image/svg+xml" href="${BASE_URL}/favicon.svg"/><meta name="theme-color" content="#f4f0e8"/><script type="application/ld+json">${jsonLd}</script>
<style>${css()}</style></head><body class="loud welcomePage">
${canonicalNav("loud")}
<main class="welcome wrap">
  <section class="welcomeHero card">
    <div class="label">Chrome extension onboarding</div>
    <h1>Veracity is installed</h1>
    <p class="lead">Check any passage from your browser’s right-click menu.</p>
    <ol class="steps" aria-label="How to check selected text with Veracity">
      <li><span>1</span><b>Highlight text</b> on any webpage, CMS, document, or draft.</li>
      <li><span>2</span><b>Right-click</b> the highlighted text.</li>
      <li><span>3</span>Choose <b>Check with Veracity</b>.</li>
    </ol>
    <div class="actions">
      <button id="primaryCta" class="btn primary" type="button" disabled aria-busy="true">Checking extension…</button>
      <a class="btn" href="#try-it-now">Practice workflow</a>
    </div>
    <p id="stateNote" class="hint caveat">Veracity is workflow-risk triage for editors and reviewers — not proof of AI authorship or factual truth.</p>
  </section>

  <section class="section shots" aria-label="Veracity extension workflow screenshots">
    <figure class="card shot"><img src="/welcome/right-click-menu.webp" width="720" height="480" alt="Right-click menu showing Check with Veracity" loading="lazy"/><figcaption>Right-click any highlighted passage and choose <strong>Check with Veracity</strong>.</figcaption></figure>
    <figure class="card shot"><img src="/welcome/result-window.webp" width="720" height="480" alt="Veracity result window showing risk, evidence, trust score, and analysis ID" loading="lazy"/><figcaption>Review the risk level, recommended action, evidence, trust score, and analysis ID.</figcaption></figure>
  </section>

  <section class="section card practice" id="try-it-now">
    <div class="label">Try it out here</div>
    <h2>Highlight this sample paragraph</h2>
    <p class="practiceLead">Try it out here: highlight this paragraph, right-click, and choose <strong>Check with Veracity</strong>.</p>
    <p class="sampleText">Travelers visiting major European cities should always stay alert. Pickpockets are everywhere, scams happen constantly, and you should never trust strangers. Keep your belongings safe and avoid tourist areas because criminals target all visitors.</p>
    <p class="hint">This sample is intentionally broad so you can see workflow-risk triage in action. The extension requires a selection of at least 20 characters.</p>
  </section>

  <section class="section grid triple" aria-label="What Veracity is for">
    <div class="card"><div class="label">Best use</div><h3>Pre-publish review</h3><p>Use Veracity before publishing, citing, training on, or moderating a passage.</p></div>
    <div class="card"><div class="label">Output</div><h3>Action-first triage</h3><p>Results point to allow, revise, human_review, or reject instead of making forensic claims.</p></div>
    <div class="card"><div class="label">Fallback</div><h3>Popup still works</h3><p>If this page cannot talk to the extension, open the Veracity popup and connect there.</p></div>
  </section>
</main>
${canonicalFooter()}
<script>${js()}</script>${navScript()}${cookieConsentScript()}</body></html>`;
}

function css(): string {
  return y2kCss() + `.welcome{padding-top:32px;padding-bottom:48px}.welcomeHero{padding:28px;position:relative;overflow:hidden}.welcomeHero:after{content:"";position:absolute;right:-90px;top:-90px;width:260px;height:260px;border:3px solid var(--line);background:radial-gradient(circle,var(--cyan),transparent 58%),var(--yellow);border-radius:999px;opacity:.75}.welcomeHero>*{position:relative;z-index:1}.welcomeHero h1{font-size:clamp(42px,8vw,92px);line-height:.88;margin:12px 0;letter-spacing:-.07em}.welcomeHero .lead{max-width:780px}.steps{display:grid;gap:12px;margin:24px 0;padding:0;list-style:none;max-width:780px}.steps li{display:flex;gap:12px;align-items:flex-start;border:2px solid var(--line);background:var(--chrome2);box-shadow:3px 3px 0 var(--line);padding:12px 14px;font-size:20px}.steps span{display:inline-grid;place-items:center;min-width:32px;height:32px;border:2px solid var(--line);background:var(--acid-green);font:900 14px var(--mono);box-shadow:2px 2px 0 var(--line)}.actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.actions .btn[disabled]{opacity:.72;cursor:wait}.caveat{font-weight:800;max-width:840px}.shots{display:grid;grid-template-columns:1fr 1fr;gap:18px}.shot{margin:0}.shot img{width:100%;height:auto;display:block;border:2px solid var(--line);box-shadow:4px 4px 0 var(--line);background:#fffdf4}.shot figcaption{margin-top:12px;font-weight:800}.practice .practiceLead{font-size:18px;font-weight:800}.practice .sampleText{border:2px dashed var(--line);background:#fffdf4;padding:18px;font-size:18px;line-height:1.55;box-shadow:inset 3px 3px #eadfc9;user-select:text}.state-good{color:#006a3a}.state-warn{color:#935100}.state-bad{color:#9b1010}@media(max-width:900px){.shots{grid-template-columns:1fr}.welcomeHero h1{font-size:46px}.steps li{font-size:17px}}`;
}

function js(): string {
  return `(() => {
  const DEFAULT_EXTENSION_ID = ${JSON.stringify(DEFAULT_EXTENSION_ID)};
  const STORE_URL = ${JSON.stringify(CHROME_WEB_STORE_URL)};
  const params = new URLSearchParams(location.search);
  const extensionId = params.get('extension_id') || DEFAULT_EXTENSION_ID;
  const cta = document.getElementById('primaryCta');
  const note = document.getElementById('stateNote');
  let state = 'checking';

  function hasChromeRuntime() {
    return !!(window.chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function');
  }

  function sendToExtension(message, timeoutMs = 600) {
    return new Promise((resolve, reject) => {
      if (!hasChromeRuntime() || !extensionId || extensionId.includes('TBD')) return reject(new Error('extension_unavailable'));
      const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      chrome.runtime.sendMessage(extensionId, message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(response || {});
      });
    });
  }

  function setNote(text, className) {
    note.textContent = text;
    note.className = className || 'hint caveat';
  }

  function setState(next) {
    state = next;
    cta.disabled = false;
    cta.removeAttribute('aria-busy');
    if (next === 'checking') {
      cta.textContent = 'Checking extension…';
      cta.disabled = true;
      cta.setAttribute('aria-busy', 'true');
      setNote('Veracity is workflow-risk triage for editors and reviewers — not proof of AI authorship or factual truth.', 'hint caveat');
    } else if (next === 'not_installed') {
      cta.textContent = 'Install Veracity';
      setNote('Could not detect the extension from this tab. Install Veracity, or pass ?extension_id=<local-id> while testing an unpacked build.', 'hint state-warn');
    } else if (next === 'installed_disconnected') {
      cta.textContent = 'Connect Veracity';
      setNote('Extension detected. Connect your account to start checking selected text.', 'hint state-good');
    } else if (next === 'connecting') {
      cta.textContent = 'Opening connection…';
      cta.disabled = true;
      cta.setAttribute('aria-busy', 'true');
      setNote('Opening the Veracity connection flow…', 'hint state-good');
    } else if (next === 'connected') {
      cta.textContent = 'Try it now →';
      setNote('Connected. Highlight the sample paragraph below, right-click, and choose Check with Veracity.', 'hint state-good');
    } else {
      cta.textContent = 'Try opening the extension popup';
      setNote('Could not reach the extension. Open the Veracity popup and connect there.', 'hint state-bad');
    }
  }

  async function checkState() {
    if (params.get('connected') === 'true') return setState('connected');
    setState('checking');
    try {
      const response = await sendToExtension({ action: 'check-connection' });
      setState(response && response.connected ? 'connected' : 'installed_disconnected');
    } catch (_) {
      setState('not_installed');
    }
  }

  cta.addEventListener('click', async () => {
    if (state === 'not_installed') { location.href = STORE_URL; return; }
    if (state === 'connected') { document.getElementById('try-it-now')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (state === 'installed_disconnected') {
      setState('connecting');
      try {
        await sendToExtension({ action: 'connect' }, 1200);
        setNote('Connection window opened. Finish sign-in, then this tab will update.', 'hint state-good');
      } catch (_) {
        setState('error');
      }
    }
  });

  checkState();
})();`;
}
