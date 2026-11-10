// Builds landing/sr/index.html, the Serbian landing page at https://leftovr.co/sr/.
//
// landing/index.html is the only source: English is its static HTML and Serbian
// is the `sr` dictionary in its inline I18N object. This writes the same page
// with every string already in Serbian, so crawlers that run no JavaScript read
// Serbian at /sr/.
//
//   node scripts/build-landing-sr.mjs           re-run after every edit to landing/index.html
//   node scripts/build-landing-sr.mjs --check   write nothing, fail if /sr/ is out of date
//
// Anything it expects and cannot find is an error, not a silent skip.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(root, "landing/index.html");
const OUT = resolve(root, "landing/sr/index.html");
const EN_URL = "https://leftovr.co/";
const SR_URL = "https://leftovr.co/sr/";

function fail(message) {
  throw new Error("build-landing-sr: " + message);
}

const escText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Replace `from` exactly once. (split/join, so "$" in a string stays literal.)
function swap(html, from, to) {
  const parts = html.split(from);
  if (parts.length !== 2) fail(`expected one "${from}", found ${parts.length - 1}`);
  return parts.join(to);
}

// Index of the closing tag that matches an element whose content starts at `from`.
function closeOf(html, from, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  re.lastIndex = from;
  let depth = 1;
  for (let m; (m = re.exec(html)); ) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index;
  }
  fail(`no closing </${tag}> after offset ${from}`);
}

function setAttr(openTag, name, value) {
  const re = new RegExp(`(\\s${name}=")[^"]*"`);
  if (!re.test(openTag)) return openTag.slice(0, -1) + ` ${name}="${escAttr(value)}">`;
  return openTag.replace(re, (_, start) => `${start}${escAttr(value)}"`);
}

