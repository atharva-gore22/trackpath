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
let customRoadmaps = {};
let progress = {};
let currentUser = null;

// ─── AUTH GATE ───────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;

  const [roadmapRes, progressSnap, customSnap] = await Promise.all([
    fetch('roadmaps.json').then(r => r.json()),
    getDoc(doc(db, 'progress', user.uid)),
    getDoc(doc(db, 'customRoadmaps', user.uid))
  ]);

  roadmaps       = roadmapRes;
  progress       = progressSnap.exists()  ? progressSnap.data()  : {};
  customRoadmaps = customSnap.exists()    ? customSnap.data()    : {};

  renderDashboard();
});

// ─── SIGN OUT ────────────────────────────────────────────
window.signOutUser = async function() {
  await signOut(auth);
  window.location.href = 'index.html';
};

// ─── RENDER DASHBOARD ────────────────────────────────────
function renderDashboard() {
  const user = currentUser;
  const name = user.displayName || user.email.split('@')[0];

  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('dash-avatar').textContent   = initials;
  document.getElementById('user-name').textContent     = name;

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent = `${greeting}, ${name.split(' ')[0]}!`;

  const allTopics  = getAllTopics();
  const doneTopics = allTopics.filter(t => progress[t.id]);
  const totalHours = doneTopics.reduce((sum, t) => sum + (t.hours || 0), 0);
  const xp         = doneTopics.length * 10;
  const streak     = calcStreak();

  const sub =
    doneTopics.length === 0 ? 'Pick a skill and start your journey.'  :
    doneTopics.length < 5   ? 'Great start! Keep building momentum.'  :
    doneTopics.length < 15  ? "You're on a roll. Keep it up!"         :
                               "Impressive progress. You're crushing it!";

  document.getElementById('dash-sub').textContent          = sub;
  document.getElementById('dash-xp').textContent           = xp;
  document.getElementById('stat-total-done').textContent   = doneTopics.length;
  document.getElementById('stat-streak').textContent       = streak;
  document.getElementById('stat-hours').textContent        = totalHours + 'h';
  document.getElementById('stat-xp').textContent           = xp;
  document.getElementById('nav-streak').textContent        = streak;

  if (streak > 0) {
    document.getElementById('chip-streak').classList.add('streak-active');
  }

  renderSkillCards();
  renderActivity(doneTopics);
}

// ─── SKILL CARDS ─────────────────────────────────────────
function renderSkillCards() {
  const container = document.getElementById('skill-cards');

  const defaultColors = {
    webdev: { color: '#00d4ff', dim: '#003d52' },
    dsa:    { color: '#00e676', dim: '#003320' },
    python: { color: '#ffab00', dim: '#3d2800' }
  };

  // Merge default + custom roadmaps
  const allRoadmaps = { ...roadmaps };
  Object.entries(customRoadmaps).forEach(([key, val]) => {
    allRoadmaps[key] = val;
  });

  const customColors = [
    { color: '#a78bfa', dim: '#2d1f5e' },
    { color: '#f472b6', dim: '#4a1535' },
    { color: '#fb923c', dim: '#4a2010' },
    { color: '#34d399', dim: '#0d3326' },
    { color: '#60a5fa', dim: '#0d2d52' },
  ];
  let customColorIdx = 0;

  container.innerHTML = Object.entries(allRoadmaps).map(([key, skill]) => {
    const topics = skill.topics || [];
    const done   = topics.filter(t => progress[t.id]).length;
    const total  = topics.length;
    const pct    = total === 0 ? 0 : Math.round((done / total) * 100);
    const xp     = done * 10;

    const c = defaultColors[key] || customColors[customColorIdx++ % customColors.length];
    const isCustom = !defaultColors[key];

    return `
      <a href="app.html?skill=${key}&custom=${isCustom}" class="skill-card"
        style="--skill-color:${c.color};--skill-dim:${c.dim}">
        ${isCustom ? `<span class="custom-badge">Custom</span>` : ''}
        <div class="skill-card-header">
          <span class="skill-card-name">${skill.label}</span>
          <span class="skill-card-xp">${xp} XP</span>
        </div>
        <div class="skill-ring-wrap">
          <svg class="skill-ring" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none"
              stroke="var(--border)" stroke-width="6"/>
            <circle cx="40" cy="40" r="32" fill="none"
              stroke="${c.color}" stroke-width="6"
              stroke-linecap="round"
              stroke-dasharray="${2 * Math.PI * 32}"
              stroke-dashoffset="${2 * Math.PI * 32 * (1 - pct / 100)}"
              transform="rotate(-90 40 40)"
              style="transition: stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)"/>
            <text x="40" y="40" text-anchor="middle"
              dominant-baseline="central"
              fill="${c.color}"
              font-size="14" font-weight="700"
              font-family="Inter, sans-serif">${pct}%</text>
          </svg>
        </div>
        <div class="skill-card-footer">
          <span style="color:var(--muted);font-size:12px">${done} / ${total} topics</span>
          <span class="skill-card-cta">Continue →</span>
        </div>
      </a>
    `;
  }).join('');
}

