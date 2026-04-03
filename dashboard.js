import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let roadmaps = {};
let progress = {};
let currentUser = null;

// ─── AUTH GATE ───────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;

  // Load roadmaps and progress in parallel
  const [roadmapRes, progressSnap] = await Promise.all([
    fetch('roadmaps.json').then(r => r.json()),
    getDoc(doc(db, 'progress', user.uid))
  ]);

  roadmaps = roadmapRes;
  progress = progressSnap.exists() ? progressSnap.data() : {};

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

  // Avatar initials
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('dash-avatar').textContent = initials;

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dash-greeting').textContent = `${greeting}, ${name.split(' ')[0]}!`;

  // Compute stats
  const allTopics   = getAllTopics();
  const doneTopics  = allTopics.filter(t => progress[t.id]);
  const totalHours  = doneTopics.reduce((sum, t) => sum + t.hours, 0);
  const xp          = doneTopics.length * 10;
  const streak      = calcStreak();

  // Sub message
  const sub =
    doneTopics.length === 0 ? 'Pick a skill and start your journey.' :
    doneTopics.length < 5   ? 'Great start! Keep building momentum.' :
    doneTopics.length < 15  ? 'You\'re on a roll. Keep it up!' :
                               'Impressive progress. You\'re crushing it!';
  document.getElementById('dash-sub').textContent = sub;

  // Fill stat cards
  document.getElementById('dash-xp').textContent            = xp;
  document.getElementById('stat-total-done').textContent    = doneTopics.length;
  document.getElementById('stat-streak').textContent        = streak;
  document.getElementById('stat-hours').textContent         = totalHours + 'h';
  document.getElementById('stat-xp').textContent            = xp;
  document.getElementById('nav-streak').textContent         = streak;
  document.getElementById('user-name').textContent          = name;

  // Streak chip glow
  if (streak > 0) {
    document.getElementById('chip-streak').classList.add('streak-active');
  }

  // Render skill cards and activity
  renderSkillCards();
  renderActivity(doneTopics);
}

// ─── SKILL CARDS ─────────────────────────────────────────
function renderSkillCards() {
  const container = document.getElementById('skill-cards');

  const skillKeys = Object.keys(roadmaps);
  container.innerHTML = skillKeys.map(key => {
    const skill   = roadmaps[key];
    const topics  = skill.topics;
    const done    = topics.filter(t => progress[t.id]).length;
    const total   = topics.length;
    const pct     = total === 0 ? 0 : Math.round((done / total) * 100);
    const xp      = done * 10;

    // Pick an accent color per skill
    const colors  = {
      webdev: { color: '#00d4ff', dim: '#003d52' },
      dsa:    { color: '#00e676', dim: '#003320' },
      python: { color: '#ffab00', dim: '#3d2800' }
    };
    const c = colors[key] || { color: '#00d4ff', dim: '#003d52' };

    return `
      <a href="app.html?skill=${key}" class="skill-card" style="--skill-color:${c.color};--skill-dim:${c.dim}">
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
              font-size="14"
              font-weight="700"
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

  // Sort by timestamp descending, take last 6
  const sorted = [...doneTopics]
    .sort((a, b) => (progress[b.id] || 0) - (progress[a.id] || 0))
    .slice(0, 6);

  container.innerHTML = sorted.map(topic => {
    const ts      = progress[topic.id];
    const timeAgo = getTimeAgo(ts);
    return `
      <div class="activity-item">
        <div class="activity-check">✓</div>
        <div class="activity-info">
          <span class="activity-title">${topic.title}</span>
          <span class="activity-time">${timeAgo}</span>
        </div>
        <span class="activity-xp">+10 XP</span>
      </div>
    `;
  }).join('');
}

// ─── HELPERS ─────────────────────────────────────────────
function getAllTopics() {
  return Object.values(roadmaps).flatMap(skill =>
    skill.topics.map(t => ({ ...t, skillLabel: skill.label }))
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
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}