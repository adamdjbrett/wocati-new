// Make markdown-it emit kramdown-shaped list HTML so output matches the
// Jekyll (kramdown) build. kramdown indents:
//   <ul>            depth 0 tag -> col 0
//     <li>a</li>    depth 0 item -> col 2      (4*d + 2)
//   </ul>
// nested:
//   <li><a>x</a>
//       <ul>        depth 1 tag -> col 4       (4*d)
//         <li>y</li>  depth 1 item -> col 6
//       </ul>
//     </li>         closing li back at col 2
export default function kramdownIndent(md) {
  const parse = md.parse.bind(md);
  md.parse = (src, env) => parse(kramdownPreprocess(src), env);
  const render = md.renderer.render.bind(md.renderer);
  md.renderer.render = (tokens, options, env) => indentLists(render(tokens, options, env));
  md.core.ruler.push("kramdown_loose", kramdownLooseLists);
}

function kramdownPreprocess(src) {
  let inOrderedItem = false;
  return String(src).split("\n").map((line) => {
    if (/^\d+\.\s+/.test(line)) {
      inOrderedItem = true;
      return line;
    }
    if (inOrderedItem && /^ {2}([*+-]\s+)/.test(line)) {
      return line.replace(/^ {2}([*+-]\s+)/, "    $1");
    }
    if (!/^ {4,}\S/.test(line) && !/^ {2}([*+-]\s+)/.test(line)) {
      inOrderedItem = false;
    }
    return line;
  }).join("\n");
}

/**
 * kramdown looseness is per-item (an item is loose only when a blank line
 * separates it from its successor); CommonMark makes the whole list loose.
 * Re-hide paragraph tokens for items that kramdown would render tight.
 */
function kramdownLooseLists(state) {
  const lines = state.src.split("\n");
  const toks = state.tokens;
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].type !== "list_item_open" || !toks[i].map) continue;
    const [start, end] = toks[i].map; // end is exclusive
    // kramdown: item is loose iff the line right after its content is blank
    // and the list continues after it.
    let lastContent = end - 1;
    while (lastContent > start && !(lines[lastContent] ?? "").trim()) lastContent--;
    const blankAfter = lastContent + 1 < lines.length && !(lines[lastContent + 1] ?? "").trim();
    // find the matching close to know if the list continues
    let depth = 0, j = i, closeIdx = -1;
    for (; j < toks.length; j++) {
      if (toks[j].type === "list_item_open") depth++;
      if (toks[j].type === "list_item_close" && --depth === 0) { closeIdx = j; break; }
    }
    const listContinues = closeIdx > -1 && toks[closeIdx + 1] && toks[closeIdx + 1].type === "list_item_open";
    const loose = blankAfter && listContinues;
    // toggle paragraphs directly nested in this item
    const itemLevel = toks[i].level + 1;
    for (let k = i + 1; k < closeIdx; k++) {
      if ((toks[k].type === "paragraph_open" || toks[k].type === "paragraph_close") && toks[k].level === itemLevel) {
        toks[k].hidden = !loose;
      }
    }
  }
}

export function indentLists(html) {
  const lines = String(html).split("\n");
  let depth = 0;
  const out = [];
  for (const raw of lines) {
    const t = raw;
    if (/^<\/(ul|ol)>/.test(t)) {
      depth = Math.max(0, depth - 1);
      out.push(" ".repeat(4 * depth) + t);
    } else if (/^<(ul|ol)(\s|>)/.test(t)) {
      out.push(" ".repeat(4 * depth) + t);
      depth += 1;
    } else if (depth > 0) {
      const indent = /^<\/?li(\s|>)/.test(t) ? 4 * (depth - 1) + 2 : 4 * (depth - 1) + 4;
      out.push(" ".repeat(indent) + t);
    } else {
      out.push(t);
    }
  }
  return out.join("\n");
}
