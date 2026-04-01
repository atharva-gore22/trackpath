// ─── STATE ──────────────────────────────────────────────
// These variables hold everything the app needs to know right now.
// 'roadmaps' will hold all data loaded from roadmaps.json
// 'currentSkill' tracks which skill the user has selected
// 'progress' is an object like { "html-basics": 1704067200000 }
//   (topic id → timestamp of when it was checked)

let roadmaps = {};
let currentSkill = null;
let progress = {};

// ─── INIT ────────────────────────────────────────────────
// This runs once when the page loads.
// It loads roadmaps.json, restores saved progress, and sets up the dropdown.

async function init() {
  const res = await fetch('roadmaps.json');
  roadmaps = await res.json();

  progress = JSON.parse(localStorage.getItem('tp_progress') || '{}');

  document.getElementById('skill-select').addEventListener('change', e => {
    currentSkill = e.target.value || null;
    renderRoadmap();
    updateStats();
  });

  document.getElementById('btn-recommend').addEventListener('click', getRecommendation);
}

// ─── RENDER ROADMAP ──────────────────────────────────────
// Builds the topic cards for the selected skill.
// Groups topics by their 'category' field.

function renderRoadmap() {
  const container = document.getElementById('roadmap-container');

  if (!currentSkill) {
    container.innerHTML = '<div class="empty-state">Select a skill above to get started.</div>';
    updateProgress(0, 0);
    return;
  }

  const skill = roadmaps[currentSkill];
  const topics = skill.topics;

  // Group topics by category
  // Result looks like: { "HTML": [...topics], "CSS": [...topics], ... }
  const groups = {};
  topics.forEach(topic => {
    if (!groups[topic.category]) groups[topic.category] = [];
    groups[topic.category].push(topic);
  });

  // Build HTML for each group
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

  // Attach click handlers to every card
  container.querySelectorAll('.topic-card').forEach(card => {
    card.addEventListener('click', e => {
      // Don't toggle if user clicked a button inside the card
      if (e.target.closest('.btn-sm')) return;
      toggleTopic(card.dataset.id);
    });
  });

  // Attach explain/quiz button handlers
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
// Returns the HTML string for one topic card.
// We use data-id to identify which topic was clicked.

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
// Marks a topic as done or undone, saves to localStorage.

function toggleTopic(topicId) {
  if (progress[topicId]) {
    delete progress[topicId];       // Uncheck: remove from progress
  } else {
    progress[topicId] = Date.now(); // Check: store current timestamp
  }

  localStorage.setItem('tp_progress', JSON.stringify(progress));
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
// Updates the top bar: topics done and streak count.

function updateStats() {
  if (!currentSkill) return;

  const topics = roadmaps[currentSkill].topics;
  const done = topics.filter(t => progress[t.id]).length;

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

// ─── STREAK CALCULATION ──────────────────────────────────
// Counts how many consecutive days the user checked at least one topic.
// Uses the timestamps stored in progress.

function calcStreak() {
  const timestamps = Object.values(progress);
  if (timestamps.length === 0) return 0;

  // Get unique dates (as "YYYY-MM-DD" strings) sorted newest first
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
    if (diff > 1) break;       // Gap found — streak ends
    streak++;
    expected = d;
  }

  return streak;
}

// ─── AI OUTPUT HELPERS ───────────────────────────────────
// Sets the AI panel to a loading state or renders a response.

function setAILoading(msg = 'Thinking') {
  document.getElementById('ai-output').innerHTML =
    `<p style="color:var(--muted)"><span class="loading-dot">${msg}</span></p>`;
  document.getElementById('btn-recommend').disabled = true;
}

function setAIOutput(html) {
  document.getElementById('ai-output').innerHTML = html;
  document.getElementById('btn-recommend').disabled = false;
}

// Converts **bold** markdown to <strong> tags
function formatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// ─── GET RECOMMENDATION ──────────────────────────────────
// THE MAIN AI FEATURE.
// Sends the user's progress to the Cloudflare Worker,
// which adds the API key and calls Groq.

async function getRecommendation() {
  if (!currentSkill) {
    setAIOutput('<p style="color:var(--muted)">Please select a skill first.</p>');
    return;
  }

  const topics = roadmaps[currentSkill].topics;
  const done  = topics.filter(t =>  progress[t.id]).map(t => t.title);
  const todo  = topics.filter(t => !progress[t.id]).map(t => t.title);

  const prompt = `
You are a learning advisor. The user is studying "${roadmaps[currentSkill].label}".

Completed topics: ${done.length > 0 ? done.join(', ') : 'None yet'}.
Remaining topics: ${todo.join(', ')}.

Based on their progress, recommend the best 2 topics to tackle next.
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
// Sends a topic name to the AI and asks for a plain explanation.

async function explainTopic(topicId) {
  const topic = findTopic(topicId);
  if (!topic) return;

  const prompt = `
Explain "${topic.title}" to a beginner software developer in 4–5 sentences.
Cover: what it is, why it matters, and one real-world example of where it's used.
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
// Asks the AI for 3 MCQs on a topic and renders them as clickable options.

async function quizTopic(topicId) {
  const topic = findTopic(topicId);
  if (!topic) return;

  const prompt = `
Generate exactly 3 multiple choice questions about "${topic.title}" for a beginner developer.

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

    // Strip any markdown code fences the AI might add
    const clean = data.reply.replace(/```json|```/g, '').trim();
    const questions = JSON.parse(clean);

    renderQuiz(topic.title, questions);
  } catch (err) {
    setAIOutput('<p style="color:#f87171">Couldn\'t generate quiz. Try again.</p>');
  }
}

// ─── RENDER QUIZ ─────────────────────────────────────────
// Takes the parsed quiz questions and builds interactive HTML.

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
          onclick="checkAnswer(this, '${q.answer}')">
          ${opt}
        </button>
      `;
    });
    html += `</div>`;
  });

  setAIOutput(html);
}

// ─── CHECK ANSWER ────────────────────────────────────────
// Called when user clicks a quiz option. Shows correct/wrong feedback.

function checkAnswer(btn, correct) {
  const isRight = btn.dataset.correct === 'true';
  btn.style.background    = isRight ? '#1a3d2b' : '#3d1a1a';
  btn.style.borderColor   = isRight ? 'var(--green)' : '#f87171';
  btn.style.color         = isRight ? 'var(--green)' : '#f87171';

  // Disable all sibling options for this question
  btn.closest('div').querySelectorAll('.quiz-opt').forEach(b => {
    b.disabled = true;
  });
}

// ─── HELPER ──────────────────────────────────────────────

function findTopic(id) {
  if (!currentSkill) return null;
  return roadmaps[currentSkill].topics.find(t => t.id === id);
}

// ─── START ───────────────────────────────────────────────
init();