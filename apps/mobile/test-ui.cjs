const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const files = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []
  );
const sources = ['App.tsx', ...files('src')].map((f) => [f, fs.readFileSync(path.join(__dirname, f), 'utf8')]);
const offenders = (pattern) =>
  sources.flatMap(([f, s]) => [...s.matchAll(pattern)].map((m) => `${f}:${s.slice(0, m.index).split('\n').length} ${m[0]}`));

// Yazı boyutu alt sınırı 12 pt.
assert.deepEqual(offenders(/fontSize: ?([0-9]|1[01])(\.\d+)?\b/g), [], '12 pt altı yazı');

// Arayüz metninde emoji yok (web ile aynı kural).
assert.deepEqual(offenders(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu), [], 'emoji');

// Eski indigo/mor palet geri gelmesin; renkler theme/colors.ts üzerinden belirteç dosyasından gelir.
assert.deepEqual(offenders(/#6366F1|#8B5CF6|rgba\(99, ?102, ?241/gi), [], 'belirteç dışı marka rengi');

// Terim sözlüğündeki İngilizce ifadeler arayüz metnine girmez (web ile aynı liste).
const glossary = JSON.parse(fs.readFileSync(path.join(__dirname, '../../packages/glossary/terms.json'), 'utf8')).terms;
const termHits = sources.flatMap(([f, s]) =>
  s.split('\n').flatMap((line, i) =>
    /^\s*(\/\/|\*|\/\*|\{\/\*|import )/.test(line)
      ? []
      : glossary.filter((t) => new RegExp(t.pattern, t.flags).test(line)).map((t) => `${f}:${i + 1} → ${t.tr}`)
  )
);
assert.deepEqual(termHits, [], 'sözlükte Türkçesi olan İngilizce terim');

// Metni olmayan her dokunulabilir öğenin ekran okuyucu etiketi olmalı.
const unlabeled = [];
for (const [f, s] of sources) {
  for (const m of s.matchAll(/<(TouchableOpacity|Pressable)\b/g)) {
    let i = m.index + m[0].length;
    let depth = 0;
    while (!(s[i] === '>' && depth === 0)) {
      if (s[i] === '{') depth++;
      if (s[i] === '}') depth--;
      i++;
    }
    const opening = s.slice(m.index, i + 1);
    if (opening.includes('accessibilityLabel') || opening.includes('activeOpacity={1}')) continue;
    let inner = '';
    if (!opening.endsWith('/>')) {
      const tag = new RegExp(`<${m[1]}\\b|</${m[1]}>`, 'g');
      tag.lastIndex = i + 1;
      let open = 1;
      let t;
      while (open && (t = tag.exec(s))) open += t[0].startsWith('</') ? -1 : 1;
      inner = s.slice(i + 1, tag.lastIndex);
    }
    if (!/<Text\b|<TextInput\b|\{children\}/.test(inner)) unlabeled.push(`${f}:${s.slice(0, m.index).split('\n').length}`);
  }
}
assert.deepEqual(unlabeled, [], 'etiketsiz ikon düğmesi');

console.log('mobile ui checks: ok');
