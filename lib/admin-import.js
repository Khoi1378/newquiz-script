// lib/admin-import.js
export function parseVocabsFromHtml(html){
  const doc = new DOMParser().parseFromString(html, "text/html");
  const nodes = [...doc.querySelectorAll(".v")];

  const items = nodes.map(n => {
    const no = parseInt(n.getAttribute("data-no") || "0", 10) || null;
    const word = (n.getAttribute("data-word") || "").trim();
    const pos = (n.getAttribute("data-pos") || "").trim();
    const meaning = (n.textContent || "").trim();
    const ansRaw = (n.getAttribute("data-answers") || "").trim();
    const answers = ansRaw ? ansRaw.split("|").map(s=>s.trim()).filter(Boolean) : [];
    return { no, word, pos, meaning, answers };
  }).filter(x => x.word && x.meaning);

  return items;
}
