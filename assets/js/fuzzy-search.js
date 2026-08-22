// ============ Fuzzy Arabic Search Engine ============
// - Normalizes Arabic letter variants (أ/إ/آ/ا, ة/ه, ي/ى) and removes tashkeel
// - Tolerates small typos via Levenshtein distance
// - Scores + highlights matches
(function(window){

  function normalizeArabic(str){
    return String(str || '')
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')   // tashkeel + tatweel
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .toLowerCase()
      .trim();
  }

  function levenshtein(a, b){
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const dp = Array.from({length:m+1}, (_,i)=>[i, ...Array(n).fill(0)]);
    for (let j=0;j<=n;j++) dp[0][j]=j;
    for (let i=1;i<=m;i++){
      for (let j=1;j<=n;j++){
        dp[i][j] = a[i-1]===b[j-1]
          ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[m][n];
  }

  // best-effort substring/word fuzzy score against a full text field
  function fieldScore(query, text){
    const q = normalizeArabic(query);
    const t = normalizeArabic(text);
    if (!q) return 0;
    if (t === q) return 100;
    if (t.startsWith(q)) return 90;
    if (t.includes(q)) return 75;

    // token-level fuzzy match
    const words = t.split(/\s+/).filter(Boolean);
    let best = 0;
    for (const w of words){
      if (w.includes(q) || q.includes(w)) { best = Math.max(best, 60); continue; }
      const dist = levenshtein(q, w);
      const maxLen = Math.max(q.length, w.length) || 1;
      const similarity = 1 - dist / maxLen;
      if (similarity > 0.55) best = Math.max(best, Math.round(similarity * 55));
    }
    return best;
  }

  function search(query, products, opts={}){
    const q = query.trim();
    if (!q) return products.map(p=>({ item:p, score:1 }));

    const weights = { name:1, description:0.4, categoryName:0.5, specs:0.3 };
    const results = [];

    for (const p of products){
      let score = fieldScore(q, p.name) * weights.name;
      score = Math.max(score, fieldScore(q, p.categoryName) * weights.categoryName);
      score = Math.max(score, fieldScore(q, p.description) * weights.description);
      if (Array.isArray(p.specs)){
        for (const s of p.specs){
          score = Math.max(score, fieldScore(q, `${s.label} ${s.value}`) * weights.specs);
        }
      }
      if (score > 20) results.push({ item:p, score });
    }
    results.sort((a,b)=>b.score-a.score);
    return results;
  }

  // wraps matching portion of `text` with <mark> based on normalized query
  function highlight(text, query){
    if (!query) return text;
    const q = normalizeArabic(query);
    const norm = normalizeArabic(text);
    const idx = norm.indexOf(q);
    if (idx === -1 || !q) return text;
    return text.slice(0, idx) + '<mark>' + text.slice(idx, idx+q.length) + '</mark>' + text.slice(idx+q.length);
  }

  window.FuzzySearch = { normalizeArabic, levenshtein, fieldScore, search, highlight };

})(window);
