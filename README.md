# LeadX CRM — SaaS Kanban Task Board

A production-level CRM system featuring a card-based Kanban task board, client management, and real-time collaboration.

## 🚀 Features
- **Strict Kanban Build**: A high-fidelity, grid-based task board with 3 columns (To Do, In Progress, Completed).
- **DOM-Based Rendering**: Clean, efficient task card generation using native DOM APIs (no `innerHTML` stacking).
- **Supabase Integration**: Powered by Supabase for Database, Authentication, and Realtime updates.
- **Organization Isolation**: Built-in Multi-tenant support with RLS policies.
- **Integrated Chat & Reports**: Collaboration tools for teams and automated client reporting.

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML5, CSS3 (Custom Design System), JavaScript (ESM).
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions).
- **Dev Server**: Node.js (Express-like minimal server).

## 📦 Setup & Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-repo/leadx-crm.git
   cd leadx-crm
   ```

2. **Configure Environment**:
   - Copy `.env.example` to `.env`.
   - Fill in your `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

3. **Run Locally**:
   ```bash
   node server.js
   ```
   Access the app at `http://localhost:3000`.

## 🗄️ Database Schema
The database schema is provided in `unified_schema.sql`. You can apply this directly in your Supabase SQL Editor.

## 📄 License
MIT License.
