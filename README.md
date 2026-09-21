# MentorConnect – AI-Powered Goal-Based Mentoring Platform

MentorConnect is an AI-powered mentoring platform designed to connect mentees with mentors and track measurable goals, milestones, and real-time collaboration.

This repository is organized with a clean, decoupled full-stack architecture:
- **Frontend**: React, Vite, JavaScript, CSS (vanilla design system)
- **Backend**: Node.js, Express.js, Socket.IO, Prisma ORM
- **Database**: PostgreSQL (Prisma)

---

## 1. Project Structure

```
MentorConnect/
│
├── frontend/                     # React + Vite Client
│   ├── public/                   # Static public assets
│   ├── src/
│   │   ├── assets/               # Local icons, illustrations, images
│   │   ├── components/           # Reusable UI components
│   │   ├── context/              # React context providers (Auth, Socket, etc.)
│   │   ├── hooks/                # Custom React hooks
│   │   ├── layouts/              # Page layouts (DashboardLayout, etc.)
│   │   ├── pages/                # High-level page views
│   │   ├── services/             # API client & backend connection services
│   │   ├── utils/                # Utility helpers & formatters
│   │   ├── App.jsx               # Root application component
│   │   ├── index.css             # Design tokens & global stylesheet
│   │   └── main.jsx              # Application DOM entry point
│   ├── .env.example              # Frontend environment template
│   ├── index.html                # Vite HTML template
│   ├── package.json              # Frontend dependencies and scripts
│   └── vite.config.js            # Vite configuration & dev server proxy
│
├── backend/                      # Node.js + Express Server
│   ├── prisma/
│   │   └── schema.prisma         # Prisma schema configured for PostgreSQL
│   ├── src/
│   │   ├── config/               # Database and third-party configurations
│   │   ├── controllers/          # Request handlers (e.g. healthController)
│   │   ├── middleware/           # Express middleware (auth, error handlers)
│   │   ├── routes/               # API route definitions
│   │   ├── services/             # Core business logic (AI service skeleton, etc.)
│   │   ├── sockets/              # Socket.IO event handlers
│   │   ├── utils/                # Server-side utilities & logger
│   │   ├── app.js                # Express app & middleware composition
│   │   └── server.js             # HTTP server & Socket.IO listener entry
│   ├── .env.example              # Backend environment template
│   └── package.json              # Backend dependencies and scripts
│
├── .gitignore                    # Global git ignore configuration
├── package.json                  # Root monorepo convenience scripts
└── README.md                     # Project documentation
```

---

## 2. How to Install Dependencies

### Option A: Install All from Root (Recommended)
From the root `MentorConnect/` directory, run:
```bash
npm run install:all
```

### Option B: Install Separately

#### Frontend Dependencies:
```bash
cd frontend
npm install
```

#### Backend Dependencies:
```bash
cd backend
npm install
```

---

## 3. Environment Configuration

### Backend:
Copy the example environment file inside `backend/`:
```bash
cd backend
copy .env.example .env
```
*(On Linux/macOS use `cp .env.example .env`)*

### Frontend:
Copy the example environment file inside `frontend/`:
```bash
cd frontend
copy .env.example .env
```
*(On Linux/macOS use `cp .env.example .env`)*

---

## 4. How to Start the Applications

### Starting Backend (Port 5000)
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   npm run dev
   ```
   *(Or from root: `npm run dev:backend`)*
2. The backend server starts at: `http://localhost:5000`
3. Verify the health-check endpoint:
   ```
   GET http://localhost:5000/api/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "message": "MentorConnect API is running successfully",
     "timestamp": "...",
     "uptime": 1.23,
     "environment": "development"
   }
   ```

### Starting Frontend (Port 5173)
1. Open a second terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   npm run dev
   ```
   *(Or from root: `npm run dev:frontend`)*
2. Open your browser at: `http://localhost:5173`
3. The landing screen will automatically verify connectivity to `GET /api/health`.

---

## 5. How to Configure PostgreSQL Later

The project uses **Prisma ORM** with **PostgreSQL**. The database setup is pre-configured in `backend/prisma/schema.prisma`.

To configure your PostgreSQL database when ready:

1. **Install PostgreSQL**:
   Make sure PostgreSQL is running locally (e.g. on port `5432`) or provision a cloud database (e.g., Supabase, Neon, AWS RDS).

2. **Update your `.env` file** in `backend/`:
   ```env
   DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?schema=public"
   ```
   *Example*:
   ```env
   DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/mentorconnect_db?schema=public"
   ```

3. **Run Initial Prisma Migration**:
   Navigate to `backend/` and run:
   ```bash
   npm run prisma:migrate
   ```
   This will create the database tables based on `schema.prisma`.

4. **Generate Prisma Client**:
   ```bash
   npm run prisma:generate
   ```

---

## 6. Available Scripts Summary

| Command | Location | Description |
| :--- | :--- | :--- |
| `npm run install:all` | Root | Installs dependencies for both frontend and backend |
| `npm run dev:backend` | Root | Starts backend server in development mode (nodemon) |
| `npm run dev:frontend` | Root | Starts Vite React frontend development server |
| `npm run build:frontend` | Root | Builds production assets for frontend |
| `npm run dev` | `frontend/` | Starts Vite dev server |
| `npm run build` | `frontend/` | Builds frontend bundle |
| `npm run dev` | `backend/` | Starts backend with nodemon |
| `npm run start` | `backend/` | Starts backend with node |
| `npm run prisma:generate` | `backend/` | Generates the Prisma Client |
| `npm run prisma:migrate` | `backend/` | Runs migrations against PostgreSQL |
