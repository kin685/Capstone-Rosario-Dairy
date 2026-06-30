# 🥛 Rosario Dairy — Integrated POS & Inventory System with Predictive Analytics

A full-stack web application for managing dairy product sales, inventory, and business analytics.

---

## Features

### 🔐 Authentication & Role-Based Access (RBAC)
- Login page with hashed passwords (werkzeug.security)
- Two roles: **Admin** (full access) and **Staff** (limited access)
- **Admin** can access: Dashboard, POS, Inventory (full CRUD), Analytics, Customers, Sales History
- **Staff** can access: Point of Sale, Inventory (view-only), Sales History
- Staff land directly on the POS terminal after login; Admin lands on the Dashboard
- Backend API routes are protected by role — staff requests to admin-only endpoints (analytics, product CRUD, restock, KPIs) return `403 Forbidden`

### 📊 Dashboard
- Real-time KPI cards (Today's Revenue, Monthly Revenue, Total Transactions, Low Stock Alerts)
- 14-day revenue trend line chart
- Sales by category donut chart
- Top selling products table
- Low stock alert summary

### 🛒 Point of Sale (POS)
- Visual product grid with search and category filtering
- Barcode search support
- Shopping cart with quantity controls
- Multiple payment methods: Cash, GCash, Card
- Discount percentage field
- 12% VAT calculation
- Change calculator (for cash payments)
- Customer loyalty points tracking
- Printable receipt generation

### 📦 Inventory Management
- Full product CRUD (Create, Read, Update, Delete)
- Restock functionality with audit log
- Stock status badges (In Stock / Low Stock / Out of Stock)
- Profit margin display per product
- Category and search filtering

### 📈 Analytics & Predictive Analytics
- Configurable revenue trend chart (14/30/60/90 days)
- **AI-Powered 7-Day Revenue Forecast** (linear regression + weekday seasonality)
- Category revenue breakdown (doughnut chart)
- Top 8 products by units sold (horizontal bar)
- Inventory activity log

### 👥 Customer Management
- Customer database with loyalty points
- Tiered loyalty program (Bronze / Silver / Gold)
- Total spend tracking
- Add new customers from the POS or customer view

### 📋 Reports
- Transaction history log
- Full breakdown per transaction (subtotal, VAT, total, payment method)

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Backend   | Python 3.10+ · Flask 3.0 |
| Frontend  | HTML5 · CSS3 · Vanilla JavaScript (ES2022) |
| Charts    | Chart.js 4.4 |
| Fonts     | Google Fonts (DM Serif Display · Inter · JetBrains Mono) |
| Analytics | Custom linear regression with seasonality (no external ML library required) |

---

## Setup & Installation

### Prerequisites
- Python 3.10 or higher
- pip

### Steps

```bash
# 1. Navigate to the project folder
cd rosario_dairy

# 2. (Optional) Create a virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the server
python app.py
```

### Access the System

Open your browser and go to:
```
http://localhost:5000
```

You'll be redirected to the login page. Default credentials:

| Role  | Username | Password   |
|-------|----------|------------|
| Admin | admin    | admin123   |
| Staff | staff    | staff123   |

> Passwords are stored as hashes (werkzeug.security) — change these in `app.py` before any real deployment.

---

## Project Structure

```
rosario_dairy/
├── app.py                  ← Flask backend (routes, analytics, data)
├── requirements.txt        ← Python dependencies
├── README.md               ← This file
├── templates/
│   └── index.html          ← Single-page application shell
└── static/
    ├── css/
    │   └── style.css       ← Complete design system & styles
    └── js/
        └── app.js          ← Frontend logic (views, charts, API calls)
```

---

## Predictive Analytics Method

The 7-day sales forecast uses:
1. **Linear Regression** — calculates the sales trend slope over the past 30 days
2. **Weekend Seasonality** — applies a 1.3× multiplier on Saturdays and Sundays
3. **Floor Value** — prevents predictions from going below ₱500/day
4. **Noise** — adds slight randomness (±₱50) for realistic variance

This runs entirely in Python on the backend with no external ML libraries.

---

## Sample Data

The system ships with:
- **15 products** across 6 categories (Milk, Cream, Butter, Cheese, Yogurt, Ice Cream)
- **5 customers** with existing loyalty points
- **90 days of simulated sales history** for analytics and predictions
- All data is in-memory; refreshing the server resets it

---

## Developed For

**Rosario Dairy** · Farm Fresh · Established 1998  
System designed as part of a thesis project on integrated inventory and POS systems with predictive analytics.

---

*System uses Philippine Peso (₱) and 12% VAT as per Philippine tax law.*
