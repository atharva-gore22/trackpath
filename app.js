import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ─── STATE ───────────────────────────────────────────────
let roadmaps = {};
let currentSkill = null;
let progress = {};
let currentUser = null;

// ─── AUTH GATE ───────────────────────────────────────────
// If not logged in, send back to login page
onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;
  document.getElementById('user-name').textContent =
    user.displayName || user.email.split('@')[0];

  // Load roadmaps then load this user's progress from Firestore
  await loadRoadmaps();
  await loadProgress();
});

// ─── SIGN OUT ────────────────────────────────────────────
window.signOutUser = async function() {
  await signOut(auth);
  window.location.href = 'index.html';
};

// ─── LOAD ROADMAPS ───────────────────────────────────────
async function loadRoadmaps() {
  const [res, customSnap] = await Promise.all([
    fetch('roadmaps.json'),
    getDoc(doc(db, 'customRoadmaps', currentUser.uid))
  ]);

  roadmaps = await res.json();

  // Merge custom roadmaps into roadmaps
  if (customSnap.exists()) {
    Object.assign(roadmaps, customSnap.data());
  }

  // Add custom skills to the dropdown
  const select = document.getElementById('skill-select');
  if (customSnap.exists()) {
    const customs = customSnap.data();
    Object.entries(customs).forEach(([key, skill]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = skill.label + ' ✦';
      select.appendChild(opt);
    });
  }

  select.addEventListener('change', e => {
    currentSkill = e.target.value || null;
    renderRoadmap();
    updateStats();
  });

  document.getElementById('btn-recommend').addEventListener('click', getRecommendation);

  const params = new URLSearchParams(window.location.search);
  const skillFromUrl = params.get('skill');
  if (skillFromUrl && roadmaps[skillFromUrl]) {
    currentSkill = skillFromUrl;
    select.value = skillFromUrl;
    renderRoadmap();
    updateStats();
  }

}

// ─── LOAD PROGRESS FROM FIRESTORE ────────────────────────
// Each user has a document in the 'progress' collection
// Document ID = user's UID
// Structure: { topicId: timestamp, topicId: timestamp, ... }

async function loadProgress() {
  const ref = doc(db, 'progress', currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    progress = snap.data();
  } else {
    // First time user — create their document
    await setDoc(ref, {});
    progress = {};
  }
}

// ─── SAVE PROGRESS TO FIRESTORE ──────────────────────────
async function saveProgress() {
  const ref = doc(db, 'progress', currentUser.uid);
  await updateDoc(ref, progress);
}

