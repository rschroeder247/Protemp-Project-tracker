# Protemp Project Tracker

A mobile-first web app for Protemp's field teams to track site progress, tick off installation stages, enter technician names, and lock progress in real-time.

Built with **Next.js**, **Supabase (Postgres, Realtime & Auth)**, and deployed on **Vercel**.

---

## 🌟 Key Features

1. **Flexible WBS Tree Hierarchy:**
   - Supports arbitrary tree depth from Master Projects down to linked subprojects.
   - Any item can have **1 to 20+ subtasks/stages** dynamically.
   - Summary tasks expand/collapse cleanly with child progress rollups.

2. **Mobile-First Execution for Field Crews:**
   - Designed at **400 px** mobile viewport target, centered up to 760 px on desktop.
   - Ticking an unlocked stage marks it pending (blue check).
   - "Done by" technician name auto-fills from remembered local storage.
   - Offline-safe: pending ticks survive page reloads, app restarts, or signal drops.
   - "Save and lock": batch commits changes to Supabase and locks the stages with padlock indicator.
   - Owner can unlock saved stages.

3. **Live Realtime Collaboration:**
   - Connected via Supabase Realtime so that saves by any technician update all open phones on site within ~2 seconds.

4. **Microsoft Project Integration:**
   - Ingests WBS structures and quoted hours from `Master Project.mpp` and linked subprojects.
   - Includes 1-click VBA export macro (`scripts/ExportToTracker.bas`) for Excel / MS Project.
   - Ingest endpoint at `/api/sync-project`.

---

## 🚀 Stack & Deployment

- **Frontend / Framework:** Next.js 14+ (App Router, Tailwind CSS, Lucide Icons)
- **Database & Realtime:** Supabase
- **Hosting & CI/CD:** Vercel (connected to GitHub `rschroeder247/Protemp-Project-tracker`)
- **Version Control:** GitHub
