"""
Rosario Dairy - Integrated Inventory and Point-of-Sale System
with Predictive Analytics
"""

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from datetime import datetime, timedelta
import json
import os
import random
import math
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = 'rosario_dairy_secret_2024'

# ─── Users / RBAC ─────────────────────────────────────────────────────────────
# In-memory user store. Passwords are hashed with werkzeug.security.
# Default credentials (change for production use):
#   admin / admin123   -> role: admin
#   staff / staff123   -> role: staff
users = [
    {
        "id": 1,
        "username": "admin",
        "password_hash": generate_password_hash("admin123"),
        "name": "Admin",
        "role": "admin",
        "title": "Store Manager",
    },
    {
        "id": 2,
        "username": "staff",
        "password_hash": generate_password_hash("staff123"),
        "name": "Staff",
        "role": "staff",
        "title": "Sales Associate",
    },
]


def find_user(username):
    return next((u for u in users if u["username"].lower() == username.lower()), None)


def current_user():
    if "user_id" not in session:
        return None
    return next((u for u in users if u["id"] == session["user_id"]), None)


def login_required(f):
    """Require any authenticated user (admin or staff)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required"}), 401
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def roles_required(*roles):
    """Require the authenticated user to have one of the given roles."""
    def wrapper(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if "user_id" not in session:
                if request.path.startswith("/api/"):
                    return jsonify({"error": "Authentication required"}), 401
                return redirect(url_for("login"))
            if session.get("role") not in roles:
                if request.path.startswith("/api/"):
                    return jsonify({"error": "Forbidden: insufficient permissions"}), 403
                return redirect(url_for("index"))
            return f(*args, **kwargs)
        return decorated
    return wrapper


admin_required = roles_required("admin")

# ─── In-Memory Data Store ────────────────────────────────────────────────────

products = [
    {"id": 1, "name": "Fresh Milk",     "category": "Milk",    "price": 110.00,  "cost": 40.00,  "stock": 150, "unit": "liter",   "min_stock": 30, "barcode": "RD001"},
    {"id": 2, "name": "Melon Milk",            "category": "Flavoured Milk",    "price": 120.00,  "cost": 36.00,  "stock": 80,  "unit": "liter",   "min_stock": 20, "barcode": "RD002"},
    {"id": 3, "name": "Chocolate Milk",       "category": "Flavoured Milk", "price": 120.00,  "cost": 45.00,  "stock": 60,  "unit": "liter",   "min_stock": 15, "barcode": "RD003"},
    {"id": 4, "name": "Fresh Cream",          "category": "Cream",   "price": 120.00, "cost": 75.00,  "stock": 40,  "unit": "250ml",   "min_stock": 10, "barcode": "RD004"},
    {"id": 5, "name": "Butter (Salted)",      "category": "Butter",  "price": 95.00,  "cost": 58.00,  "stock": 55,  "unit": "250g",    "min_stock": 12, "barcode": "RD005"},
    {"id": 6, "name": "Butter (Unsalted)",    "category": "Butter",  "price": 95.00,  "cost": 58.00,  "stock": 45,  "unit": "250g",    "min_stock": 12, "barcode": "RD006"},
    {"id": 7, "name": "Mozzarella Cheese",    "category": "Cheese",  "price": 180.00, "cost": 110.00, "stock": 25,  "unit": "200g",    "min_stock": 8,  "barcode": "RD007"},
    {"id": 8, "name": "Kesong Puti",          "category": "Cheese",  "price": 90.00,  "cost": 55.00,  "stock": 35,  "unit": "200g",    "min_stock": 10, "barcode": "RD008"},
    {"id": 9, "name": "Plain Yogurt",         "category": "Yogurt",  "price": 85.00,  "cost": 50.00,  "stock": 30,  "unit": "200g",    "min_stock": 8,  "barcode": "RD009"},
    {"id": 10,"name": "Strawberry Yogurt",    "category": "Yogurt",  "price": 90.00,  "cost": 54.00,  "stock": 28,  "unit": "200g",    "min_stock": 8,  "barcode": "RD010"},
    {"id": 11,"name": "Strawberry Milk",       "category": "Flavoured Milk",    "price": 55.00,  "cost": 32.00,  "stock": 90,  "unit": "300ml",   "min_stock": 20, "barcode": "RD011"},
    {"id": 12,"name": "Pandan Milk",      "category": "Flavoured Milk",    "price": 50.00,  "cost": 30.00,  "stock": 100, "unit": "370ml",   "min_stock": 25, "barcode": "RD012"},
    {"id": 13,"name": "Ice Cream Vanilla",    "category": "Ice Cream","price": 150.00,"cost": 90.00,  "stock": 20,  "unit": "pint",    "min_stock": 5,  "barcode": "RD013"},
    {"id": 14,"name": "Ice Cream Chocolate",  "category": "Ice Cream","price": 150.00,"cost": 90.00,  "stock": 18,  "unit": "pint",    "min_stock": 5,  "barcode": "RD014"},
    {"id": 15,"name": "Pasteurized Milk",     "category": "Milk",    "price": 70.00,  "cost": 42.00,  "stock": 120, "unit": "liter",   "min_stock": 25, "barcode": "RD015"},
]

customers = [
    {"id": 1, "name": "Walk-in Customer",       "phone": "",           "email": "", "points": 0,   "total_spent": 0},
    {"id": 2, "name": "Maria Santos",           "phone": "09171234567","email": "maria@email.com",  "points": 450, "total_spent": 4500},
    {"id": 3, "name": "Juan dela Cruz",         "phone": "09281234567","email": "juan@email.com",   "points": 280, "total_spent": 2800},
    {"id": 4, "name": "Ana Reyes",              "phone": "09391234567","email": "ana@email.com",    "points": 620, "total_spent": 6200},
    {"id": 5, "name": "Pedro Bautista",         "phone": "09451234567","email": "pedro@email.com",  "points": 195, "total_spent": 1950},
]

transactions = []
inventory_logs = []
next_transaction_id = 1001
next_product_id = 16

# ─── Generate historical sales data for analytics ────────────────────────────

def generate_sales_history():
    """Generate 90 days of realistic sales history"""
    history = []
    base_date = datetime.now() - timedelta(days=90)

    for day in range(90):
        current_date = base_date + timedelta(days=day)
        # Weekend boost
        is_weekend = current_date.weekday() >= 5
        # More sales near end of month (payday)
        is_payday_week = current_date.day in range(14, 18) or current_date.day in range(28, 32)

        num_transactions = random.randint(12, 20)
        if is_weekend:
            num_transactions = int(num_transactions * 1.4)
        if is_payday_week:
            num_transactions = int(num_transactions * 1.2)

        for _ in range(num_transactions):
            tx_products = random.sample(products, k=random.randint(1, 4))
            items = []
            total = 0
            for p in tx_products:
                qty = random.randint(1, 5)
                subtotal = p["price"] * qty
                total += subtotal
                items.append({"product_id": p["id"], "name": p["name"],
                               "category": p["category"], "qty": qty,
                               "price": p["price"], "subtotal": subtotal})

            history.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "total": round(total, 2),
                "items": items,
                "payment": random.choice(["Cash", "GCash", "Card"])
            })
    return history

sales_history = generate_sales_history()

# ─── Analytics / Prediction Helpers ──────────────────────────────────────────

def get_daily_revenue(days=30):
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    daily = {}
    for tx in sales_history:
        if tx["date"] >= cutoff:
            daily[tx["date"]] = daily.get(tx["date"], 0) + tx["total"]
    for tx in transactions:
        d = tx["date"][:10]
        if d >= cutoff:
            daily[d] = daily.get(d, 0) + tx["total"]
    return dict(sorted(daily.items()))

def get_top_products(limit=5):
    counts = {}
    revenue = {}
    for tx in sales_history:
        for item in tx["items"]:
            pid = item["product_id"]
            counts[pid] = counts.get(pid, 0) + item["qty"]
            revenue[pid] = revenue.get(pid, 0) + item["subtotal"]
    for tx in transactions:
        for item in tx["items"]:
            pid = item["product_id"]
            counts[pid] = counts.get(pid, 0) + item["qty"]
            revenue[pid] = revenue.get(pid, 0) + item["subtotal"]
    top = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    result = []
    for pid, qty in top:
        p = next((x for x in products if x["id"] == pid), None)
        if p:
            result.append({"name": p["name"], "qty": qty, "revenue": round(revenue.get(pid, 0), 2)})
    return result

def predict_next_7_days():
    """Simple linear regression + seasonality prediction"""
    daily = get_daily_revenue(30)
    values = list(daily.values())
    if len(values) < 7:
        return []

    n = len(values)
    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    num = sum((i - x_mean) * (values[i] - y_mean) for i in range(n))
    den = sum((i - x_mean) ** 2 for i in range(n))
    slope = num / den if den != 0 else 0
    intercept = y_mean - slope * x_mean

    predictions = []
    last_date = datetime.now()
    for i in range(1, 8):
        pred_date = last_date + timedelta(days=i)
        base = intercept + slope * (n + i)
        # Add weekend adjustment
        if pred_date.weekday() >= 5:
            base *= 1.3
        base = max(base, 500)  # floor
        base += random.uniform(-50, 50)  # noise
        predictions.append({
            "date": pred_date.strftime("%Y-%m-%d"),
            "predicted": round(base, 2),
            "day": pred_date.strftime("%a")
        })
    return predictions

def get_category_breakdown():
    totals = {}
    for tx in sales_history[-30:]:  # last 30 days
        for item in tx["items"]:
            cat = item["category"]
            totals[cat] = totals.get(cat, 0) + item["subtotal"]
    for tx in transactions:
        for item in tx["items"]:
            cat = item["category"]
            totals[cat] = totals.get(cat, 0) + item["subtotal"]
    return [{"category": k, "revenue": round(v, 2)} for k, v in sorted(totals.items(), key=lambda x: x[1], reverse=True)]

def get_low_stock_alerts():
    return [p for p in products if p["stock"] <= p["min_stock"]]

def get_kpis():
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    today_rev = sum(tx["total"] for tx in transactions if tx["date"][:10] == today)
    today_rev += sum(tx["total"] for tx in sales_history if tx["date"] == today)

    yesterday_rev = sum(tx["total"] for tx in sales_history if tx["date"] == yesterday)

    # Monthly
    month_start = datetime.now().replace(day=1).strftime("%Y-%m-%d")
    monthly_rev = sum(tx["total"] for tx in sales_history if tx["date"] >= month_start)
    monthly_rev += sum(tx["total"] for tx in transactions if tx["date"][:10] >= month_start)

    total_products = len(products)
    low_stock_count = len(get_low_stock_alerts())

    change = ((today_rev - yesterday_rev) / yesterday_rev * 100) if yesterday_rev else 0

    return {
        "today_revenue": round(today_rev, 2),
        "yesterday_revenue": round(yesterday_rev, 2),
        "revenue_change": round(change, 1),
        "monthly_revenue": round(monthly_rev, 2),
        "total_products": total_products,
        "low_stock_count": low_stock_count,
        "total_customers": len(customers),
        "total_transactions": len(transactions) + len(sales_history),
    }

# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        if "user_id" in session:
            return redirect(url_for("index"))
        return render_template("login.html")

    data = request.form if request.form else (request.json or {})
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    user = find_user(username)
    if not user or not check_password_hash(user["password_hash"], password):
        if request.is_json:
            return jsonify({"success": False, "error": "Invalid username or password"}), 401
        return render_template("login.html", error="Invalid username or password")

    session["user_id"] = user["id"]
    session["role"] = user["role"]
    session["name"] = user["name"]

    if request.is_json:
        return jsonify({"success": True, "user": {"name": user["name"], "role": user["role"]}})
    return redirect(url_for("index"))


@app.route("/logout", methods=["GET", "POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/api/me")
@login_required
def api_me():
    u = current_user()
    return jsonify({"name": u["name"], "role": u["role"], "title": u["title"], "username": u["username"]})

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
@login_required
def index():
    u = current_user()
    return render_template("index.html", user=u)

@app.route("/api/kpis")
@admin_required
def api_kpis():
    return jsonify(get_kpis())

@app.route("/api/products", methods=["GET"])
@login_required
def api_products():
    search = request.args.get("q", "").lower()
    cat    = request.args.get("category", "")
    result = products
    if search:
        result = [p for p in result if search in p["name"].lower() or search in p["barcode"].lower()]
    if cat:
        result = [p for p in result if p["category"] == cat]
    return jsonify(result)

@app.route("/api/products", methods=["POST"])
@admin_required
def add_product():
    global next_product_id
    data = request.json
    new_product = {
        "id": next_product_id,
        "name": data["name"],
        "category": data["category"],
        "price": float(data["price"]),
        "cost": float(data["cost"]),
        "stock": int(data["stock"]),
        "unit": data["unit"],
        "min_stock": int(data.get("min_stock", 10)),
        "barcode": data.get("barcode", f"RD{next_product_id:03d}"),
    }
    products.append(new_product)
    next_product_id += 1
    return jsonify({"success": True, "product": new_product})

@app.route("/api/products/<int:pid>", methods=["PUT"])
@admin_required
def update_product(pid):
    p = next((x for x in products if x["id"] == pid), None)
    if not p:
        return jsonify({"error": "Not found"}), 404
    data = request.json
    for key in ["name","category","price","cost","stock","unit","min_stock","barcode"]:
        if key in data:
            p[key] = float(data[key]) if key in ["price","cost"] else \
                     int(data[key]) if key in ["stock","min_stock"] else data[key]
    return jsonify({"success": True, "product": p})

@app.route("/api/products/<int:pid>", methods=["DELETE"])
@admin_required
def delete_product(pid):
    global products
    products = [p for p in products if p["id"] != pid]
    return jsonify({"success": True})

@app.route("/api/products/<int:pid>/restock", methods=["POST"])
@admin_required
def restock_product(pid):
    p = next((x for x in products if x["id"] == pid), None)
    if not p:
        return jsonify({"error": "Not found"}), 404
    qty = int(request.json.get("qty", 0))
    p["stock"] += qty
    inventory_logs.append({
        "date": datetime.now().isoformat(),
        "product": p["name"],
        "action": "Restock",
        "qty": qty,
        "new_stock": p["stock"]
    })
    return jsonify({"success": True, "new_stock": p["stock"]})

@app.route("/api/customers", methods=["GET"])
@login_required
def api_customers():
    return jsonify(customers)

@app.route("/api/customers", methods=["POST"])
@login_required
def add_customer():
    data = request.json
    new_c = {
        "id": max(c["id"] for c in customers) + 1,
        "name": data["name"],
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "points": 0,
        "total_spent": 0
    }
    customers.append(new_c)
    return jsonify({"success": True, "customer": new_c})

@app.route("/api/transactions", methods=["POST"])
@login_required
def create_transaction():
    global next_transaction_id
    data = request.json
    items = data.get("items", [])
    customer_id = data.get("customer_id", 1)
    payment = data.get("payment", "Cash")
    discount = float(data.get("discount", 0))

    # Validate stock and build items
    processed = []
    subtotal = 0
    for item in items:
        p = next((x for x in products if x["id"] == item["product_id"]), None)
        if not p:
            return jsonify({"error": f"Product {item['product_id']} not found"}), 400
        if p["stock"] < item["qty"]:
            return jsonify({"error": f"Insufficient stock for {p['name']}"}), 400
        line = item["qty"] * p["price"]
        subtotal += line
        processed.append({
            "product_id": p["id"],
            "name": p["name"],
            "category": p["category"],
            "qty": item["qty"],
            "price": p["price"],
            "subtotal": line
        })
        p["stock"] -= item["qty"]
        inventory_logs.append({
            "date": datetime.now().isoformat(),
            "product": p["name"],
            "action": "Sale",
            "qty": -item["qty"],
            "new_stock": p["stock"]
        })

    total = round(subtotal * (1 - discount / 100), 2)
    tax = round(total * 0.12, 2)
    grand_total = round(total + tax, 2)

    # Update customer
    cust = next((c for c in customers if c["id"] == customer_id), None)
    points_earned = int(grand_total // 100)
    if cust:
        cust["points"] += points_earned
        cust["total_spent"] += grand_total

    tx = {
        "id": next_transaction_id,
        "date": datetime.now().isoformat(),
        "customer_id": customer_id,
        "customer_name": cust["name"] if cust else "Walk-in",
        "items": processed,
        "subtotal": round(subtotal, 2),
        "discount": discount,
        "total": total,
        "tax": tax,
        "grand_total": grand_total,
        "payment": payment,
        "points_earned": points_earned,
    }
    transactions.append(tx)
    next_transaction_id += 1

    return jsonify({"success": True, "transaction": tx})

@app.route("/api/transactions", methods=["GET"])
@login_required
def get_transactions():
    limit = int(request.args.get("limit", 20))
    return jsonify(transactions[-limit:][::-1])

@app.route("/api/analytics/revenue")
@admin_required
def analytics_revenue():
    days = int(request.args.get("days", 30))
    return jsonify(get_daily_revenue(days))

@app.route("/api/analytics/top-products")
@admin_required
def analytics_top():
    return jsonify(get_top_products(8))

@app.route("/api/analytics/predictions")
@admin_required
def analytics_predictions():
    return jsonify(predict_next_7_days())

@app.route("/api/analytics/categories")
@admin_required
def analytics_categories():
    return jsonify(get_category_breakdown())

@app.route("/api/analytics/low-stock")
@admin_required
def analytics_low_stock():
    return jsonify(get_low_stock_alerts())

@app.route("/api/analytics/inventory-logs")
@admin_required
def analytics_inventory_logs():
    return jsonify(inventory_logs[-50:][::-1])

if __name__ == "__main__":
    app.run(debug=True, port=5000)
