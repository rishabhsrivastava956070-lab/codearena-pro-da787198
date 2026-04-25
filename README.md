
# 🚀 CodeArena Pro

A full-stack coding platform similar to LeetCode with advanced features like real-time code execution, AI-powered code analysis, contests, and admin-driven problem management.

🔗 Live Demo: https://codearena-pro.lovable.app

---

## 🧠 Features

### 👨‍💻 Core Features
- User Authentication (Login / Register)
- Problem Listing & Filtering
- Code Editor (Monaco Editor)
- Multi-language Code Execution (Judge0 API)
- Submission System with verdicts

---

### ⚡ Advanced Features
- 🔄 Async Judge Queue (Postgres + pg_cron)
- 💾 Code Autosave + Versioning
- 🧪 Custom Test Case Execution
- 🤖 AI Code Analysis (Explain + Complexity + Suggestions)
- 📊 User Dashboard (Progress, XP, streaks)

---

### 🏆 Contest System
- Create & manage contests
- Real-time leaderboard
- Auto start/end contests

---

### 🛠 Admin Features
- Admin dashboard
- Problem CRUD
- Approval system (pending / approved / rejected)

---

### 🔐 Security & Performance
- Role-based access control (RBAC)
- Rate limiting & retry logic
- Secure API handling

---

## 🧰 Tech Stack

### Frontend
- React.js (Vite)
- Tailwind CSS
- ShadCN UI

### Backend (Lovable Cloud)
- PostgreSQL
- Edge Functions
- Supabase Realtime

### APIs & Tools
- Judge0 API (code execution)
- Gemini AI (code analysis)

---

## ⚙️ How It Works

1. User writes code in editor
2. Submission goes to async job queue
3. Worker sends code to Judge0
4. Results are stored and shown in UI
5. AI analyzes code and gives suggestions




npm run dev
