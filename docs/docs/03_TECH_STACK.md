# 💻 Technology Stack & Tooling Guidelines
## Project DepthWizard — ISRO Problem Statement 26175

---

## 1. Approved Software & Frameworks Matrix

To prevent the team from installing conflicting packages or breaking the local environment, everyone must adhere to this exact approved stack:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OFFICIAL APPROVED STACK                           │
├──────────────────────┬───────────────────────────────┬──────────────────────┤
│ Component            │ Technology & Version          │ Primary Purpose      │
├──────────────────────┼───────────────────────────────┼──────────────────────┤
│ Language (Backend)   │ Python 3.13.x                 │ Core logic & APIs    │
│ Web Framework        │ FastAPI 0.115.x + Uvicorn     │ REST API Server      │
│ Geospatial I/O       │ Rasterio 1.4.x / GDAL         │ GeoTIFF CRS & bounds │
│ Numerical Core       │ NumPy 2.3.x + SciPy 1.15.x    │ Affine math & RANSAC │
│ Container I/O        │ h5py 3.16.x                   │ HDF5 satellite data  │
│ Image Utilities      │ Pillow (PIL) 12.3.x           │ Image normalization  │
│ Database             │ SQLite 3 (built-in Python)    │ Scene & metric store │
│ Model Training / Run │ PyTorch (Colab) / ONNX Runtime│ Depth foundation     │
│ Frontend Runtime     │ Node.js 24.x + Vite 6.x       │ Web dev & bundling   │
│ 3D Graphics Engine   │ Three.js r170+                │ WebGL terrain render │
│ 2D Charting          │ Chart.js 4.x                  │ Elevation profile    │
│ Styling & Themes     │ Vanilla CSS3 (Custom Design)  │ ISRO Dark Theme      │
└──────────────────────┴───────────────────────────────┴──────────────────────┘
```

---

## 2. Why We Selected These (Student-Friendly Rationale)

1. **Why FastAPI instead of Django / Flask?**
   - Django is huge, bloated, and requires setting up heavy admin databases we don't need.
   - Flask is too old-school and requires manual boilerplate for JSON and docs.
   - **FastAPI** automatically creates an interactive web page at `http://localhost:8000/docs` where Hasini and the backend team can test API endpoints by clicking buttons without writing frontend code.

2. **Why Three.js instead of CesiumJS or Unity?**
   - **Unity** requires downloading a 5GB engine, takes 20 minutes to compile a build, and easily crashes on low-end laptops.
   - **CesiumJS** is great for the entire Earth globe, but is notoriously hard to configure for small $1024 \times 1024$ local building height models.
   - **Three.js** is pure JavaScript. It runs inside standard Google Chrome at 60 FPS on integrated Intel UHD Graphics without installing anything on the judges' laptops.

3. **Why SQLite instead of PostgreSQL + PostGIS?**
   - Setting up PostgreSQL with PostGIS extensions requires installing database servers, passwords, ports, and Windows services that often break during team collaboration.
   - **SQLite** is just a single lightweight file (`depth.db`). It requires **zero installation**, lives inside our git repository folder, and Python connects to it in 1 line of code.

4. **Why Google Colab T4 for AI Model Training?**
   - Your local laptop has an Intel Core i3 processor without an NVIDIA graphics card.
   - Google Colab gives our team a free **NVIDIA T4 GPU (16GB VRAM)**. Dheer can run the heavy `Depth-Anything-V2` model in the cloud in 5 minutes, download the generated height maps, and drop them into our local app.

---

## 3. Strict "DO NOT USE" Rules (The Guardrails)

> [!CAUTION]
> Violating these rules will cause team merge conflicts, laptop freezes, or presentation failures:

1. **DO NOT install heavy UI component libraries (Material-UI, Tailwind, Chakra):**
   - We will use clean, responsive Vanilla CSS with CSS variables (`--bg-primary`, `--accent-cyan`). This keeps the frontend build super fast and prevents version mismatches.
2. **DO NOT run PyTorch training or multi-epoch model loops locally on your i3 laptop:**
   - Always test heavy training code on Google Colab or Kaggle.
3. **DO NOT install PostgreSQL, MySQL, or MongoDB:**
   - All relational data belongs in the local `depth.db` SQLite database.
4. **DO NOT commit `.tif`, `.pth`, `.h5`, or `.onnx` files larger than 10MB to Git:**
   - GitHub will reject the push or permanently corrupt the repo history. Put all raw data files in the `.gitignore` list and share small sample files via Google Drive or a shared folder.

---

## 4. Setup Commands for Team Members

### For Backend Squad (Lead, Dheer, Hasini)
Run in your Python terminal:
```bash
pip install fastapi uvicorn pydantic rasterio scipy h5py pillow
```

### For Frontend Squad (Tarun, Aarav, Spoorthy)
Run in the frontend terminal:
```bash
cd frontend
npm install three chart.js
npm run dev
```

### For ML Devs (Dheer)
In Google Colab, select **Runtime $\rightarrow$ Change runtime type $\rightarrow$ T4 GPU**, then run:
```bash
!pip install torch torchvision transformers datasets h5py pillow
```
