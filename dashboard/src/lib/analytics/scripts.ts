/**
 * Inline bootstrap scripts for gtag.js and Clarity. They read the stored
 * consent choice when they run (not when React rendered them), so a choice
 * made before a lazily loaded tag starts is still the one it sees.
 */

import { CONSENT_COUNTRIES, CONSENT_KEY, GEO_KEY, INTERNAL_KEY, type PageGroup } from "./config";

const js = (value: unknown) => JSON.stringify(value);

const DENIED_ADS = "ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'";

/**
 * GA4 with Consent Mode v2: analytics denied by default in the consent
 * countries (Google geolocates the hit), granted elsewhere, ads always denied.
 * When our own lookup (Cloudflare country, cached in bp_geo) already said this
 * visitor must be asked, the global default is denied too, so the two
 * geolocations disagreeing never sets cookies before a choice. A stored choice
 * is applied before `config`, so the first page_view already carries it. Enhanced measurement sends the page views (including client-side
 * route changes), so nothing here sends one by hand.
 *
 * gtag.js itself is injected from here as a plain async script (Google's own
 * snippet) rather than a `next/script` src: Next preloads those in <head> at
 * high priority, and the 150 KB download then competed with the fonts and CSS
 * for the LCP (Lighthouse mobile: LCP about 3.0 s → 4.0-4.3 s).
 */
export function gtagInitScript(id: string, group: PageGroup): string {
  return [
    "(function(){",
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){window.dataLayer.push(arguments);}",
    "window.gtag=gtag;",
    `gtag('consent','default',{analytics_storage:'denied',${DENIED_ADS},wait_for_update:500,region:${js(CONSENT_COUNTRIES)}});`,
    "var c=null,n=false,g=null;",
    `try{c=localStorage.getItem(${js(CONSENT_KEY)});n=localStorage.getItem(${js(INTERNAL_KEY)})==='1';g=JSON.parse(localStorage.getItem(${js(GEO_KEY)})||'null');}catch(e){}`,
    `gtag('consent','default',{analytics_storage:g&&g.r===true?'denied':'granted',${DENIED_ADS}});`,
    "if(c==='granted'||c==='denied')gtag('consent','update',{analytics_storage:c});",
    "gtag('js',new Date());",
    `var p={page_group:${js(group)},content_group:${js(group)}};`,
    "if(n)p.traffic_type='internal';",
    `gtag('config',${js(id)},p);`,
    "var s=document.createElement('script');s.async=true;",
    `s.src=${js(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`)};`,
    "document.head.appendChild(s);",
    "})();",
  ].join("");
}

/**
 * Microsoft's standard Clarity snippet, then the consent signal: the stored
 * choice, or "denied" while a visitor who must be asked has not answered
 * (`mustAsk`), so Clarity sets no cookies until they accept.
 */
export function clarityScript(id: string, group: PageGroup, mustAsk: boolean): string {
  return [
    "(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};",
    't=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;',
    `y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${js(id)});`,
    "(function(){var k=null,n=false;",
    `try{k=localStorage.getItem(${js(CONSENT_KEY)});n=localStorage.getItem(${js(INTERNAL_KEY)})==='1';}catch(e){}`,
    `if(k!=='granted'&&k!=='denied'&&${mustAsk ? "true" : "false"})k='denied';`,
    "if(k==='granted'||k==='denied')window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:k});",
    `window.clarity('set','page_group',${js(group)});`,
    "if(n)window.clarity('set','internal','1');",
    "})();",
  ].join("");
}
