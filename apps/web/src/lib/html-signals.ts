// Monotonic scanner: each tag/body is consumed once, including malformed input.
// Network timeouts cannot interrupt synchronous regular-expression backtracking.
export function scanHtml(html: string) {
  // HTML names are ASCII-insensitive. Unicode case folding can change offsets
  // (e.g. Turkish İ expands), so preserve the original string's code-unit length.
  const lower = html.replace(/[A-Z]/g, (c) => c.toLowerCase());
  const tags: Array<{ name: string; attrs: Record<string, string>; body: string | null }> = [];
  const text: string[] = [];
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf("<", cursor);
    if (start < 0) { text.push(html.slice(cursor)); break; }
    text.push(html.slice(cursor, start));
    if (html.startsWith("<!--", start)) {
      const end = html.indexOf("-->", start + 4);
      cursor = end < 0 ? html.length : end + 3;
      continue;
    }
    let end = start + 1;
    let quote = "";
    for (; end < html.length; end++) {
      const c = html[end];
      if (quote) { if (c === quote) quote = ""; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === ">") break;
    }
    if (end === html.length) break;
    cursor = end + 1;
    const token = html.slice(start + 1, end);
    const match = /^([a-z][a-z0-9:-]*)(?=\s|\/|$)/i.exec(token);
    if (!match) { text.push(" "); continue; }
    const name = match[1].toLowerCase();
    const attrs: Record<string, string> = Object.create(null);
    let p = match[0].length;
    while (p < token.length) {
      while (p < token.length && /[\s/]/.test(token[p])) p++;
      const a = p;
      while (p < token.length && !/[\s=/>]/.test(token[p])) p++;
      if (p === a) { p++; continue; }
      const key = token.slice(a, p).toLowerCase();
      while (p < token.length && /\s/.test(token[p])) p++;
      let value = "";
      if (token[p] === "=") {
        p++;
        while (p < token.length && /\s/.test(token[p])) p++;
        const q = token[p];
        if (q === '"' || q === "'") {
          const close = token.indexOf(q, p + 1);
          if (close < 0) break;
          value = token.slice(p + 1, close); p = close + 1;
        } else {
          const v = p;
          while (p < token.length && !/\s/.test(token[p])) p++;
          value = token.slice(v, p);
        }
      }
      if (!(key in attrs)) attrs[key] = value;
    }
    let body: string | null = null;
    if (["title", "script", "style", "noscript", "template"].includes(name)) {
      let close = lower.indexOf(`</${name}`, cursor);
      let closeEnd = -1;
      while (close >= 0) {
        let tail = close + name.length + 2;
        while (tail < lower.length && /\s/.test(lower[tail])) tail++;
        if (lower[tail] === ">") { closeEnd = tail + 1; break; }
        close = lower.indexOf(`</${name}`, tail);
      }
      if (close >= 0) {
        body = html.slice(cursor, close);
        cursor = closeEnd;
        if (name === "title") text.push(body);
      } else cursor = html.length;
    }
    tags.push({ name, attrs, body });
    text.push(" ");
  }
  return { tags, text: text.join(" ") };
}
