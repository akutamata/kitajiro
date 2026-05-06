// jpn_parser.js
// export: prettifyJpnToHtml(jpnText)

const TONE = {
  "ang1":"āng","ang2":"áng","ang3":"ǎng","ang4":"àng",
  "eng1":"ēng","eng2":"éng","eng3":"ěng","eng4":"èng",
  "ing1":"īng","ing2":"íng","ing3":"ǐng","ing4":"ìng",
  "ong1":"ōng","ong2":"óng","ong3":"ǒng","ong4":"òng",
  "ai1":"āi","ai2":"ái","ai3":"ǎi","ai4":"ài",
  "an1":"ān","an2":"án","an3":"ǎn","an4":"àn",
  "ao1":"āo","ao2":"áo","ao3":"ǎo","ao4":"ào",
  "ei1":"ēi","ei2":"éi","ei3":"ěi","ei4":"èi",
  "en1":"ēn","en2":"én","en3":"ěn","en4":"èn",
  "er1":"ēr","er2":"ér","er3":"ěr","er4":"èr",
  "ie1":"iē","ie2":"ié","ie3":"iě","ie4":"iè",
  "in1":"īn","in2":"ín","in3":"ǐn","in4":"ìn",
  "ng2":"ńg","ng3":"ňg","ng4":"ǹg",
  "ou1":"ōu","ou2":"óu","ou3":"ǒu","ou4":"òu",
  "un1":"ūn","un2":"ún","un3":"ǔn","un4":"ùn",
  "ve3":"üě","ve4":"üè",
  "a1":"ā","a2":"á","a3":"ǎ","a4":"à",
  "e1":"ē","e2":"é","e3":"ě","e4":"è",
  "i1":"ī","i2":"í","i3":"ǐ","i4":"ì",
  "o1":"ō","o2":"ó","o3":"ǒ","o4":"ò",
  "u1":"ū","u2":"ú","u3":"ǔ","u4":"ù",
  "v1":"ǖ","v2":"ǘ","v3":"ǚ","v4":"ǜ",
};

// HTMLエスケープ（XSS対策の要）
function escapeHtml(s){
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ピンイン声調変換
function toneConv(str){
  const m = String(str).match(/(ang|eng|ing|ong|ai|an|ao|ei|en|er|ie|in|ng|ou|un|ve|a|e|i|u|o|v)[1-4]{1}/g);
  if (!m) return String(str);
  let out = String(str);
  for (const target of m){
    if (Object.prototype.hasOwnProperty.call(TONE, target)){
      out = out.replaceAll(target, TONE[target]);
    }
  }
  return out;
}

// インライン記法 → HTML
// 注意：ここは「まず escapeHtml してから」記法だけ戻す
function applyInlineMarkup(escaped){
  let s = escaped;

  // {{...}} -> 中国語span（※中身はエスケープ済み）
  s = s.replace(/\{\{([^\}]+)\}\}/g, '<span lang="zh" class="cn">$1</span>');

  // [[http... title]] -> 外部リンク
  s = s.replace(/\[\[(https?:\/\/[^ 　]+)(?: |　)([^\]]+)\]\]/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>'
  );

  // [[...]] -> クリック用（内部リンク扱い）
  s = s.replace(/\[\[([^\]]+)\]\]/g, '<span lang="zh" class="cn click">$1</span>');
  
  //((...)) -> 引用記法（サテライトでは削除）
  s = s.replace(/\(\(([^\)]+)\)\)/g, '');

  // {漢字|よみ} / 漢字{よみ} -> ruby
  s = s.replace(/\{([一-龠]+)\|([^\}]+)\}/g, '<ruby><rb>$1</rb><rp>(</rp><rt>$2</rt><rp>)</rp></ruby>');
  s = s.replace(/([一-龠]+)\{([^\}]+)\}/g, '<ruby><rb>$1</rb><rp>(</rp><rt>$2</rt><rp>)</rp></ruby>');
  
  //部首画数と異体字の見出し
  s = s.replace(/^異体字$/g, '<strong>異体字</strong>');
  s = s.replace(/^部首画数$/g, '<strong>部首画数</strong>');

  return s;
}

// メイン：構造化テキスト → HTML文字列
export function prettifyJpnToHtml(jpnText){
  if (!jpnText) return "";

  const lines = String(jpnText).replace(/■/g, "\n").split(/\n/);

  let html = "";

  // +リスト状態
  let collectingOl = false;
  let olItems = "";

  // 「次に付与される番号」（1-based）
  // 例文で ol を閉じても、この値は保持する
  let nextNumber = 1;

  function flushOl(){
    if (!collectingOl) return;

    // このブロックの開始番号 = nextNumber - li数
    const liCount = (olItems.match(/<li\b/g) || []).length;
    const startNumber = nextNumber - liCount;

    const startAttr = (startNumber > 1) ? ` start="${startNumber}"` : "";
    html += `<ol${startAttr}>${olItems}</ol>`;

    collectingOl = false;
    olItems = "";
  }

  function resetNumbering(){
    // * 行だけでリセット
    flushOl();
    nextNumber = 1;
  }

  for (let raw of lines){
    const line = String(raw).trimEnd();

    // 空行は完全に無視（番号もリセットしないし、olも閉じない）
    if (/^\s*$/.test(line)) continue;

    // * ピンイン行：番号を1に戻す
    if (line.startsWith("*")){
      resetNumbering();

      const content = toneConv(line.replace(/^\*\s*/, ""));
      const esc = escapeHtml(content);
      html += `<p class="pyn">${applyInlineMarkup(esc)}</p>`;
      continue;
    }

    // + 番号付きリスト
    if (line.startsWith("+")){
      const content = line.replace(/^\+\s*/, "");
      const esc = escapeHtml(content);

      if (!collectingOl){
        collectingOl = true;
        olItems = "";
      }

      olItems += `<li>${applyInlineMarkup(esc)}</li>`;
      nextNumber += 1;
      continue;
    }

    // 通常行（例文等）：ここで ol を閉じる。ただし nextNumber は保持される
    flushOl();

    const esc = escapeHtml(line);
    html += `<p>${applyInlineMarkup(esc)}</p>`;
  }

  flushOl();
  return `<div class="jpn">${html}</div>`;
}