// ─── RENDER ROADMAP ──────────────────────────────────────
function renderRoadmap() {
  const container = document.getElementById('roadmap-container');

  if (!currentSkill) {
    container.innerHTML = '<div class="empty-state">Select a skill above to get started.</div>';
    updateProgress(0, 0);
    return;
  }

  const skill  = roadmaps[currentSkill];
  const topics = skill.topics;

  const groups = {};
  topics.forEach(topic => {
    if (!groups[topic.category]) groups[topic.category] = [];
    groups[topic.category].push(topic);
  });

  let html = '';
  for (const [category, items] of Object.entries(groups)) {
    html += `<div class="category-group">`;
    html += `<div class="category-label">${category}</div>`;
    items.forEach(topic => {
      const isDone = !!progress[topic.id];
      html += buildTopicCard(topic, isDone);
    });
    html += `</div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.topic-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.btn-sm')) return;
      toggleTopic(card.dataset.id);
    });
  });

  container.querySelectorAll('.btn-explain').forEach(btn => {
    btn.addEventListener('click', () => explainTopic(btn.dataset.id));
  });

  container.querySelectorAll('.btn-quiz').forEach(btn => {
    btn.addEventListener('click', () => quizTopic(btn.dataset.id));
  });

  updateProgress(
    topics.filter(t => progress[t.id]).length,
    topics.length
  );
}

// ─── BUILD TOPIC CARD ────────────────────────────────────
function buildTopicCard(topic, isDone) {
  return `
    <div class="topic-card ${isDone ? 'done' : ''}" data-id="${topic.id}">
      <div class="topic-check"></div>
      <div class="topic-info">
        <div class="topic-title">${topic.title}</div>
        <div class="topic-hours">~${topic.hours}h estimated</div>
      </div>
      <div class="topic-actions">
        <button class="btn-sm btn-explain" data-id="${topic.id}">Explain</button>
        <button class="btn-sm btn-quiz"    data-id="${topic.id}">Quiz me</button>
      </div>
    </div>
  `;
}

// ─── TOGGLE TOPIC ────────────────────────────────────────
async function toggleTopic(topicId) {
  if (progress[topicId]) {
    delete progress[topicId];
  } else {
    progress[topicId] = Date.now();
  }

  // Save to Firestore immediately
  const ref = doc(db, 'progress', currentUser.uid);
  await setDoc(ref, progress);

  renderRoadmap();
  updateStats();
}

// ─── PROGRESS BAR ────────────────────────────────────────
function updateProgress(done, total) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-label').textContent = pct + '%';
}

// ─── STATS BAR ───────────────────────────────────────────
function updateStats() {
  if (!currentSkill) return;

  const topics = roadmaps[currentSkill].topics;
  const done   = topics.filter(t => progress[t.id]).length;

  document.getElementById('stat-done').textContent = done;
  document.getElementById('stat-total').textContent = topics.length;
  document.getElementById('stat-streak').textContent = calcStreak();

  const streakChip = document.getElementById('chip-streak');
  if (calcStreak() > 0) {
    streakChip.classList.add('streak-active');
  } else {
    streakChip.classList.remove('streak-active');
  }
}

// ─── STREAK ──────────────────────────────────────────────
function calcStreak() {
  const timestamps = Object.values(progress).filter(v => typeof v === 'number');
  if (timestamps.length === 0) return 0;

  const dates = [...new Set(
    timestamps.map(ts => new Date(ts).toDateString())
  )].sort((a, b) => new Date(b) - new Date(a));

  let streak = 0;
  let expected = new Date();
  expected.setHours(0, 0, 0, 0);

  for (const dateStr of dates) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const diff = (expected - d) / (1000 * 60 * 60 * 24);
    if (diff > 1) break;
    streak++;
    expected = d;
  }

  return streak;
}

// ─── AI HELPERS ──────────────────────────────────────────
function setAILoading(msg = 'Thinking') {
  document.getElementById('ai-output').innerHTML =
    `<p style="color:var(--muted)"><span class="loading-dot">${msg}</span></p>`;
  document.getElementById('btn-recommend').disabled = true;
}

function setAIOutput(html) {
  document.getElementById('ai-output').innerHTML = html;
  document.getElementById('btn-recommend').disabled = false;
}

function formatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// ─── GET RECOMMENDATION ──────────────────────────────────
async function getRecommendation() {
  if (!currentSkill) {
    setAIOutput('<p style="color:var(--muted)">Please select a skill first.</p>');
    return;
  }

  const topics = roadmaps[currentSkill].topics;
  const done   = topics.filter(t =>  progress[t.id]).map(t => t.title);
  const todo   = topics.filter(t => !progress[t.id]).map(t => t.title);

  const prompt = `
You are a learning advisor. The user is studying "${roadmaps[currentSkill].label}".
Completed topics: ${done.length > 0 ? done.join(', ') : 'None yet'}.
Remaining topics: ${todo.join(', ')}.
Recommend the best 2 topics to tackle next.
For each topic, write 2 sentences: why it's the right next step, and one tip to learn it effectively.
Keep it practical and encouraging. Use **bold** for topic names.
  `.trim();

  setAILoading('Getting your recommendation');

  try {
    const res = await fetch('https://trackpath-api.atharvagore229.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    setAIOutput(`<p>${formatText(data.reply)}</p>`);
  } catch (err) {
    setAIOutput('<p style="color:#f87171">Something went wrong. Check the Worker URL.</p>');
  }
}

// ─── EXPLAIN TOPIC ───────────────────────────────────────
async function explainTopic(topicId) {
  const topic = findTopic(topicId);
  if (!topic) return;

  const prompt = `
Explain "${topic.title}" to a beginner software developer in 4-5 sentences.
Cover: what it is, why it matters, and one real-world example.
Use **bold** for key terms.
  `.trim();

  setAILoading(`Explaining ${topic.title}`);

  try {
    const res = await fetch('https://trackpath-api.atharvagore229.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    setAIOutput(`<p><strong>${topic.title}</strong><br><br>${formatText(data.reply)}</p>`);
  } catch (err) {
    setAIOutput('<p style="color:#f87171">Something went wrong.</p>');
  }
}

// ─── QUIZ TOPIC ──────────────────────────────────────────
async function quizTopic(topicId) {
  const topic = findTopic(topicId);
  if (!topic) return;

  const prompt = `
Generate exactly 3 multiple choice questions about "${topic.title}" for a beginner developer.
Make the questions different every time — vary the difficulty and angle.
Respond in this exact JSON format (no extra text, no markdown):
[
  {
    "q": "Question here?",
    "options": ["A", "B", "C", "D"],
    "answer": "A"
  }
]
  `.trim();

  setAILoading(`Building quiz for ${topic.title}`);

  try {
    const res = await fetch('https://trackpath-api.atharvagore229.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    const clean = data.reply.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(clean);
    renderQuiz(topic.title, questions);
  } catch (err) {
    setAIOutput('<p style="color:#f87171">Couldn\'t generate quiz. Try again.</p>');
  }
}

// ─── RENDER QUIZ ─────────────────────────────────────────
function renderQuiz(title, questions) {
  let html = `<p style="font-weight:600;margin-bottom:12px">Quiz: ${title}</p>`;
  questions.forEach((q, i) => {
    html += `<div style="margin-bottom:14px">`;
    html += `<p style="font-size:13px;margin-bottom:8px"><strong>Q${i+1}:</strong> ${q.q}</p>`;
    q.options.forEach(opt => {
      html += `
        <button class="btn-sm quiz-opt"
          style="display:block;width:100%;text-align:left;margin-bottom:5px"
          data-correct="${opt === q.answer}"
          onclick="checkAnswer(this)">
          ${opt}
        </button>
      `;
    });
    html += `</div>`;
  });
  setAIOutput(html);
}

// ─── CHECK ANSWER ────────────────────────────────────────
window.checkAnswer = function(btn) {
  const isRight = btn.dataset.correct === 'true';
  btn.style.background  = isRight ? '#1a3d2b' : '#3d1a1a';
  btn.style.borderColor = isRight ? 'var(--green)' : '#f87171';
  btn.style.color       = isRight ? 'var(--green)' : '#f87171';
  btn.closest('div').querySelectorAll('.quiz-opt').forEach(b => b.disabled = true);
};

// ─── HELPER ──────────────────────────────────────────────
function findTopic(id) {
  if (!currentSkill) return null;
  return roadmaps[currentSkill].topics.find(t => t.id === id);
}