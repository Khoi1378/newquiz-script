// lib/api.js
// === CONFIG: dán SUPABASE_URL + ANON_KEY ở đây ===
const SUPABASE_URL = "https://aidvlydhbdtwunyreqak.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZHZseWRoYmR0d3VueXJlcWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MzM5NzYsImV4cCI6MjA4NDIwOTk3Nn0.LMKGjKlUbC5qoY7hqDpaDFQrFWfwKemBTpxjTNp_L8o";

// CDN supabase-js v2 exposes global: supabase
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// token lưu localStorage
const TOKEN_KEY = "tk_token_v1";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function setToken(t) {
  if (!t) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, t);
}

export async function rpc(fn, args = {}) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

// auth
export async function login(username, pin) {
  const out = await rpc("api_login", { p_username: username, p_pin: pin });
  if (!out?.ok) return out;
  setToken(out.token);
  return out;
}
export async function register(username, pin) {
  const out = await rpc("api_register", { p_username: username, p_pin: pin });
  if (!out?.ok) return out;
  setToken(out.token);
  return out;
}
export async function me() {
  const token = getToken();
  if (!token) return { ok: false, error: "NOT_LOGGED_IN" };
  return await rpc("api_me", { p_token: token });
}
export async function logout() {
  const token = getToken();
  if (token) await rpc("api_logout", { p_token: token });
  setToken("");
  return { ok: true };
}

// store + quiz
export async function listStore() {
  return await rpc("api_list_public_quizzes", {});
}
export async function getQuiz(quizId, accessCode = null) {
  return await rpc("api_get_quiz", { p_quiz_id: quizId, p_access_code: accessCode });
}

// progress
export async function saveProgress(quizId, stateJson) {
  const token = getToken();
  return await rpc("api_save_progress", { p_token: token, p_quiz_id: quizId, p_state: stateJson });
}
export async function loadProgress(quizId) {
  const token = getToken();
  return await rpc("api_get_progress", { p_token: token, p_quiz_id: quizId });
}

// attempts + leaderboard
export async function submitAttempt(quizId, score10, correct, total, answersArr = null) {
  const token = getToken();
  return await rpc("api_submit_attempt", {
    p_token: token,
    p_quiz_id: quizId,
    p_score10: score10,
    p_correct: correct,
    p_total: total,
    p_answers: answersArr
  });
}
export async function getLeaderboard(quizId, limit = 30) {
  return await rpc("api_get_leaderboard", { p_quiz_id: quizId, p_limit: limit });
}

// comments
export async function getComments(quizId) {
  return await rpc("api_get_comments", { p_quiz_id: quizId });
}
export async function addComment(quizId, parentId, text) {
  const token = getToken();
  return await rpc("api_add_comment", { p_token: token, p_quiz_id: quizId, p_parent: parentId, p_text: text });
}
export async function deleteComment(commentId) {
  const token = getToken();
  return await rpc("api_delete_comment", { p_token: token, p_comment_id: commentId });
}

// admin
export async function adminCreateQuiz(payload) {
  const token = getToken();
  return await rpc("admin_create_quiz", {
    p_token: token,
    p_quiz_id: payload.quiz_id || "",
    p_title: payload.title,
    p_sub: payload.sub || "",
    p_is_public: payload.is_public ?? true,
    p_is_hidden: payload.is_hidden ?? false,
    p_require_access_code: payload.require_access_code ?? false,
    p_access_code: payload.access_code ?? null
  });
}

export async function adminImportVocabs(quizId, items) {
  const token = getToken();
  return await rpc("admin_import_vocabs", { p_token: token, p_quiz_id: quizId, p_items: items });
}
export async function adminImportQuestions(quizId, items){
  return rpc("api_admin_import_questions", {
    p_token: getToken(),
    p_quiz_id: quizId,
    p_items: items
  });
}
