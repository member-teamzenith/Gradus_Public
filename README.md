# Gradus

**Gradus** is an adaptive, AI-powered learning platform that dynamically builds personalized educational pathways. It transforms open video content into structured, interactive learning experiences, eliminating the rigidity of traditional courses.

---

## 📖 Table of Contents
- [About Gradus](#about-gradus)
  - [The Problem](#the-problem)
  - [The Solution](#the-solution)
- [Key Features](#key-features)
- [The Learning Flow](#the-learning-flow)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Getting Started](#getting-started)
- [Contributing](#contributing)

---

## 🧠 About Gradus

### The Problem
* **Structured Learning Is Rigid:** Courses are designed as fixed pathways delivered identically to thousands of learners — locking users into predefined sequences that ignore prior knowledge, style, pace, and goals.
* **Learning Is Personal — Platforms Are Generic:** Every learner progresses differently, yet today’s platforms deliver the same content, explanations, and difficulty to everyone, regardless of understanding or learning style.
* **Open Video Is Abundant — But Directionless:** The best educational content exists openly and updates rapidly, but video platforms optimize for watching, not mastery — leaving learners without guidance, reinforcement, or measurable progress.
* **Teaching at Scale Is Operationally Broken:** Creators must manually build courses, notes, quizzes, and communities across multiple tools, making personalized teaching impossible to scale.

### The Solution
* **Adaptive structure without course lock-in:** Gradus delivers structured learning without fixed courses — dynamically assembling personalized pathways across creators, topics, and difficulty levels based on each learner’s evolving understanding.
* **Personalization by Design:** Summaries, quizzes, explanations, and learning flows automatically adapt to a learner’s pace, ability, and preferences — continuously reshaping the experience as they progress.
* **Open Video, Transformed Into Learning:** Gradus turns open educational videos into guided learning experiences with structured flow, practice, and measurable progress — combining the speed of open content with the rigor of adaptive education.
* **Teaching That Scales Automatically:** Creators upload videos once. Gradus generates structured learning artifacts, assessments, and engagement layers automatically — enabling personalized teaching at scale without course-building overhead.

---

## ✨ Key Features

* **Adaptive Learning Paths:** Gradus dynamically builds and reshapes learning pathways based on what a learner knows, struggles with, and prefers — skipping redundancies and reinforcing weak areas. *(Outcome: Structure that evolves with the learner.)*
* **Personalized Learning Artifacts:** Notes, summaries, quizzes, and explanations are generated in the learner’s tone, depth, and level — and continuously adapt as performance changes. *(Outcome: One platform, uniquely tailored to every learner.)*
* **Interactive Video Intelligence:** Every video becomes an active learning unit — with contextual AI assistance, guided next steps, and real-time practice embedded inside the viewing experience. *(Outcome: Open video, redesigned for mastery.)*

---

## 🔄 The Learning Flow Experience

1. **Discover:** Learner selects a goal or explores a topic. Gradus understands intent and starting baseline.
2. **Structure:** Orion assembles a personalized pathway across creators and difficulty levels. No fixed course. No lock-in.
3. **Engage:** User learns through interactive video with AI-generated notes, quizzes, and contextual guidance. Learning becomes active.
4. **Capture (Knowledge Vault):** Important knowledge automatically saved into Learning Vault (notes, highlights, blueprints, resources).
5. **Measure:** Every quiz, interaction, and behavior updates the learner model (ability, preferences, weak zones). Understanding becomes quantifiable.
6. **Adapt (Orion Intelligence):** Pathways, explanations, and difficulty adjust dynamically based on performance. Learning reshapes itself in real time.
7. **Reinforce & Recall:** Weak areas are revisited automatically. Strong areas accelerate. (Revision Engine + Insights)

---

## 🏗️ Architecture & Tech Stack

This repository contains the foundational web application layer and structural scaffolding that powers the Gradus experience, split into three main components:

### 1. `Frontend/` (Next.js / React)
The user-facing web interface handling responsive layouts, video playback, blueprint views, notebook/highlight capture, and interactive dashboards.
* **Tech:** Next.js 14, React, Tailwind CSS

### 2. `Backend/` (Node.js / Express)
The core operational logic handling API requests, user profiles, content metadata mapping, and playlist/video metadata synchronization. 
* **Tech:** Node.js, Express, Firebase (Auth/Firestore), Redis (Caching)

### 3. `Python backend/` (FastAPI / Qdrant)
The intelligence layer (*OrionServer*) that manages interactions with the vector database, orchestrating content generation, chunking algorithms, AI-assisted video analysis, and embedding pipelines.
* **Tech:** Python 3.11+, FastAPI, Qdrant (Vector Database)

---

## 🚀 Getting Started

Follow these steps to run the complete Gradus platform locally:

### Prerequisites
* **Node.js** (v18 or higher)
* **Python** (v3.11 or higher)
* **Redis server** running locally or via Docker
* **Firebase Project** configured with Firestore and Authentication
* **Qdrant Vector Database** (Local instance or Cloud cluster)

### Setup Instructions

#### 1. Frontend Setup
```bash
cd Frontend
npm install
npm run dev
```
*The application will boot at `http://localhost:3000`.*

#### 2. Node Backend Setup
Ensure your `firebase.js` is correctly pointing to your project credentials.
```bash
cd Backend
npm install
npm run dev
```

#### 3. Python Backend Setup
It is recommended to set up a virtual environment.
```bash
cd "Python backend/OrionServer"
python -m venv venv

# On Windows:
venv\Scripts\activate
# On Mac/Linux:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
```

---

## 🤝 Contributing

This repository is primarily a reference architecture. If you'd like to extend its functionality, please ensure:
* New **frontend components** adhere to the existing atomic design structure in `src/Components/`.
* New **Python modules** are integrated via the central FastAPI router.
