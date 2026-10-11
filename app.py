"""
PocketTrack — Cloud-Connected Student Expense & Pocket Money Tracker
Backend: Python 3 + Flask + PyMongo (MongoDB Atlas) with SQLite Fallback
"""

import os
import sys
import uuid
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory
from dotenv import load_dotenv

# Ensure console output doesn't crash on Windows default encodings
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Load environment variables
load_dotenv()

app = Flask(__name__, template_folder="templates", static_folder="static")

# Database Configuration
MONGODB_URI = os.getenv("MONGODB_URI")
SQLITE_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "expenses.db")

mongo_client = None
mongo_db = None
mongo_col = None
DB_ENGINE = "sqlite"

# Try MongoDB Atlas connection if URI is present
if MONGODB_URI:
    try:
        from pymongo import MongoClient
        mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=4000)
        # Test connection ping
        mongo_client.admin.command("ping")
        mongo_db = mongo_client.get_database("student_expenses")
        mongo_col = mongo_db["transactions"]
        DB_ENGINE = "mongodb"
        print("[OK] Connected to MongoDB Atlas Cloud Database")
    except Exception as e:
        print(f"[WARN] MongoDB Atlas connection failed ({e}). Falling back to local SQLite.")
        DB_ENGINE = "sqlite"
else:
    print("[INFO] No MONGODB_URI found in .env. Initializing local SQLite database.")
    DB_ENGINE = "sqlite"


# SQLite Initialization Helper
def init_sqlite():
    conn = sqlite3.connect(SQLITE_DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            account TEXT,
            from_account TEXT,
            to_account TEXT,
            category TEXT,
            date TEXT NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

if DB_ENGINE == "sqlite":
    init_sqlite()


# ==============================================================================
# Helper Functions: DB Operations & Summary Calculation
# ==============================================================================

def get_all_transactions():
    """Retrieve all transactions ordered newest first."""
    if DB_ENGINE == "mongodb":
        records = list(mongo_col.find().sort("date", -1))
        # Format MongoDB ObjectId/id for clean JSON
        for r in records:
            r["id"] = str(r.get("_id", r.get("id", "")))
            if "_id" in r:
                del r["_id"]
        return records
    else:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM transactions ORDER BY date DESC, created_at DESC")
        rows = cur.fetchall()
        records = [dict(row) for row in rows]
        conn.close()
        return records


def save_transaction(tx):
    """Insert a single transaction into active database."""
    if DB_ENGINE == "mongodb":
        # Store as MongoDB document
        doc = dict(tx)
        doc["_id"] = tx["id"]
        mongo_col.insert_one(doc)
    else:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO transactions (id, type, title, amount, account, from_account, to_account, category, date, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            tx["id"], tx["type"], tx["title"], tx["amount"],
            tx.get("account"), tx.get("from_account"), tx.get("to_account"),
            tx.get("category"), tx["date"], tx.get("notes", ""), tx["created_at"]
        ))
        conn.commit()
        conn.close()


def remove_transaction(tx_id):
    """Delete a transaction by id."""
    if DB_ENGINE == "mongodb":
        result = mongo_col.delete_one({"_id": tx_id})
        if result.deleted_count == 0:
            mongo_col.delete_one({"id": tx_id})
        return True
    else:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM transactions WHERE id = ?", (tx_id,))
        conn.commit()
        conn.close()
        return True


def clear_all_transactions():
    """Clear all records from active database."""
    if DB_ENGINE == "mongodb":
        mongo_col.delete_many({})
    else:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cur = conn.cursor()
        cur.execute("DELETE FROM transactions")
        conn.commit()
        conn.close()


