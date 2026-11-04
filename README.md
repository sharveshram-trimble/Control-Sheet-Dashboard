# 📊 Trimble ITGC Control Sheet Live Dashboard

An executive, high-performance React dashboard created for Trimble to monitor, analyze, and track ITGC (Information Technology General Controls) compliance in real-time.

---

## 🔗 Integrated Workflow Details
- **Workflow ID:** `LqRIsl66FSC8Nj8Q`
- **Workflow URL:** [https://flows.stage.trimble-ai.com/workflow/LqRIsl66FSC8Nj8Q](https://flows.stage.trimble-ai.com/workflow/LqRIsl66FSC8Nj8Q)
- **Workflow Name:** `Dashboard - Control Sheet`
- **Data Source:** Google Sheet *Kay Automation* (`1H3Yh_D4xzBNdAa9UyjqisvkOb7Ca87wewiZwD8nrYeo`), Sheet2 (`gid=2082235550`).
- **Control Scope:** Filters ITGC rows where Control ID includes `01.04` (Change Management deploy monitoring) or `02.05` (Access Management periodic review) — producing **42 key controls** across **22 control owners**.

---

## 🎯 Core Features & Business Logic

### 1. Control Sheet Percentage Completion
- Automatically calculated in real-time by checking whether the **TICKET NUMBER** column is populated:
  $$\text{Completion \%} = \left( \frac{\text{Controls with Verified Ticket}}{\text{Total Controls (42)}} \right) \times 100$$
- Visualized through an interactive **radial progress ring** with animated SVG stroke and dynamic color changes.

### 2. Two-Column Owner Separation (Core Requirement)
- **Left Column — Completed Owners:**
  - Displays owners who have completed/verified ticket numbers for their controls (e.g., **Nivetha SKM** with `100% Fully Completed`, **Phil Burgess** with `50% Partially Completed`).
  - Lists verified ticket pills (`APP1000123`, `APP2345`, `APP0987`), application names, control IDs, and direct Google Drive Q1-Q4 evidence folder links.
- **Right Column — Didn't Complete Owners (Pending):**
  - Displays owners who still have missing ticket numbers (e.g., **Aaron Pick**, **Dirk Prinoth**, **Isaac Perez**, **Chitra Ganesan**, etc.).
  - Shows total missing tickets count, affected applications, and pending control IDs.
  - **Quick Ticket Simulator:** Allows instant inline testing of ticket verification right inside the dashboard.
  - **One-Click Reminder Email Generator:** Generates and copies a personalized, polite follow-up email directly to your clipboard with their exact pending controls!

### 3. Interactive Control Sheet Matrix (Table Explorer)
- Full interactive grid of all 42 ITGC controls.
- Real-time search by Application Name, Control ID, Owner, or Ticket Number.
- Filter by status (`All`, `Completed (Ticket Verified)`, `Pending (Missing)`) and by Sub-process (`Access Management`, `Change Management`).
- **CSV Export:** Download a complete compliance audit report in CSV format with a single click.

### 4. Process & Scope Analytics
- High-level breakdown of **Access Management (02.05)** vs **Change Management (01.04)**.
- Application-level compliance progress bar for all 16 applications (Datadog, Salesforce DX, Aria, BSM, Okta, RevPro, Oracle, etc.).

---

## 🎨 Design & Enterprise Theme
- **Theme:** Crisp Executive White and Iconic Trimble Blue (`#0063A5`, `#004F84`, `#00A3E0`).
- **Typography:** Google Fonts: *Inter* and *Plus Jakarta Sans*.
- **Icons:** Modern *Lucide React* enterprise iconography.
- **Animations:** Micro-interactions, pulsing live ping indicator, hover lift, smooth radial SVG transitions, and celebration confetti on ticket verification!

---

## 🚀 Running the Dashboard Locally

```bash
# 1. Navigate to the project folder
cd C:\Users\sharves\Desktop\Trimble\Dashboard

# 2. Install dependencies (if not already installed)
npm install

# 3. Start the live Vite development server
npm run dev
```

The dashboard will be live at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## ⚡ Live n8n Stage Synchronization
The dashboard connects directly to the Trimble n8n stage instance:
- **API Endpoint:** `/api/live-data`
- Configurable auto-refresh (`Manual`, `15s`, `30s`, `60s`).
- One-click **"Sync Now"** button with live spinning feedback and execution ID tracking.
- Seamless offline/network-loss resilience: Automatically falls back to local snapshot if the stage API is momentarily unreachable.
