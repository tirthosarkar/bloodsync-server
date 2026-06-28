# 🩸 BloodSync Server — REST API

<div align="center">

**The backend API powering the BloodSync blood donation platform.**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Payment-635BFF?style=for-the-badge&logo=stripe)](https://stripe.com/)

</div>

---

## 📌 Overview

This is the **Express.js REST API** server for BloodSync. It handles all business logic including user management, donation request operations, funding via Stripe, and dashboard analytics.

> 🔗 **Frontend Repository:** [github.com/shahadat-hossain99/bloodsync-client](https://github.com/shahadat-hossain99/bloodsync-client)
> 🌐 **Live Site:** [bloodsync-every-drop-counts.vercel.app](https://bloodsync-every-drop-counts.vercel.app/)

---

## 🔗 Important Links

| Resource             | Link                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| 🌐 Live Frontend     | [bloodsync-every-drop-counts.vercel.app](https://bloodsync-every-drop-counts.vercel.app/)                |
| 💻 Client Repository | [https://github.com/tirthosarkar/bloodsync-client](https://github.com/tirthosarkar/bloodsync-client) |
| 🖥️ Server Repository | [https://github.com/tirthosarkar/bloodsync-server](https://github.com/tirthosarkar/bloodsync-server) |

---

<!-- ## 🔐 Test Credentials

| Role | Email | Password |
|---|---|---|
| 👑 Admin | `admin@bloodsync.com` | `Admin@1234` |
| 🤝 Volunteer | `volunteer@bloodsync.com` | `Volunteer@1234` |
| 🩸 Donor | `donor@bloodsync.com` | `Donor@1234` |

> ⚠️ Please update these with your actual test credentials before submission.

--- -->

## 🛠️ Tech Stack

| Technology                                     | Version | Purpose               |
| ---------------------------------------------- | ------- | --------------------- |
| [Node.js](https://nodejs.org/)                 | 18+     | Runtime environment   |
| [Express.js](https://expressjs.com/)           | 5.x     | Web framework         |
| [MongoDB](https://www.mongodb.com/)            | 7.x     | Database              |
| [Stripe](https://stripe.com/)                  | Latest  | Payment processing    |
| [CORS](https://www.npmjs.com/package/cors)     | Latest  | Cross-origin requests |
| [dotenv](https://www.npmjs.com/package/dotenv) | Latest  | Environment variables |

---

## 📁 Project Structure

```
bloodsync-server/
├── index.js          # Main entry point — Express app, MongoDB, all routes
├── .env              # Environment variables (not committed)
├── .gitignore        # Ignored files
├── package.json      # Dependencies & scripts
└── README.md         # This file
```

---

## 📡 API Endpoints

### 👤 Users

| Method  | Endpoint           | Description                                 |
| ------- | ------------------ | ------------------------------------------- |
| `POST`  | `/api/users`       | Create new user (called after registration) |
| `GET`   | `/api/users/count` | Get total donor count (dashboard stat)      |
| `GET`   | `/api/users/:id`   | Get user by Better Auth ID                  |
| `PATCH` | `/api/users/:id`   | Update user profile                         |

### 🔍 Donor Search

| Method | Endpoint             | Description                                     |
| ------ | -------------------- | ----------------------------------------------- |
| `GET`  | `/api/donors/search` | Search donors by blood group, district, upazila |

### 🩸 Donation Requests

| Method   | Endpoint                                     | Description                           | Access          |
| -------- | -------------------------------------------- | ------------------------------------- | --------------- |
| `GET`    | `/api/donation-requests`                     | Get all pending requests (public)     | Public          |
| `POST`   | `/api/donation-requests`                     | Create new donation request           | Logged in       |
| `GET`    | `/api/donation-requests/count`               | Total request count (dashboard)       | Auth            |
| `GET`    | `/api/donation-requests/status-breakdown`    | Pie chart data                        | Auth            |
| `GET`    | `/api/donation-requests/weekly-stats`        | Bar chart data (last 7 days)          | Auth            |
| `GET`    | `/api/donation-requests/all`                 | All requests with filter & pagination | Admin/Volunteer |
| `GET`    | `/api/donation-requests/recent/:userId`      | Recent 3 requests by user             | Auth            |
| `GET`    | `/api/donation-requests/my-requests/:userId` | All requests by user (paginated)      | Auth            |
| `GET`    | `/api/donation-requests/:id`                 | Single request details                | Auth            |
| `PATCH`  | `/api/donation-requests/:id`                 | Update status (donate/done/cancel)    | Auth            |
| `PUT`    | `/api/donation-requests/edit/:id`            | Edit request details                  | Owner/Admin     |
| `DELETE` | `/api/donation-requests/:id`                 | Delete own request                    | Owner/Admin     |
| `DELETE` | `/api/donation-requests/admin-delete/:id`    | Admin force delete                    | Admin           |

### 👥 Admin — User Management

| Method  | Endpoint               | Description                                   |
| ------- | ---------------------- | --------------------------------------------- |
| `GET`   | `/api/admin/users`     | All users with filter & pagination            |
| `PATCH` | `/api/admin/users/:id` | Block / Unblock / Make Volunteer / Make Admin |

### 💰 Funding

| Method | Endpoint                             | Description                           |
| ------ | ------------------------------------ | ------------------------------------- |
| `GET`  | `/api/funding`                       | All funding records with donor info   |
| `GET`  | `/api/funding/total`                 | Total funding amount (dashboard stat) |
| `POST` | `/api/funding/create-payment-intent` | Create Stripe payment intent          |
| `POST` | `/api/funding`                       | Save completed payment to database    |

---

## 🔄 Donation Status Flow

```
[pending]
    ↓  (A donor clicks "Donate" on the details page)
[inprogress]  — donor name & email saved
    ↓                        ↓
  [done]              [canceled]
  (requester          (requester
   confirms)           cancels)
```

---

## 🗄️ Database Collections

```
bloodsync (MongoDB Database)
├── users              ← App user data (role, status, blood group, district, etc.)
├── user               ← Better Auth managed session data
├── donationRequests   ← All blood donation requests
└── funding            ← All Stripe payment records
```

### User Document Structure

```json
{
  "authId": "better_auth_user_id",
  "name": "Tirtho Sarkar",
  "email": "tirthosarkar1@gmail.com",
  "image": "https://imagebb.com/avatar.png",
  "bloodGroup": "B+",
  "district": "47",
  "upazila": "470401",
  "role": "donor",
  "status": "active",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

### Donation Request Document Structure

```json
{
  "requesterId": "better_auth_user_id",
  "requesterName": "Tirtho Sarkar",
  "requesterEmail": "tirtho@example.com",
  "recipientName": "Patient Name",
  "recipientDistrict": "47",
  "recipientUpazila": "470401",
  "hospitalName": "Rajshahi Medical College Hospital",
  "fullAddress": "Rajshahi Sador, Rajshahi",
  "bloodGroup": "B+",
  "donationDate": "2025-06-30",
  "donationTime": "10:00 AM",
  "requestMessage": "Urgent need for surgery...",
  "status": "pending",
  "donorName": "John doe",
  "donorEmail": "tirtho@example.com",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

---

## 🚀 Getting Started Locally

### Prerequisites

- Node.js `v18+`
- MongoDB Atlas cluster
- Stripe account

### 1. Clone the Repository

```bash
git clone https://github.com/tirthosarkar/bloodsync-server.git
cd bloodsync-server
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root:

```env
PORT=5000
MONGO_DB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/bloodsync
AUTH_DB_NAME=bloodsync
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
FRONTEND_URL=http://localhost:3000
```

### 4. Run the Server

```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

Server runs on → `http://localhost:5000`

---

## ✅ Deployment Checklist

Before going live, ensure:

- ✅ CORS origin set to your live frontend URL
- ✅ MongoDB Atlas IP whitelist → `0.0.0.0/0`
- ✅ All `.env` variables configured in hosting dashboard
- ✅ Root route `GET /` returns a response
- ✅ No `404` / `504` / CORS errors on production
- ✅ All routes tested on live URL
- ✅ Stripe webhook configured (if applicable)
- ✅ Page does not throw error on reload from any route

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "cors": "cross-origin request handling",
    "dotenv": "environment variable management",
    "express": "web framework",
    "mongodb": "MongoDB native driver",
    "stripe": "payment processing"
  },
  "devDependencies": {
    "nodemon": "auto-restart on file changes"
  }
}
```

---

## 👨‍💻 Developer

<div align="center">

**Tirtho Sarkar**

[![GitHub](https://img.shields.io/badge/GitHub-tirthosarkar-181717?style=flat-square&logo=github)](https://www.linkedin.com/in/tirtho-sarkar/)

</div>

---