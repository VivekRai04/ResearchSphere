<div align="center">
  <img src="https://img.icons8.com/ios-filled/100/0f172a/flask.png" alt="ResearchSphere Logo" width="100" />
  <h1 align="center">ResearchSphere</h1>
  <p align="center">
    <strong>A modern, AI-powered scholarly commons for the next generation of researchers.</strong>
  </p>
  <p align="center">
    <a href="#sparkles-features">Features</a> •
    <a href="#rocket-tech-stack">Tech Stack</a> •
    <a href="#gear-how-to-run-locally">How to Run Locally</a> •
    <a href="#cloud-hosting-for-free">Hosting</a>
  </p>
</div>

---

## 📖 What is ResearchSphere?

ResearchSphere is a premium, open-source platform designed to redefine how academics, students, and institutions store, share, and interact with research papers. It moves beyond clunky, outdated PDF repositories by automatically parsing documents, calculating reading times, extracting complex metadata, and fostering continuous peer collaboration through integrated discussion forums.

## ❓ Why did we build it?

Research discovery shouldn't feel like navigating an archive from the 1990s. We built ResearchSphere to solve three core problems in modern academia:
1. **Friction in sharing:** Beautifully formatted "citation cards" make sharing research on social media or with colleagues seamless and aesthetically stunning.
2. **Time sinks:** Automatically estimating reading times, extracting abstracts, and parsing complexity levels help researchers and students decide what's worth reading instantly.
3. **Academic Silos:** We are replacing static PDFs with dynamic discussion forums attached directly to every paper, fostering continuous peer review, Q&A, and collaborative scholarly discourse.

---

## ✨ Features

- 🎨 **State-of-the-Art Interface:** A gorgeous, minimalist UI built with React 19, Tailwind v4, and subtle Framer Motion micro-interactions that feel incredibly premium.
- 💬 **Dynamic Academic Discourse:** A built-in discussion forum beneath every paper enables continuous peer review, Q&A, and collaborative debate, bringing static research to life.
- ⏱️ **NLP Complexity & Time Estimation:** Upload a raw PDF and our engine automatically calculates precise reading times and complexity tiers (Beginner, Intermediate, Advanced) based on advanced text density and word-length heuristics.
- 🔍 **Semantic AI Discovery:** Under the hood, papers are processed into vector embeddings by our Python AI Service, enabling intelligent relationships and related-research recommendations.
- 📑 **Smart Metadata Extraction:** Automatically extracts references, DOIs, keywords, and abstracts directly from the raw PDF binary.
- 📸 **Share as Card:** Instantly generate and download highly aesthetic, pixel-perfect citation cards for sharing papers on Twitter, LinkedIn, or academic blogs.
- 🏛 **Institutional Organization:** Papers are meticulously categorized by department, research area, and paper type, creating a structured, highly navigable scholarly commons.
- 🔐 **Authentication & Personal Libraries:** Full user accounts, bookmarking, and save-for-later functionality for curating personal research collections.
- 🛡️ **Advanced Administration & Moderation:** Comprehensive administration dashboard with tools for staff management, paper moderation, and user suspension mechanisms to keep the repository high-quality and free of spam.

---

## 🚀 Tech Stack

This project is structured as a `pnpm` monorepo containing three main services:

### 🖥 Frontend (`artifacts/research-sphere`)
- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS v4
- **Routing:** Wouter
- **Animations:** Framer Motion
- **Icons:** Lucide React

### ⚙️ Backend (`artifacts/api-server`)
- **Framework:** Express (Node.js)
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **PDF Parsing:** `pdf-parse`

### 🤖 AI Service (`artifacts/ai-service`)
- **Language:** Python
- **Embedding Model:** SentenceTransformers (`all-mpnet-base-v2`)
- **Server:** Flask

---

## ⚙️ How to Run Locally

### Prerequisites
Before you begin, ensure you have the following installed:
- **Node.js** (v20 or higher)
- **pnpm** (`npm i -g pnpm`)
- **PostgreSQL** (Running locally)
- **Python 3.10+** (For the AI Service)

### 1. Database Setup
Ensure PostgreSQL is running locally. By default, the app expects a database named `researchsphere` on port `5433` (with user `postgres` and password `root`). 
*If your database uses standard port `5432` or different credentials, you can update the `DATABASE_URL` inside the `run.bat` file.*

### 2. Environment Variables
Create a `.env` file in `artifacts/api-server/` with the following variables:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:root@localhost:5433/researchsphere
PUBLIC_OBJECT_SEARCH_PATHS=../../attached_assets
```


### 3. Install Dependencies
First, install all Node dependencies across the workspaces:
```bash
pnpm install
```

Next, set up the Python virtual environment for the AI Service:
```bash
cd artifacts/ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd ../..
```

### 4. Start the Application
We have included a highly convenient Windows batch script that automatically clears ports and starts the Backend, Frontend, and AI Service simultaneously.

Just double-click the script, or run it from the terminal:
```bash
.\run.bat
```

Once started, the application will be available at:
👉 **http://localhost:3000** 

*(Note: The frontend is bound to `0.0.0.0`, meaning you can also access it from your phone or tablet on the same Wi-Fi network by typing your computer's local IP address, e.g., `http://192.168.x.x:3000`)*

---

## ☁️ Hosting for Free

Want to show this off to the world? The repository includes a `render.yaml` Blueprint which makes it a 1-click deploy to Render's free tier.

1. **Database:** Get a free, permanent PostgreSQL database from [Neon.tech](https://neon.tech/). Copy your connection string.
2. **Deploy:** Go to [Render.com](https://render.com/), create a new "Blueprint", and connect your GitHub repository.
3. **Configure:** Render will automatically detect the `render.yaml` file, set up the Node.js API, the Python AI Service, and the Vite React static site, and prompt you for the `DATABASE_URL` you got from Neon.
4. **Live:** Click Apply, and your app will be live on the internet for free!

*(Note: Render's free tier uses an ephemeral disk, meaning PDFs uploaded locally to the server will be wiped if the server sleeps. For permanent production use, you can integrate a free AWS S3 bucket or Supabase Storage.)*

---

<div align="center">
  <i>Built with passion for open science and elegant software.</i>
</div>