def calculate_summary(transactions):
    """
    CRUCIAL BUSINESS LOGIC:
    1. 'income':
       - Adds money to 'account' (UPI or Cash).
       - Increases 'total_pocket_money'.
    2. 'expense':
       - Deducts money from 'account' (UPI or Cash).
       - Increases 'total_spent'.
       - Adds to 'category_breakdown'.
    3. 'transfer':
       - Deducts money from 'from_account' (source).
       - Adds money to 'to_account' (destination).
       - MUST NOT affect 'total_pocket_money' or 'total_spent'!
    """
    upi_balance = 0.0
    cash_balance = 0.0
    total_pocket_money = 0.0
    total_spent = 0.0
    category_breakdown = {}

    for tx in transactions:
        tx_type = tx.get("type")
        amount = float(tx.get("amount", 0.0))

        if tx_type == "income":
            acc = tx.get("account")
            if acc == "UPI":
                upi_balance += amount
            elif acc == "Cash":
                cash_balance += amount
            total_pocket_money += amount

        elif tx_type == "expense":
            acc = tx.get("account")
            if acc == "UPI":
                upi_balance -= amount
            elif acc == "Cash":
                cash_balance -= amount
            total_spent += amount
            cat = tx.get("category", "Other Expense")
            category_breakdown[cat] = category_breakdown.get(cat, 0.0) + amount

        elif tx_type == "transfer":
            from_acc = tx.get("from_account")
            to_acc = tx.get("to_account")

            # Deduct from source account
            if from_acc == "UPI":
                upi_balance -= amount
            elif from_acc == "Cash":
                cash_balance -= amount

            # Add to destination account
            if to_acc == "UPI":
                upi_balance += amount
            elif to_acc == "Cash":
                cash_balance += amount

            # NOTE: total_pocket_money and total_spent remain strictly untouched!

    # Rounding and ratio calculations
    total_balance = upi_balance + cash_balance
    remaining_pocket_money = total_pocket_money - total_spent
    spend_ratio = round((total_spent / total_pocket_money * 100), 1) if total_pocket_money > 0 else 0.0

    return {
        "upi_balance": round(upi_balance, 2),
        "cash_balance": round(cash_balance, 2),
        "total_balance": round(total_balance, 2),
        "total_pocket_money": round(total_pocket_money, 2),
        "total_spent": round(total_spent, 2),
        "remaining_pocket_money": round(remaining_pocket_money, 2),
        "spend_ratio": spend_ratio,
        "category_breakdown": {k: round(v, 2) for k, v in category_breakdown.items()}
    }


# ==============================================================================
# REST API Endpoints
# ==============================================================================

@app.route("/")
def index():
    """Serve the dashboard web application."""
    return render_template("index.html")


@app.route("/api/status", methods=["GET"])
def api_status():
    """Return backend server and database engine connectivity status."""
    return jsonify({
        "connected": True,
        "engine": "MongoDB Atlas (Cloud)" if DB_ENGINE == "mongodb" else "SQLite (Local Database)",
        "is_cloud": DB_ENGINE == "mongodb",
        "message": "Connected to MongoDB Atlas cloud database" if DB_ENGINE == "mongodb" else "Operating with persistent SQLite local database"
    })


@app.route("/api/transactions", methods=["GET"])
def api_get_transactions():
    """Retrieve all transactions and current live summary."""
    txs = get_all_transactions()
    summary = calculate_summary(txs)
    return jsonify({
        "success": True,
        "transactions": txs,
        "summary": summary
    })


@app.route("/api/transactions", methods=["POST"])
def api_create_transaction():
    """
    Create a new transaction enforcing the three distinct transaction types.
    """
    data = request.get_json() or {}
    tx_type = data.get("type", "").strip().lower()
    title = data.get("title", "").strip()
    amount_raw = data.get("amount")
    date_str = data.get("date", "").strip() or datetime.now().strftime("%Y-%m-%d")
    notes = data.get("notes", "").strip()

    # Validation: Type
    if tx_type not in ["income", "expense", "transfer"]:
        return jsonify({"error": "Invalid transaction type. Must be 'income', 'expense', or 'transfer'."}), 400

    # Validation: Amount
    try:
        amount = float(amount_raw)
        if amount <= 0:
            return jsonify({"error": "Amount must be a positive number greater than 0."}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "Please provide a valid numeric amount."}), 400

    # Construct transaction object
    tx = {
        "id": str(uuid.uuid4()),
        "type": tx_type,
        "title": title or ("Account Transfer" if tx_type == "transfer" else "Transaction"),
        "amount": round(amount, 2),
        "date": date_str,
        "notes": notes,
        "created_at": datetime.utcnow().isoformat()
    }

    # Type Specific Validation
    if tx_type in ["income", "expense"]:
        account = data.get("account", "").strip()
        category = data.get("category", "").strip()

        if account not in ["UPI", "Cash"]:
            return jsonify({"error": "Account must be either 'UPI' or 'Cash'."}), 400
        if not category:
            return jsonify({"error": "Category is required for income and expense transactions."}), 400

        tx["account"] = account
        tx["category"] = category
        tx["from_account"] = None
        tx["to_account"] = None

    elif tx_type == "transfer":
        from_acc = data.get("from_account", "").strip()
        to_acc = data.get("to_account", "").strip()

        if from_acc not in ["UPI", "Cash"] or to_acc not in ["UPI", "Cash"]:
            return jsonify({"error": "Both 'from_account' and 'to_account' must be 'UPI' or 'Cash'."}), 400
        if from_acc == to_acc:
            return jsonify({"error": "Source and destination accounts must be different for a transfer."}), 400

        tx["from_account"] = from_acc
        tx["to_account"] = to_acc
        tx["account"] = None
        tx["category"] = "Transfer"
        if not title:
            tx["title"] = f"Transfer from {from_acc} to {to_acc}"

    # Persist and return updated summary
    save_transaction(tx)
    all_txs = get_all_transactions()
    summary = calculate_summary(all_txs)

    return jsonify({
        "success": True,
        "transaction": tx,
        "summary": summary
    }), 201


