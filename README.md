<div align="center">

```
████████╗██████╗  █████╗  ██████╗██╗  ██╗██████╗  █████╗ ████████╗██╗  ██╗
╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔══██╗██╔══██╗╚══██╔══╝██║  ██║
   ██║   ██████╔╝███████║██║     █████╔╝ ██████╔╝███████║   ██║   ███████║
   ██║   ██╔══██╗██╔══██║██║     ██╔═██╗ ██╔═══╝ ██╔══██║   ██║   ██╔══██║
   ██║   ██║  ██║██║  ██║╚██████╗██║  ██╗██║     ██║  ██║   ██║   ██║  ██║
   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝
```

**Your AI-powered personalized learning roadmap tracker**

[![Live Demo](https://img.shields.io/badge/Live_Demo-atharva--gore22.github.io-00d4ff?style=for-the-badge&logo=github)](https://atharva-gore22.github.io/trackpath/)
[![Built With](https://img.shields.io/badge/Built_With-Groq_%2B_Firebase-ffab00?style=for-the-badge)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-00e676?style=for-the-badge)](LICENSE)
[![First Year](https://img.shields.io/badge/By-First_Year_Undergrad-ff4d6d?style=for-the-badge)](https://github.com/atharva-gore22)

</div>

---

## What is TrackPath?

TrackPath is a full-stack AI-powered learning platform where users pick a skill, follow a structured roadmap, track their progress, and get **context-aware AI recommendations** based on exactly what they've completed — not generic advice.

Built entirely from scratch in the first year of a B.Tech IT program. Zero frameworks. Zero paid services. Total cost: **Rs. 0**.

> *"It knows I finished Flexbox and CSS Basics, so it recommended Grid and Responsive Design next — not just a random topic."*

---

## Features

### Core
- **Structured roadmaps** for Web Development, DSA with JavaScript, and Python Basics
- **Topic tracking** with localStorage-style persistence — but cloud-synced per user
- **Progress bar** with animated cyan-to-green gradient fill
- **Streak tracking** — consecutive days with at least one topic completed

### AI-Powered
- **Context-aware recommendations** — AI reads your exact progress before suggesting next steps
- **Topic explanations** — plain English, 4–5 sentences, with real-world examples
- **Jumbled AI quiz** — fresh questions every time using random seed + angle variation
- **New Quiz button** — regenerate instantly without leaving the page
- **AI custom roadmap generator** — type any skill, get a full structured roadmap in seconds

### User System
- **Email + Google login** via Firebase Auth
- **Personal dashboard** — XP points, streak, hours invested, skill progress rings
- **Per-user cloud sync** — progress saved to Firestore, accessible from any device
- **Recent activity feed** — last 6 topics completed with time-ago timestamps
- **Custom skills** — AI-generated roadmaps saved permanently to your account

---

## Tech Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Frontend | HTML + CSS + JS | UI, animations, routing |
| AI Model | Groq + Llama 3.3 70B | Recommendations, explanations, quizzes, roadmap generation |
| Backend | Cloudflare Workers | Secure API proxy — hides Groq key from browser |
| Database | Firebase Firestore | Per-user progress, custom roadmaps, streaks |
| Auth | Firebase Auth | Email/password + Google login |
| Hosting | GitHub Pages | Free global hosting |

---

## Architecture

```
User Opens Site
      │
      ▼
index.html (Login Page)
      │ Firebase Auth
      ▼
dashboard.html ──── Firestore ──── progress/{uid}
      │                    └────── customRoadmaps/{uid}
      │ Click skill
      ▼
app.html
      │
      ├── roadmaps.json ──── Default skill data
      │
      └── app.js
            │ POST { prompt }
            ▼
      Cloudflare Worker
            │ Bearer ${env.GROQ_API_KEY}
            ▼
         Groq API
            │ { reply }
            ▼
      AI Panel Output
```

**Key principle:** The Groq API key lives *only* in Cloudflare's environment secrets. It never touches the browser or GitHub — ever.

---

## Project Structure

```
trackpath/
├── index.html        # Login page — email + Google auth
├── app.html          # Main roadmap app — 2-panel layout
├── dashboard.html    # Personal dashboard — stats, skill rings, activity
├── style.css         # Dark navy theme, CSS animations, responsive
├── firebase.js       # Firebase config + exports auth and db
├── auth.js           # Login/signup logic, redirects, error handling
├── app.js            # Roadmap render, Firestore sync, all AI calls
├── dashboard.js      # Dashboard stats, custom roadmap generator
└── roadmaps.json     # Default skills data (webdev, dsa, python)
```

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/atharva-gore22/trackpath.git
cd trackpath
```

### 2. Set up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a project → Enable **Authentication** (Email + Google) → Enable **Firestore**
3. Register a web app → copy the `firebaseConfig` object
4. Replace the config in `firebase.js` with your own

### 3. Set up Cloudflare Worker

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create Worker
2. Paste the proxy code from `worker.js` (see below)
3. Add your Groq API key as a secret: `GROQ_API_KEY`
4. Copy your Worker URL and replace `YOUR_WORKER_URL` in `app.js` (3 places) and `dashboard.js`

### 4. Worker code

```js
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    const { prompt } = await request.json();

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || 'No response.';

    return new Response(JSON.stringify({ reply }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
};
```

### 5. Run locally

Open `index.html` with **Live Server** in VS Code. No build step, no npm, no config.

### 6. Deploy

```bash
git add .
git commit -m "initial commit"
git push -u origin main
```

Then: GitHub repo → **Settings** → **Pages** → Source: `main` → Save.

Live in ~60 seconds.

---

## How the AI Works

Every AI call sends structured context — not just a topic name. Here's the recommendation prompt:

```
You are a learning advisor. The user is studying "Web Development".
Completed topics: HTML Basics, CSS Basics, Flexbox.
Remaining topics: CSS Grid, Responsive Design, JS DOM...

Recommend the best 2 topics to tackle next.
For each topic, write 2 sentences: why it's the right next step,
and one tip to learn it effectively.
```

The AI response is specific to *this user's exact progress* — that's what makes it a recommendation system, not just a chatbot.

For the custom roadmap generator:

```
Create a complete learning roadmap for "Machine Learning" for a beginner.
Respond ONLY with valid JSON: { "label": "...", "topics": [...] }
Rules: 10-15 topics, 3-5 categories, unique slugified IDs, realistic hours...
```

---

## Screenshots

> Dashboard — skill progress rings, XP, streak, recent activity

> Roadmap — topic cards with checkboxes, progress bar, AI panel

> Custom skill modal — type any skill, AI generates the full roadmap

---

## What I Learned Building This

| Concept | Applied in |
|---------|-----------|
| Firebase Auth flow | `auth.js` — `onAuthStateChanged` pattern on every page |
| Firestore read/write | `app.js` — `setDoc`, `getDoc` for per-user progress |
| Cloudflare Worker | Secure API proxy, CORS headers, environment secrets |
| Prompt engineering | Context-aware prompts with user progress as structured input |
| AI JSON generation | Custom roadmap generator — strict JSON schema in prompt |
| SVG animations | Skill progress rings using `stroke-dashoffset` |
| `Promise.all()` | Parallel Firestore fetches for faster dashboard loading |
| `URLSearchParams` | Passing skill selection from dashboard → app page |
| Streak algorithm | Computing consecutive days from Firestore timestamps |
| CSS custom properties | Full dark theme, rethemeable in 8 variable changes |

---

## Roadmap (What's Coming)

- [ ] XP badges and milestone rewards
- [ ] Completion celebration (confetti on 100%)
- [ ] Leaderboard across users
- [ ] Notes per topic saved to Firestore
- [ ] Spaced repetition — resurface topics after N days
- [ ] AI chatbot panel with persistent conversation history
- [ ] Mobile app via Capacitor.js

---

**If this helped you, drop a ⭐ — it means a lot for a first-year dev.**

</div>
