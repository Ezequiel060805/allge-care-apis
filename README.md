# 🌱 Backend API – Project Allge Care

Node.js + Express backend that powers my mobile/web project.  
It exposes REST endpoints for **users**, **measurements (pH, temperature, light)**, **alerts**, and **configuration**, with a **JWT login**, **MySQL** database, **CORS** enabled, and **rate limiting**.

---

## ✨ Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** MySQL (`mysql2/promise`)
- **Auth:** JSON Web Tokens (`jsonwebtoken`)
- **Security/UX:** `express-rate-limit`, `cors`, password hashing with **bcrypt**
- **Env config:** `dotenv`

Entry point: `index.js`

---

## 📦 Installation

```bash
git clone https://github.com/Ezequiel060805/allge-care-apis.git
cd allge-care-apis
npm install