// ─── RECENT ACTIVITY ─────────────────────────────────────
function renderActivity(doneTopics) {
  const container = document.getElementById('activity-list');

  if (doneTopics.length === 0) {
    container.innerHTML = `
      <div class="activity-empty">
        No activity yet. <a href="app.html" style="color:var(--cyan)">Start learning →</a>
      </div>`;
    return;
  }

  const sorted = [...doneTopics]
    .sort((a, b) => (progress[b.id] || 0) - (progress[a.id] || 0))
    .slice(0, 6);

  container.innerHTML = sorted.map(topic => {
    const ts = progress[topic.id];
    return `
      <div class="activity-item">
        <div class="activity-check">✓</div>
        <div class="activity-info">
          <span class="activity-title">${topic.title}</span>
          <span class="activity-time">${getTimeAgo(ts)}</span>
        </div>
        <span class="activity-xp">+10 XP</span>
      </div>
    `;
  }).join('');
}

// ─── MODAL ───────────────────────────────────────────────
window.openModal = function() {
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('custom-skill-input').focus();
};

window.closeModal = function() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('custom-skill-input').value = '';
  document.getElementById('modal-error').textContent = '';
  document.getElementById('gen-status').style.display = 'none';
  document.getElementById('btn-generate').disabled = false;
};

window.setExample = function(val) {
  document.getElementById('custom-skill-input').value = val;
};

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ─── GENERATE ROADMAP ────────────────────────────────────
document.getElementById('btn-generate').addEventListener('click', async () => {
  const skillName = document.getElementById('custom-skill-input').value.trim();
  if (!skillName) {
    document.getElementById('modal-error').textContent = 'Please enter a skill name.';
    return;
  }

  // Show loading state
  document.getElementById('btn-generate').disabled = true;
  document.getElementById('modal-error').textContent = '';
  document.getElementById('gen-status').style.display = 'flex';
  document.getElementById('gen-status-text').textContent = 'Generating your roadmap...';

  const prompt = `
Create a complete learning roadmap for "${skillName}" for a beginner.

Respond ONLY with a valid JSON object in this exact format, no extra text, no markdown:
{
  "label": "${skillName}",
  "topics": [
    { "id": "unique-slug", "title": "Topic Title", "category": "Category Name", "hours": 3 },
    { "id": "unique-slug-2", "title": "Topic Title 2", "category": "Category Name", "hours": 4 }
  ]
}

Rules:
- Include 10-15 topics total
- Group topics into 3-5 logical categories
- Each topic id must be unique, lowercase, hyphenated (e.g. "intro-to-python")
- Hours should be realistic (1-8 per topic)
- Order topics from beginner to advanced
- Categories should reflect the natural learning phases
`.trim();

  try {
    document.getElementById('gen-status-text').textContent = 'AI is building your roadmap...';

    const res = await fetch('https://trackpath-api.atharvagore229.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    const clean = data.reply.replace(/```json|```/g, '').trim();
    const roadmap = JSON.parse(clean);

    // Save to Firestore under user's custom roadmaps
    document.getElementById('gen-status-text').textContent = 'Saving your roadmap...';

    const key = skillName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    customRoadmaps[key] = roadmap;

    await setDoc(doc(db, 'customRoadmaps', currentUser.uid), customRoadmaps);

    // Re-render dashboard with new skill
    renderSkillCards();
    closeModal();

  } catch (err) {
    console.error(err);
    document.getElementById('gen-status').style.display = 'none';
    document.getElementById('btn-generate').disabled = false;
    document.getElementById('modal-error').textContent =
      'Failed to generate roadmap. Try again.';
  }
});

// ─── HELPERS ─────────────────────────────────────────────
function getAllTopics() {
  const allRoadmaps = { ...roadmaps, ...customRoadmaps };
  return Object.values(allRoadmaps).flatMap(skill =>
    (skill.topics || []).map(t => ({ ...t, skillLabel: skill.label }))
  );
}

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

function getTimeAgo(ts) {
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}