
import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:8000"

# ==================================================================================
# 1. Video Taxonomy (30 Videos)
# ==================================================================================
# Dimensions to vary:
# - Subject: CS, Math, Physics, Biology
# - Level: Foundational, Intermediate, Advanced, Expert
# - Practical Utility: Skill Building, Academic Theory, General Interest, Industry Application
# - Strategy: Live Coding, Visual Explanation, Lecture, Scaffolded Tutorial, Problem-Based
# - Cognitive Load: Low, Medium, High
# - Content Density: Verbose, Balanced, Dense

VIDEOS = [
    # --- COMPUTER SCIENCE (8) ---
    {
        "id": "cs_algo_01",
        "Identity": {"Video Title": "Sorting Algorithms Explained", "Subject Category": "Computer Science", "Domain Taxonomy": ["Algorithms", "Sorting"], "Primary Concept": "Merge Sort"},
        "Context": {"Educational Level": "Advanced", "Target Persona": ["Student"], "Practical Utility": "Skill Building", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Arrays"], "Taught Concepts": ["Divide and Conquer"], "Acquired Competencies": ["Implementing Merge Sort"]},
        "Pedagogy": {"Instructional Strategy": "Live Coding", "Cognitive Load": "Medium", "Content Density": "Balanced", "Tone": "Formal"},
        "Recommendations": {"Similar Topic Video Searches": [], "Prerequisite Video Searches": [], "Next Topic Video Searches": []}
    },
    {
        "id": "cs_algo_02",
        "Identity": {"Video Title": "Graph Traversal: BFS & DFS", "Subject Category": "Computer Science", "Domain Taxonomy": ["Algorithms", "Graph Theory"], "Primary Concept": "Breadth-First Search"},
        "Context": {"Educational Level": "Advanced", "Target Persona": ["Student"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Graph Basics"], "Taught Concepts": ["Queue", "Stack"], "Acquired Competencies": ["Traversing Graphs"]},
        "Pedagogy": {"Instructional Strategy": "Visual Explanation", "Cognitive Load": "Medium", "Content Density": "Balanced", "Tone": "Formal"},
        "Recommendations": {}
    },
    {
        "id": "cs_algo_03",
        "Identity": {"Video Title": "Dynamic Programming Basics", "Subject Category": "Computer Science", "Domain Taxonomy": ["Algorithms", "Optimization"], "Primary Concept": "Memoization"},
        "Context": {"Educational Level": "Advanced", "Target Persona": ["Student"], "Practical Utility": "Skill Building", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Recursion"], "Taught Concepts": ["Overlapping Subproblems"], "Acquired Competencies": ["Optimizing Recursion"]},
        "Pedagogy": {"Instructional Strategy": "Scaffolded Tutorial", "Cognitive Load": "High", "Content Density": "Dense", "Tone": "Formal"},
        "Recommendations": {}
    },
    {
        "id": "cs_ml_01",
        "Identity": {"Video Title": "Intro to Neural Networks", "Subject Category": "Computer Science", "Domain Taxonomy": ["Machine Learning", "Deep Learning"], "Primary Concept": "Perceptron"},
        "Context": {"Educational Level": "Intermediate", "Target Persona": ["General Audience"], "Practical Utility": "General Interest", "Knowledge Validity": "Evolving/Modern"},
        "Competency": {"Prerequisites": ["Basic Algebra"], "Taught Concepts": ["Neurons", "Weights"], "Acquired Competencies": ["Understanding AI Basis"]},
        "Pedagogy": {"Instructional Strategy": "Visual Explanation", "Cognitive Load": "Low", "Content Density": "Verbose", "Tone": "Casual"},
        "Recommendations": {}
    },
    {
        "id": "cs_ml_02",
        "Identity": {"Video Title": "Backpropagation Deep Dive", "Subject Category": "Computer Science", "Domain Taxonomy": ["Machine Learning", "Deep Learning"], "Primary Concept": "Gradient Descent"},
        "Context": {"Educational Level": "Expert", "Target Persona": ["Data Scientist"], "Practical Utility": "Industry Application", "Knowledge Validity": "Evolving/Modern"},
        "Competency": {"Prerequisites": ["Calculus", "Linear Algebra"], "Taught Concepts": ["Chain Rule", "Loss Function"], "Acquired Competencies": ["Training Networks"]},
        "Pedagogy": {"Instructional Strategy": "Lecture", "Cognitive Load": "High", "Content Density": "Dense", "Tone": "Formal"},
        "Recommendations": {}
    },
    {
        "id": "cs_db_01",
        "Identity": {"Video Title": "SQL Joins Masterclass", "Subject Category": "Computer Science", "Domain Taxonomy": ["Databases", "Relational"], "Primary Concept": "Inner vs Outer Joins"},
        "Context": {"Educational Level": "Foundational", "Target Persona": ["Beginner Dev"], "Practical Utility": "Industry Application", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Basic SQL"], "Taught Concepts": ["Venn Diagrams", "Foreign Keys"], "Acquired Competencies": ["Writing Joins"]},
        "Pedagogy": {"Instructional Strategy": "Live Coding", "Cognitive Load": "Medium", "Content Density": "Balanced", "Tone": "Casual"},
        "Recommendations": {}
    },
    {
        "id": "cs_dist_01",
        "Identity": {"Video Title": "Distributed Consensus", "Subject Category": "Computer Science", "Domain Taxonomy": ["Distributed Systems", "Consensus"], "Primary Concept": "Paxos vs Raft"},
        "Context": {"Educational Level": "Expert", "Target Persona": ["Systems Engineer"], "Practical Utility": "Industry Application", "Knowledge Validity": "Evolving/Modern"},
        "Competency": {"Prerequisites": ["Networking"], "Taught Concepts": ["Leader Election"], "Acquired Competencies": ["Designing Fault Tolerance"]},
        "Pedagogy": {"Instructional Strategy": "Problem-Based", "Cognitive Load": "High", "Content Density": "Dense", "Tone": "Technical"},
        "Recommendations": {}
    },
    {
        "id": "cs_hard_01",
        "Identity": {"Video Title": "How CPUs Work", "Subject Category": "Computer Science", "Domain Taxonomy": ["Computer Architecture", "Hardware"], "Primary Concept": "Fetch-Decode-Execute"},
        "Context": {"Educational Level": "Foundational", "Target Persona": ["Hobbyist"], "Practical Utility": "General Interest", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["None"], "Taught Concepts": ["Logic Gates"], "Acquired Competencies": ["Understanding Binary"]},
        "Pedagogy": {"Instructional Strategy": "Visual Explanation", "Cognitive Load": "High", "Content Density": "Balanced", "Tone": "Accessible"},
        "Recommendations": {}
    },

    # --- MATHEMATICS (6) ---
    {
        "id": "math_calc_01",
        "Identity": {"Video Title": "Limits and Continuity", "Subject Category": "Mathematics", "Domain Taxonomy": ["Calculus", "Single Variable"], "Primary Concept": "Epsilon-Delta Definition"},
        "Context": {"Educational Level": "Advanced", "Target Persona": ["Undergraduate"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Algebra"], "Taught Concepts": ["Approximation"], "Acquired Competencies": ["Evaluating Limits"]},
        "Pedagogy": {"Instructional Strategy": "Lecture", "Cognitive Load": "Medium", "Content Density": "Balanced", "Tone": "Formal"},
        "Recommendations": {}
    },
    {
        "id": "math_calc_02",
        "Identity": {"Video Title": "Integration Techniques", "Subject Category": "Mathematics", "Domain Taxonomy": ["Calculus", "Single Variable"], "Primary Concept": "Integration by Parts"},
        "Context": {"Educational Level": "Advanced", "Target Persona": ["Undergraduate"], "Practical Utility": "Skill Building", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Derivatives"], "Taught Concepts": ["Reverse Chain Rule"], "Acquired Competencies": ["Solving Integrals"]},
        "Pedagogy": {"Instructional Strategy": "Scaffolded Tutorial", "Cognitive Load": "High", "Content Density": "Dense", "Tone": "Formal"},
        "Recommendations": {}
    },
    {
        "id": "math_la_01",
        "Identity": {"Video Title": "Vectors and Spaces", "Subject Category": "Mathematics", "Domain Taxonomy": ["Linear Algebra", "Vector Spaces"], "Primary Concept": "Linear Independence"},
        "Context": {"Educational Level": "Advanced", "Target Persona": ["Undergraduate"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Geometry"], "Taught Concepts": ["Span", "Basis"], "Acquired Competencies": ["Defining Spaces"]},
        "Pedagogy": {"Instructional Strategy": "Visual Explanation", "Cognitive Load": "Medium", "Content Density": "Balanced", "Tone": "Inspirational"},
        "Recommendations": {}
    },
    {
        "id": "math_la_02",
        "Identity": {"Video Title": "Eigenvalues & Eigenvectors", "Subject Category": "Mathematics", "Domain Taxonomy": ["Linear Algebra", "Matrix Theory"], "Primary Concept": "Diagonalization"},
        "Context": {"Educational Level": "Advanced", "Target Persona": ["Undergraduate"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Determinants"], "Taught Concepts": ["Transformations"], "Acquired Competencies": ["Finding Eigenvalues"]},
        "Pedagogy": {"Instructional Strategy": "Lecture", "Cognitive Load": "High", "Content Density": "Dense", "Tone": "Formal"},
        "Recommendations": {}
    },
    {
        "id": "math_stats_01",
        "Identity": {"Video Title": "Probability Distributions", "Subject Category": "Mathematics", "Domain Taxonomy": ["Statistics", "Probability"], "Primary Concept": "Normal Distribution"},
        "Context": {"Educational Level": "Foundational", "Target Persona": ["Analyst"], "Practical Utility": "Industry Application", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Basic Math"], "Taught Concepts": ["Bell Curve"], "Acquired Competencies": ["Reading Charts"]},
        "Pedagogy": {"Instructional Strategy": "Visual Explanation", "Cognitive Load": "Low", "Content Density": "Verbose", "Tone": "Casual"},
        "Recommendations": {}
    },
    {
        "id": "math_diff_01",
        "Identity": {"Video Title": "Intro to Differential Equations", "Subject Category": "Mathematics", "Domain Taxonomy": ["Calculus", "Differential Equations"], "Primary Concept": "Separable Variables"},
        "Context": {"Educational Level": "Intermediate", "Target Persona": ["Undergraduate"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Calculus I"], "Taught Concepts": ["Rate of Change"], "Acquired Competencies": ["Solving ODEs"]},
        "Pedagogy": {"Instructional Strategy": "Problem-Based", "Cognitive Load": "Medium", "Content Density": "Dense", "Tone": "Formal"},
        "Recommendations": {}
    },

    # --- PHYSICS (6) ---
    {
        "id": "phys_mech_01",
        "Identity": {"Video Title": "Newton's Laws of Motion", "Subject Category": "Physics", "Domain Taxonomy": ["Mechanics", "Classical"], "Primary Concept": "Force and Acceleration"},
        "Context": {"Educational Level": "Foundational", "Target Persona": ["High School Student"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["None"], "Taught Concepts": ["Inertia", "Action-Reaction"], "Acquired Competencies": ["Applying F=ma"]},
        "Pedagogy": {"Instructional Strategy": "Visual Explanation", "Cognitive Load": "Low", "Content Density": "Verbose", "Tone": "Casual"},
        "Recommendations": {}
    },
    {
        "id": "phys_mech_02",
        "Identity": {"Video Title": "Rotational Dynamics", "Subject Category": "Physics", "Domain Taxonomy": ["Mechanics", "Rotational"], "Primary Concept": "Moment of Inertia"},
        "Context": {"Educational Level": "Advanced", "Target Persona": ["Undergraduate"], "Practical Utility": "Skill Building", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Linear Dynamics"], "Taught Concepts": ["Torque", "Angular Momentum"], "Acquired Competencies": ["Solving Rotational Problems"]},
        "Pedagogy": {"Instructional Strategy": "Problem-Based", "Cognitive Load": "High", "Content Density": "Dense", "Tone": "Formal"},
        "Recommendations": {}
    },
    {
        "id": "phys_em_01",
        "Identity": {"Video Title": "Electrostatics Fundamentals", "Subject Category": "Physics", "Domain Taxonomy": ["Electromagnetism", "Electrostatics"], "Primary Concept": "Coulomb's Law"},
        "Context": {"Educational Level": "Foundational", "Target Persona": ["High School Student"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Algebra"], "Taught Concepts": ["Charge", "Field"], "Acquired Competencies": ["Calculating Force"]},
        "Pedagogy": {"Instructional Strategy": "Scaffolded Tutorial", "Cognitive Load": "Medium", "Content Density": "Balanced", "Tone": "Formal"},
        "Recommendations": {}
    },
    {
        "id": "phys_em_02",
        "Identity": {"Video Title": "Electromagnetic Induction", "Subject Category": "Physics", "Domain Taxonomy": ["Electromagnetism", "Magnetism"], "Primary Concept": "Faraday's Law"},
        "Context": {"Educational Level": "Advanced", "Target Persona": ["Undergraduate"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Calculus"], "Taught Concepts": ["Flux", "Lenz Law"], "Acquired Competencies": ["Calculating EMF"]},
        "Pedagogy": {"Instructional Strategy": "Lecture", "Cognitive Load": "High", "Content Density": "Dense", "Tone": "Formal"},
        "Recommendations": {}
    },
    {
        "id": "phys_qm_01",
        "Identity": {"Video Title": "Quantum Mechanics Intro", "Subject Category": "Physics", "Domain Taxonomy": ["Quantum Mechanics", "Foundations"], "Primary Concept": "Wave-Particle Duality"},
        "Context": {"Educational Level": "Expert", "Target Persona": ["Researcher"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Theoretical/Debated"},
        "Competency": {"Prerequisites": ["Linear Algebra", "Physics III"], "Taught Concepts": ["Superposition", "Schrodinger"], "Acquired Competencies": ["Conceptualizing Quantum States"]},
        "Pedagogy": {"Instructional Strategy": "Discussion", "Cognitive Load": "High", "Content Density": "Dense", "Tone": "Inspirational"},
        "Recommendations": {}
    },
    {
        "id": "phys_rel_01",
        "Identity": {"Video Title": "General Relativity Explained", "Subject Category": "Physics", "Domain Taxonomy": ["Relativity", "General"], "Primary Concept": "Spacetime Curvature"},
        "Context": {"Educational Level": "Expert", "Target Persona": ["Physics Student"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Tensors"], "Taught Concepts": ["Gravity"], "Acquired Competencies": ["Understanding Geodesics"]},
        "Pedagogy": {"Instructional Strategy": "Discussion", "Cognitive Load": "High", "Content Density": "Dense", "Tone": "Awe-Inspiring"},
        "Recommendations": {}
    },

    # --- BIOLOGY (6) ---
    {
        "id": "bio_cell_01",
        "Identity": {"Video Title": "Cell Structure & Function", "Subject Category": "Biology", "Domain Taxonomy": ["Cell Biology", "Eukaryotic"], "Primary Concept": "Mitochondria"},
        "Context": {"Educational Level": "Foundational", "Target Persona": ["Student"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["None"], "Taught Concepts": ["Organelles"], "Acquired Competencies": ["Labeling Cell Diagrams"]},
        "Pedagogy": {"Instructional Strategy": "Visual Explanation", "Cognitive Load": "Low", "Content Density": "Verbose", "Tone": "Casual"},
        "Recommendations": {}
    },
    {
        "id": "bio_cell_02",
        "Identity": {"Video Title": "DNA Replication", "Subject Category": "Biology", "Domain Taxonomy": ["Molecular Biology", "Genetics"], "Primary Concept": "Helicase"},
        "Context": {"Educational Level": "Advanced", "Target Persona": ["Undergraduate"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Biochemistry"], "Taught Concepts": ["Leading Strand", "Lagging Strand"], "Acquired Competencies": ["Detailing Replication Steps"]},
        "Pedagogy": {"Instructional Strategy": "Scaffolded Tutorial", "Cognitive Load": "High", "Content Density": "Dense", "Tone": "Formal"},
        "Recommendations": {}
    },
    {
        "id": "bio_eco_01",
        "Identity": {"Video Title": "Ecosystem Dynamics", "Subject Category": "Biology", "Domain Taxonomy": ["Ecology", "Population"], "Primary Concept": "Food Webs"},
        "Context": {"Educational Level": "Intermediate", "Target Persona": ["General Audience"], "Practical Utility": "General Interest", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["None"], "Taught Concepts": ["Trophic Levels"], "Acquired Competencies": ["Identifying Energy Flow"]},
        "Pedagogy": {"Instructional Strategy": "Visual Explanation", "Cognitive Load": "Low", "Content Density": "Balanced", "Tone": "Inspirational"},
        "Recommendations": {}
    },
    {
        "id": "bio_evo_01",
        "Identity": {"Video Title": "Natural Selection", "Subject Category": "Biology", "Domain Taxonomy": ["Evolutionary Biology", "Mechanisms"], "Primary Concept": "Fitness"},
        "Context": {"Educational Level": "Advanced", "Target Persona": ["Student"], "Practical Utility": "Academic Theory", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Genetics"], "Taught Concepts": ["Adaptation"], "Acquired Competencies": ["Analyzing evolutionary pressures"]},
        "Pedagogy": {"Instructional Strategy": "Discussion", "Cognitive Load": "Medium", "Content Density": "Balanced", "Tone": "Formal"},
        "Recommendations": {}
    },
    {
        "id": "bio_gen_01",
        "Identity": {"Video Title": "CRISPR-Cas9 Revolution", "Subject Category": "Biology", "Domain Taxonomy": ["Genetics", "Biotechnology"], "Primary Concept": "Gene Editing"},
        "Context": {"Educational Level": "Expert", "Target Persona": ["Researcher"], "Practical Utility": "Industry Application", "Knowledge Validity": "Evolving/Modern"},
        "Competency": {"Prerequisites": ["Molecular Biology"], "Taught Concepts": ["Guide RNA"], "Acquired Competencies": ["Designing Edits"]},
        "Pedagogy": {"Instructional Strategy": "Lecture", "Cognitive Load": "High", "Content Density": "Dense", "Tone": "Forward-Looking"},
        "Recommendations": {}
    },
    {
        "id": "bio_imm_01",
        "Identity": {"Video Title": "How the Immune System Works", "Subject Category": "Biology", "Domain Taxonomy": ["Immunology", "Systems"], "Primary Concept": "Antibodies"},
        "Context": {"Educational Level": "Intermediate", "Target Persona": ["General Audience"], "Practical Utility": "General Interest", "Knowledge Validity": "Universal/Stable"},
        "Competency": {"Prerequisites": ["Biology I"], "Taught Concepts": ["T-Cells"], "Acquired Competencies": ["Understanding Vaccines"]},
        "Pedagogy": {"Instructional Strategy": "Visual Explanation", "Cognitive Load": "Medium", "Content Density": "Balanced", "Tone": "Engaging"},
        "Recommendations": {}
    },
]

# ==================================================================================
# 2. User Interactions (3 Archetypes)
# ==================================================================================

USERS = {
    # ---------------------------------------------------------------------------------
    # USER 1: ALICE (The Deep Diver / Specialist)
    # Profile:
    # - ELO: High (Expert)
    # - Purpose: Skill Building & Industry
    # - Strategy: Live Coding (Practical)
    # - Comfort: HIGHER Load = HIGHER Score (Thrives on density)
    # ---------------------------------------------------------------------------------
    "user_alice": [
        # High Load / Dense / Expert Content -> High Scores
        {"video_id": "cs_algo_03", "score": 95}, # DP (High Load)
        {"video_id": "cs_ml_02", "score": 98},   # Backprop (High Load + Expert)
        {"video_id": "cs_dist_01", "score": 92}, # Distributed (High Load)
        {"video_id": "math_la_02", "score": 90}, # Eigenvalues (High Load)
        
        # Medium Load -> Good Scores
        {"video_id": "cs_algo_01", "score": 88}, # Sorting (Med)
        {"video_id": "cs_algo_02", "score": 85}, # Graph (Med)
        {"video_id": "cs_db_01", "score": 90},   # SQL (Med)
        
        # Low Load -> Lower Scores (Boredom?)
        {"video_id": "cs_ml_01", "score": 75},   # Intro NN (Low)
        {"video_id": "cs_hard_01", "score": 70}, # CPUs (Foundational) - actually High Load in metadata, let's say she found it easy/boring
        
        # Strategy Preference: Live Coding & Scaffolded
        {"video_id": "cs_db_01", "score": 92},   # Live Coding
        {"video_id": "cs_algo_01", "score": 94}, # Live Coding
    ],

    # ---------------------------------------------------------------------------------
    # USER 2: BOB (The Casual Polymath)
    # Profile:
    # - ELO: Intermediate
    # - Purpose: General Interest
    # - Strategy: Visual Explanation
    # - Comfort: LOW/MED Load = High Score. HIGH Load = Low Score (The "Comfort Zone" Effect)
    # ---------------------------------------------------------------------------------
    "user_bob": [
        # Low/Med Load -> High Scores
        {"video_id": "cs_ml_01", "score": 95},   # Intro NN (Low)
        {"video_id": "bio_cell_01", "score": 92},# Cell Structure (Low)
        {"video_id": "phys_mech_01", "score": 88},# Newton (Low)
        {"video_id": "math_stats_01", "score": 85},# Stats (Low) - Visual
        {"video_id": "bio_imm_01", "score": 82}, # Immune (Med) - Visual
        {"video_id": "phys_opt_01", "score": 90}, # Optics (Low) - Visual
        
        # High Load -> Struggle / Dropoff
        {"video_id": "cs_algo_03", "score": 45}, # DP (High) - "Too hard"
        {"video_id": "phys_qm_01", "score": 55}, # Quantum (High) - "Confusing"
        {"video_id": "math_la_02", "score": 50}, # Eigenvalues (High)
        {"video_id": "bio_gen_01", "score": 60}, # CRISPR (High)
        
        # Purpose: General Interest & Visuals
        {"video_id": "bio_eco_01", "score": 88}, # Visual + Low
        {"video_id": "math_la_01", "score": 85}, # Visual
    ],

    # ---------------------------------------------------------------------------------
    # USER 3: CAROL (The Academic Bridge)
    # Profile:
    # - ELO: Advanced (High aptitude)
    # - Purpose: Academic Theory
    # - Strategy: Lecture / Discussion
    # - Comfort: SWEET SPOT is Medium. Low is boring (lower score), High is overwhelming (lower score).
    #            Gaussian distribution of performance!
    # ---------------------------------------------------------------------------------
    "user_carol": [
        # Medium Load -> Peak Performance (Sweet Spot)
        {"video_id": "math_calc_01", "score": 98}, # Limits (Med)
        {"video_id": "math_la_01", "score": 96},   # Vectors (Med)
        {"video_id": "phys_em_01", "score": 94},   # Electrostatics (Med)
        {"video_id": "bio_evo_01", "score": 90},   # Evolution (Med)
        {"video_id": "math_diff_01", "score": 92}, # Diff Eq (Med)
        
        # High Load -> Dip in performance
        {"video_id": "math_calc_02", "score": 75}, # Integration Pts (High)
        {"video_id": "phys_rel_01", "score": 70},  # Relativity (High)
        {"video_id": "phys_em_02", "score": 68},   # Induction (High)
        {"video_id": "cs_ml_02", "score": 65},     # Backprop (High)
        
        # Low Load -> Dip (Boredom)
        {"video_id": "math_stats_01", "score": 78}, # Stats (Low)
        {"video_id": "phys_mech_01", "score": 80},  # Newton (Low)
        {"video_id": "bio_cell_01", "score": 82},   # Cells (Low)
        
        # Distinct Subject Focus: Math & Physics
        {"video_id": "cs_algo_01", "score": None}, # Explroing CS...
    ]
}

def seed_data():
    print(f"🌱 Seeding Dummy Data to {BASE_URL}...")
    
    # 1. Store Video Metadata
    print("\n[1/3] Storing Video Metadata...")
    
    # Lazy import to avoid top-level dependency issues if run as script
    from OrionServer.modules.video_player.Chunking_Embedding_Processor.unified_storage import UnifiedChunkStorage
    from OrionServer.modules.video_player.Chunking_Embedding_Processor.user_profile_storage import UserProfileStorage
    
    storage = UnifiedChunkStorage()
    user_storage = UserProfileStorage()
    
    # Ensure schemas
    storage.ensure_schema()
    user_storage.ensure_schema()
    
    for video in VIDEOS:
        vid = video["id"]
        payload = video.copy()
        del payload["id"]
        
        try:
            # We use the internal storage method directly
            # This simulates what the Recommendation Engine does when ingestion happens
            res = storage.store_video_metadata(vid, payload)
            if res.get("status") == "success":
                # print(f"  ✅ Stored {vid}")
                pass
            else:
                print(f"  ❌ Failed {vid}: {res}")
        except Exception as e:
            print(f"  ❌ Error {vid}: {e}")
            
    print(f"  ✅ Stored {len(VIDEOS)} videos.")

    # 2. Track Interactions
    print("\n[2/3] Tracking Interactions...")
    
    # Import Qdrant models for filtering
    from qdrant_client import models

    for user_id, interactions in USERS.items():
        print(f"  👤 Processing {user_id}...")
        
        # Clear existing history for this user to remove legacy data (e.g. "Verified")
        try:
            user_storage.client.delete(
                collection_name="user_history",
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="user_id",
                                match=models.MatchValue(value=user_id)
                            )
                        ]
                    )
                )
            )
            print(f"    🧹 Cleared history for {user_id}")
        except Exception as e:
            print(f"    ⚠️ Could not clear history (might be empty): {e}")
        
        for interaction in interactions:
            vid = interaction["video_id"]
            score = interaction["score"]
            
            try:
                # Add interaction
                # We simulate a timestamp that spreads these out over the last 30 days
                # to allow time-decay algorithms to show meaningful data if we wanted.
                # For now, immediate is fine.
                res = user_storage.add_interaction(user_id, vid, score, unified_storage=storage)
                
                score_display = score if score is not None else "N/A"
                if res.get("status") != "success":
                     print(f"    ❌ Error {vid}: {res}")
                
            except Exception as e:
                print(f"    ❌ Error {vid}: {e}")
        
        print(f"    ✅ Added {len(interactions)} interactions.")

    print("\n[3/3] Seeding Complete!")

if __name__ == "__main__":
    import sys
    import os
    
    # Path setup for direct execution
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(current_dir, "../../../")) # Adjust to root (Python - Server)
    
    # Add project root to sys.path
    if project_root not in sys.path:
        sys.path.append(project_root)
        
    # Also add OrionServer specifically if needed
    orion_server = os.path.join(project_root, "OrionServer")
    if orion_server not in sys.path:
        sys.path.append(orion_server)

    # Load .env
    from dotenv import load_dotenv
    env_path = os.path.join(orion_server, ".env")
    load_dotenv(env_path, override=True)
    
    seed_data()