export function build(source) {
  // The inline dictionary is a JS object literal in our own file, so evaluate it.
  const i18nStart = source.indexOf("var I18N = ");
  const i18nEnd = source.indexOf("\n  };\n", i18nStart);
  if (i18nStart < 0 || i18nEnd < 0) fail("cannot find the I18N object");
  const I18N = new Function("return " + source.slice(i18nStart + "var I18N = ".length, i18nEnd + 4))();
  const en = I18N.en;
  const dict = I18N.sr;
  const sr = (key) => (key in dict ? dict[key] : fail(`no Serbian string for "${key}"`));

  const headEnd = source.indexOf("</head>");
  let head = source.slice(0, headEnd);
  let body = source.slice(headEnd);

  // ── <head>: language, title, description, social tags, canonical ──
  const setMeta = (name, value) => {
    const re = new RegExp(`(<meta (?:name|property)="${name}" content=")[^"]*"`);
    if (!re.test(head)) fail(`no <meta> "${name}"`);
    head = head.replace(re, (_, start) => `${start}${escAttr(value)}"`);
  };
  head = swap(
    head,
    "<!DOCTYPE html>\n",
    "<!DOCTYPE html>\n<!-- Generated from landing/index.html by scripts/build-landing-sr.mjs. Do not edit: change index.html and re-run. -->\n",
  );
  head = swap(head, '<html lang="en"', '<html lang="sr"');
  head = swap(head, `<title>${escText(en["meta.title"])}</title>`, `<title>${escText(sr("meta.title"))}</title>`);
  setMeta("description", sr("meta.desc"));
  setMeta("og:title", sr("meta.title"));
  setMeta("og:description", sr("meta.desc"));
  setMeta("twitter:title", sr("meta.title"));
  setMeta("twitter:description", sr("meta.desc"));
  setMeta("og:url", SR_URL);
  setMeta("og:locale", "sr_RS");
  setMeta("og:locale:alternate", "en_US");
  head = swap(head, `<link rel="canonical" href="${EN_URL}" />`, `<link rel="canonical" href="${SR_URL}" />`);
  // The three hreflang links are the same on both pages, so they pass through.

  // ── JSON-LD ──
  // Serbian FAQ in the order it appears on the page; answers as plain text.
  const faq = [...body.matchAll(/data-i18n="faq\.q(\d+)"/g)].map((m) => ({
    "@type": "Question",
    name: sr(`faq.q${m[1]}`),
    acceptedAnswer: { "@type": "Answer", text: sr(`faq.a${m[1]}`).replace(/<[^>]+>/g, "") },
  }));
  if (!faq.length) fail("no FAQ questions in the markup");
  const ld = head.match(/(<script type="application\/ld\+json">\n)([\s\S]*?)(\n<\/script>)/);
  if (!ld) fail("no JSON-LD block");
  const data = JSON.parse(ld[2]);
  // The HowTo has no Serbian name or description in the dictionary, so /sr/ leaves it out.
  data["@graph"] = data["@graph"].filter((n) => n["@type"] !== "HowTo");
  const node = (type) => data["@graph"].find((n) => n["@type"] === type) || fail(`no ${type} in the JSON-LD`);
  Object.assign(node("WebPage"), {
    "@id": SR_URL + "#webpage",
    url: SR_URL,
    name: sr("meta.title"),
    description: sr("meta.desc"),
    inLanguage: "sr",
  });
  Object.assign(node("FAQPage"), { "@id": SR_URL + "#faq", inLanguage: "sr", mainEntity: faq });
  // Same app, described in Serbian. The English feature list and the USD offers
  // go: /sr/ shows its prices in euros and structured data has to match the page.
  const app = node("MobileApplication");
  app.description = sr("meta.desc");
  delete app.featureList;
  delete app.offers;
  head = head.replace(ld[0], () => ld[1] + JSON.stringify(data, null, 2) + ld[3]);

  // ── <body>: the toggle, then every tagged element ──
  body = swap(body, ' data-lang="en" aria-current="page">', ' data-lang="en">');
  body = swap(body, ' data-lang="sr">', ' data-lang="sr" aria-current="page">');

  // Scripts are skipped: they only mention these attributes in selectors.
  body = body
    .split(/(<script\b[\s\S]*?<\/script>)/)
    .map((part, i) => (i % 2 ? part : translateIdeas(fill(part))))
    .join("");

  // What applyLanguage() does in the browser: data-i18n is text, data-i18n-html
  // is markup, -aria and -ph are attributes. Elements with data-period-key start
  // on the monthly string, as applyPeriod() paints them.
  function fill(html) {
    const tags = [...html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\sdata-(?:i18n|period-key)[^>]*>/g)];
    // Last first, so the offsets of the earlier tags stay valid.
    for (const m of tags.reverse()) {
      const open = m[0];
      const attr = (name) => (open.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
      let newOpen = open;
      if (attr("data-i18n-aria")) newOpen = setAttr(newOpen, "aria-label", sr(attr("data-i18n-aria")));
      if (attr("data-i18n-ph")) newOpen = setAttr(newOpen, "placeholder", sr(attr("data-i18n-ph")));

      const textKey = attr("data-i18n") || (/\sdata-period-key\b/.test(open) ? attr("data-monthly") : undefined);
      const htmlKey = attr("data-i18n-html");
      const inner = textKey ? escText(sr(textKey)) : htmlKey ? sr(htmlKey) : null;

      const contentStart = m.index + open.length;
      const contentEnd = inner === null ? contentStart : closeOf(html, contentStart, m[1]);
      html = html.slice(0, m.index) + newOpen + (inner ?? "") + html.slice(contentEnd);
    }
    return html;
  }

  // #gen-ideas is painted by render() in index.html and carries no data-i18n.
  // Its static markup is the no-JS fallback, so translate it one text node at a
  // time by looking each English string up among the gen.* keys.
  function translateIdeas(html) {
    const open = '<div class="gen-ideas" id="gen-ideas" aria-live="polite">';
    const at = html.indexOf(open);
    if (at < 0) return html;
    const start = at + open.length;
    const end = closeOf(html, start, "div");
    const keyOf = new Map(Object.keys(en).filter((k) => k.startsWith("gen.")).map((k) => [en[k], k]));
    const decode = (s) => s.replace(/&#39;/g, "'").replace(/&middot;/g, "·").replace(/&amp;/g, "&");
    const one = (text) => {
      // "3 ideas" is gen.countN with its {n} filled in.
      const key = keyOf.get(text) || keyOf.get(text.replace(/\d+/, "{n}"));
      if (key) return sr(key).replace("{n}", () => text.match(/\d+/)[0]);
      if (/^\d+ min$/.test(text)) return text; // the same in both languages
      fail(`recipe demo text "${text}" matches no gen.* string`);
    };
    const block = html.slice(start, end).replace(/>([^<]+)</g, (whole, text) => {
      if (!text.trim()) return whole;
      return ">" + escText(decode(text).split(" · ").map(one).join(" · ")) + "<";
    });
    return html.slice(0, start) + block + html.slice(end);
  }

  return head + body;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const built = build(readFileSync(SRC, "utf8"));
  if (process.argv.includes("--check")) {
    let current = "";
    try { current = readFileSync(OUT, "utf8"); } catch {}
    if (current !== built) {
      console.error("landing/sr/index.html is out of date. Run: node scripts/build-landing-sr.mjs");
      process.exit(1);
    }
  } else {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, built);
    console.log("wrote landing/sr/index.html");
  }
}
