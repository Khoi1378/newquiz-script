// lib/quiz.js
import { getQuiz, saveProgress, loadProgress, submitAttempt } from "./api.js";

export function getQuizIdFromPath() {
  const parts = location.pathname.split("/").filter(Boolean);
  // /q/<id>
  return parts[1] || "";
}

function norm(s){
  return (s||"").toString().trim().toLowerCase();
}

// loose match kiểu đơn giản
function okAnswer(user, answers, meaningFallback){
  const u = norm(user);
  if(!u) return false;
  const list = (answers && Array.isArray(answers) && answers.length) ? answers : [];
  const pool = list.map(norm);
  if(meaningFallback) pool.push(norm(meaningFallback));
  return pool.some(a => a && (u === a || a.includes(u) || u.includes(a)));
}

export async function runQuiz(rootEl){
  const quizId = getQuizIdFromPath();
  if(!quizId) { rootEl.innerHTML = "Missing quiz id"; return; }

  const data = await getQuiz(quizId, null);
  if(!data.ok) { rootEl.innerHTML = "Error: " + data.error; return; }

  const quiz = data.quiz;
  const vocabs = data.vocabs || [];

  // load autosave
  let saved = null;
  try{
    const p = await loadProgress(quizId);
    if(p.ok && p.progress?.state_json) saved = p.progress.state_json;
  }catch{}

  const state = {
    answers: (saved && saved.answers) ? saved.answers : {},
    startedAt: (saved && saved.startedAt) ? saved.startedAt : Date.now()
  };

  function render(){
    rootEl.innerHTML = `
      <h2 style="margin:0">${quiz.title}</h2>
      <div class="muted">${quiz.sub || ""}</div>
      <hr/>
      <div id="list"></div>
      <div style="margin-top:14px;display:flex;gap:10px;align-items:center">
        <button id="btnSave">Save</button>
        <button id="btnSubmit">Submit</button>
        <a class="muted" href="/">← về kệ hàng</a>
      </div>
    `;
    const list = rootEl.querySelector("#list");
    list.innerHTML = vocabs.map(v => `
      <div class="card">
        <div><b>${v.no ?? ""}.</b> <b>${escapeHtml(v.word)}</b> <span class="muted">${escapeHtml(v.pos||"")}</span></div>
        <div class="muted">Gợi ý: ${escapeHtml(v.meaning||"")}</div>
        <input data-vocab="${v.id}" placeholder="Nhập đáp án..." value="${escapeAttr(state.answers[v.id]||"")}" />
      </div>
    `).join("");

    list.querySelectorAll("input[data-vocab]").forEach(inp=>{
      inp.addEventListener("input", ()=>{
        state.answers[inp.dataset.vocab] = inp.value;
        debouncedSave();
      });
    });

    rootEl.querySelector("#btnSave").onclick = async () => {
      await saveProgress(quizId, state);
      alert("Đã lưu progress");
    };

    rootEl.querySelector("#btnSubmit").onclick = async () => {
      const res = grade(vocabs, state.answers);
      // save attempt (and detail)
      const out = await submitAttempt(
        quizId,
        res.score10,
        res.correct,
        res.total,
        res.details
      );
      if(!out.ok) return alert(out.error || "submit fail");

      // store last result locally for result page quick display
      localStorage.setItem("tk_last_result_"+quizId, JSON.stringify({
        at: Date.now(),
        score10: res.score10,
        correct: res.correct,
        total: res.total,
        details: res.details.map(d=>({
          vocab_id: d.vocab_id,
          user_answer: d.user_answer,
          ok: d.ok,
          expected: d.expected
        }))
      }));

      location.href = `/q/${quizId}/result`;
    };
  }

  function grade(vocabs, answersMap){
    let correct = 0;
    const total = vocabs.length || 0;
    const details = [];
    for(const v of vocabs){
      const ua = (answersMap && answersMap[v.id]) ? answersMap[v.id] : "";
      const ok = okAnswer(ua, v.answers, v.meaning);
      if(ok) correct++;
      details.push({
        vocab_id: v.id,
        user_answer: ua || "",
        ok,
        expected: (v.answers && v.answers.length) ? v.answers.join(" | ") : (v.meaning || "")
      });
    }
    const score10 = total ? Math.round((correct/total)*100)/10 : 0;
    return { correct, total, score10, details };
  }

  let t = null;
  async function debouncedSave(){
    clearTimeout(t);
    t = setTimeout(async ()=>{
      try{ await saveProgress(quizId, state); }catch{}
    }, 600);
  }

  render();
}

// safe html
function escapeHtml(s){
  return (s??"").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function escapeAttr(s){ return escapeHtml(s).replaceAll("\n"," "); }