@app.route("/api/transactions/<tx_id>", methods=["DELETE"])
def api_delete_transaction(tx_id):
    """Delete a transaction by ID and recalculate summary."""
    remove_transaction(tx_id)
    all_txs = get_all_transactions()
    summary = calculate_summary(all_txs)
    return jsonify({
        "success": True,
        "summary": summary
    })


@app.route("/api/demo-data", methods=["POST"])
def api_load_demo_data():
    """
    Populate realistic student finance demo transactions demonstrating
    income, expense, and internal transfers.
    """
    today = datetime.now().strftime("%Y-%m-%d")
    sample_records = [
        {
            "id": str(uuid.uuid4()),
            "type": "income",
            "title": "Monthly Pocket Money from Parents",
            "amount": 5000.0,
            "account": "UPI",
            "category": "Pocket Money",
            "date": today,
            "notes": "Direct bank transfer to UPI",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "type": "transfer",
            "title": "Campus ATM Cash Withdrawal",
            "amount": 1500.0,
            "from_account": "UPI",
            "to_account": "Cash",
            "category": "Transfer",
            "date": today,
            "notes": "Withdrew cash for daily pocket expenses",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "type": "expense",
            "title": "College Textbooks & Reference Guide",
            "amount": 550.0,
            "account": "UPI",
            "category": "College & Academics",
            "date": today,
            "notes": "Semester study material",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "type": "expense",
            "title": "Campus Canteen Lunch & Chai",
            "amount": 120.0,
            "account": "Cash",
            "category": "Food & Canteen",
            "date": today,
            "notes": "Paid in cash at canteen counter",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "type": "expense",
            "title": "Metro Smart Card Monthly Recharge",
            "amount": 400.0,
            "account": "UPI",
            "category": "Transport & Metro",
            "date": today,
            "notes": "Daily college commute",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "type": "expense",
            "title": "Weekend Movie & Snacks with Friends",
            "amount": 300.0,
            "account": "UPI",
            "category": "Entertainment & Hangouts",
            "date": today,
            "notes": "Cinema hall booking",
            "created_at": datetime.utcnow().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "type": "expense",
            "title": "Lab Manual Printout & Assignment Xerox",
            "amount": 40.0,
            "account": "Cash",
            "category": "College & Academics",
            "date": today,
            "notes": "Stationery shop near campus",
            "created_at": datetime.utcnow().isoformat()
        }
    ]

    for rec in sample_records:
        save_transaction(rec)

    all_txs = get_all_transactions()
    summary = calculate_summary(all_txs)
    return jsonify({
        "success": True,
        "message": "Demo student transactions populated successfully!",
        "count": len(sample_records),
        "summary": summary
    })


@app.route("/api/clear", methods=["POST"])
def api_clear_data():
    """Clear all transactions."""
    clear_all_transactions()
    return jsonify({
        "success": True,
        "summary": calculate_summary([])
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"[START] Python PocketTrack server running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
