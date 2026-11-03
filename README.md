# Smart Timetable Generator

A responsive full-stack academic timetable planner built with **HTML, CSS, JavaScript and Node.js**. It uses Node.js built-in modules, so there are no third-party packages to install.

## Features

- Student registration and sign-in
- Password hashing with Node.js `crypto` (scrypt)
- Personal dashboard with saved timetable count
- Add/remove subjects, faculty, weekly periods and class type
- Choose weekdays, time slots and rooms
- Smart timetable generation with a maximum of two periods per subject per day
- Prevents the same faculty member being assigned to two classes in the same time slot
- Saves schedules to a local JSON database
- Open and delete saved schedules
- Responsive desktop/tablet/mobile layout
- Print timetable or save it as PDF using the browser print dialog

## Requirements

- Node.js 18 or newer
- A modern browser

## Run on Windows (PowerShell)

1. Extract `Smart_Timetable_Generator.zip`.
2. Open the extracted `Smart_Timetable_Generator` folder in VS Code.
3. Open **Terminal → New Terminal**.
4. Check Node.js:

   ```powershell
   node --version
   ```

5. Start the project:

   ```powershell
   npm start
   ```

   Or, without npm:

   ```powershell
   node server.js
   ```

6. Open this address in Chrome:

   `http://localhost:3000`

7. Select **Create account**, register, then sign in.

> No `npm install` is needed. This project uses only Node.js built-in modules.

## Project structure

```text
Smart_Timetable_Generator/
│
├── server.js                 # Node.js backend and API
├── package.json              # Project metadata and run scripts
├── README.md                 # Setup and project documentation
├── data/
│   └── db.json               # Local JSON storage (created automatically)
└── public/
    ├── index.html            # Login, dashboard, builder and timetable views
    ├── styles.css            # Responsive design and animations
    └── app.js                # Frontend logic and API communication
```

## How it works

1. The browser loads the frontend from the Node.js server.
2. Registration/login requests are sent to `/api/register` and `/api/login`.
3. The backend verifies the account and returns a temporary session token.
4. The student enters subjects, faculty names, weekly period counts, days, slots and rooms.
5. The generator distributes requested periods across the selected week while checking faculty time clashes and daily subject limits.
6. The generated timetable is stored in `data/db.json` and displayed in a weekly grid.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/register` | Create student account |
| POST | `/api/login` | Sign in |
| POST | `/api/logout` | Sign out |
| GET | `/api/me` | Validate current session |
| POST | `/api/generate` | Generate and save timetable |
| GET | `/api/timetables` | List the signed-in user's schedules |
| DELETE | `/api/timetables/:id` | Delete a saved schedule |

## Important notes

- This is a learning/demo project intended to run locally. The in-memory session map resets when the server restarts, so sign in again after restarting it.
- The JSON database is suitable for a college demo or local prototype, not a multi-user production deployment.
- The generator is a practical heuristic, not an advanced constraint-satisfaction solver. If the requested periods do not fit, reduce the number of periods or add more slots/days.
- Do not use real sensitive passwords in a classroom demo.
