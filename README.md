# 🎓 MG University IMCA Results & Ranks Portal (Batch 2022–2027)

A fast, modern web application for consolidated semester-wise SGPA, overall CGPA, college ranks, and university ranks for **Mahatma Gandhi University Integrated MCA (IMCA) Batch 2022–2027**.

---

## 🌟 Features

- **Instant Register Number Lookup**: Enter 12-digit PRN (e.g., `223242110032`) or search by name.
- **Complete Academic Metrics**:
  - Semester-wise SGPA (Semesters 1 to 8)
  - Cumulative Grade Point Average (CGPA on a 10.0 scale)
  - University Rank (across all students in both institutions)
  - College Rank (De Paul Institute / SCMS School of Technology)
  - Total marks, credit points, and cleared status
- **Interactive SGPA Progression Curve**: Visual performance trend chart across all semesters.
- **S9 & S10 Dynamic Computation & Simulator**:
  - Ready to dynamically ingest Semester 9 & 10 results the moment they are published.
  - Interactive CGPA projector allowing students to calculate projected graduation CGPA.
- **Leaderboard & Analytics**:
  - University Top 10 rankers
  - College Top 10 rankers (De Paul & SCMS)
  - Comparative batch analytics & pass percentage statistics
- **Print & PDF Support**: Clean printable student marksheet format.

---

## 🚀 Deployment Options

### 1. Vercel (Instant)
```bash
npx vercel
```

### 2. Netlify
- **CLI**: `npx netlify deploy --prod`
- **Drag & Drop**: Upload this directory directly to [Netlify Drop](https://app.netlify.com/drop).

### 3. GitHub Pages
1. Push this repository to GitHub.
2. In the repository settings, go to **Pages** -> **Source**: Deploy from branch `main` / `root`.

---

## 💻 Local Development

Run the zero-dependency local preview server:
```bash
npm start
# or
node server.js
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
