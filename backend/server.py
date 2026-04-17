"""
GuardianNest - Parental Control App Backend
============================================
Single-app architecture serving Parent, Child, and hidden Admin modes.

Key sections in this file:
  1. Config & feature flags               (line ~30)
  2. MongoDB models & collections         (line ~80)
  3. Authentication (Emergent Google)     (line ~180)
  4. Parent PIN lock                      (line ~280)
  5. Child / Activity logging             (line ~320)
  6. Monitoring heartbeat & alerts        (line ~400)
  7. Admin analytics & leads              (line ~450)
  8. Razorpay payments (DISABLED by flag) (line ~560)
  9. Seed demo data                       (line ~680)
"""

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import hmac
import hashlib
import logging
import random
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# =============================================================
# 1. CONFIG & FEATURE FLAGS
# =============================================================
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

# >>> OWNER CONFIG: subscription / premium toggle <<<
# This single flag gates all Razorpay payment endpoints + premium features.
# Flip it at runtime from the hidden Admin Panel OR edit backend/.env.
def premium_enabled() -> bool:
    # Re-read on every call so admin toggles take effect without restart
    return os.environ.get("PREMIUM_ENABLED", "false").lower() == "true"

def set_premium_enabled(value: bool) -> None:
    os.environ["PREMIUM_ENABLED"] = "true" if value else "false"

# >>> OWNER CONFIG: Razorpay keys (paste in backend/.env) <<<
def razorpay_keys() -> Dict[str, str]:
    return {
        "key_id": os.environ.get("RAZORPAY_KEY_ID", ""),
        "key_secret": os.environ.get("RAZORPAY_KEY_SECRET", ""),
        "webhook_secret": os.environ.get("RAZORPAY_WEBHOOK_SECRET", ""),
    }

ADMIN_ACCESS_CODE = os.environ.get("ADMIN_ACCESS_CODE", "999000")
ADMIN_EMAILS = [
    e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="GuardianNest API")
api_router = APIRouter(prefix="/api")

# =============================================================
# 2. MODELS
# =============================================================
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "parent"  # parent | child | admin
    is_admin: bool = False
    created_at: datetime
    last_login_at: Optional[datetime] = None
    parent_pin_hash: Optional[str] = None  # for parent-mode lock

class ActivityLog(BaseModel):
    log_id: str
    child_id: str
    parent_id: str
    app_name: str  # YouTube | Instagram | Chrome | Other
    duration_seconds: int
    started_at: datetime

class ChildDevice(BaseModel):
    child_id: str
    parent_id: str
    device_name: str
    pairing_code: str
    monitoring_active: bool = True
    last_heartbeat_at: Optional[datetime] = None
    push_token: Optional[str] = None
    created_at: datetime

class LeadEntry(BaseModel):
    lead_id: str
    email: str
    name: str
    source: str  # google_signup | role_select | signup_dropoff
    role_selected: Optional[str] = None
    completed_onboarding: bool = False
    created_at: datetime

class RazorpayOrder(BaseModel):
    order_id: str
    user_id: str
    amount: int  # paise
    currency: str = "INR"
    plan: str  # monthly | yearly
    status: str = "created"
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    created_at: datetime

# =============================================================
# Helpers
# =============================================================
def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

async def get_user_from_token(token: Optional[str]) -> Optional[User]:
    if not token:
        return None
    session = await db.sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < utcnow():
        return None
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        return None
    return User(**user_doc)

async def current_user(request: Request) -> User:
    # Prefer cookie, fall back to Authorization header (mobile)
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    user = await get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_admin(request: Request) -> User:
    user = await current_user(request)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return user

def hash_pin(pin: str) -> str:
    return hashlib.sha256(f"guardiannest::{pin}".encode()).hexdigest()

# =============================================================
# 3. AUTH (Emergent Google OAuth)
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR
# REDIRECT URLS, THIS BREAKS THE AUTH
# =============================================================
class SessionExchangeReq(BaseModel):
    session_id: str
    role: Optional[str] = "parent"  # selected on role-select screen

@api_router.post("/auth/session")
async def exchange_session(payload: SessionExchangeReq, response: Response):
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()
    email = data["email"].lower()

    # Upsert user
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc:
        user_id = new_id("usr")
        is_admin = email in ADMIN_EMAILS
        role = payload.role if payload.role in ("parent", "child") else "parent"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email),
            "picture": data.get("picture"),
            "role": role,
            "is_admin": is_admin,
            "created_at": utcnow(),
            "last_login_at": utcnow(),
        }
        await db.users.insert_one(user_doc.copy())
        # Track lead
        await db.leads.insert_one({
            "lead_id": new_id("lead"),
            "email": email,
            "name": user_doc["name"],
            "source": "google_signup",
            "role_selected": role,
            "completed_onboarding": False,
            "created_at": utcnow(),
        })
    else:
        await db.users.update_one({"email": email}, {"$set": {"last_login_at": utcnow()}})

    session_token = data["session_token"]
    await db.sessions.insert_one({
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": utcnow() + timedelta(days=7),
        "created_at": utcnow(),
    })

    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none",
        path="/", max_age=7 * 24 * 3600,
    )
    user_doc.pop("_id", None)
    return {"user": user_doc, "session_token": session_token}

@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await current_user(request)
    return user.dict()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token") or \
            (request.headers.get("Authorization", "").replace("Bearer ", "") or None)
    if token:
        await db.sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# Dev-only: mock login for demo/testing when Google OAuth isn't available
class MockLoginReq(BaseModel):
    email: str
    name: str
    role: str = "parent"
    admin_code: Optional[str] = None

@api_router.post("/auth/mock-login")
async def mock_login(payload: MockLoginReq, response: Response):
    """Demo login for portfolio / testing. Issues a real session."""
    email = payload.email.lower()
    is_admin = payload.admin_code == ADMIN_ACCESS_CODE or email in ADMIN_EMAILS
    role = "admin" if is_admin else (payload.role if payload.role in ("parent", "child") else "parent")

    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc:
        user_doc = {
            "user_id": new_id("usr"),
            "email": email,
            "name": payload.name or email.split("@")[0].title(),
            "picture": None,
            "role": role,
            "is_admin": is_admin,
            "created_at": utcnow(),
            "last_login_at": utcnow(),
        }
        await db.users.insert_one(user_doc.copy())
        await db.leads.insert_one({
            "lead_id": new_id("lead"),
            "email": email,
            "name": user_doc["name"],
            "source": "mock_signup",
            "role_selected": role,
            "completed_onboarding": False,
            "created_at": utcnow(),
        })
    else:
        updates = {"last_login_at": utcnow()}
        if is_admin and not user_doc.get("is_admin"):
            updates["is_admin"] = True
            updates["role"] = "admin"
        await db.users.update_one({"email": email}, {"$set": updates})
        user_doc.update(updates)

    token = "tok_" + uuid.uuid4().hex
    await db.sessions.insert_one({
        "user_id": user_doc["user_id"],
        "session_token": token,
        "expires_at": utcnow() + timedelta(days=7),
        "created_at": utcnow(),
    })
    response.set_cookie("session_token", token, httponly=True, secure=True,
                        samesite="none", path="/", max_age=7 * 24 * 3600)
    user_doc.pop("_id", None)
    return {"user": user_doc, "session_token": token}

# =============================================================
# 4. PARENT PIN LOCK (so Child can't switch to Parent mode)
# =============================================================
class PinReq(BaseModel):
    pin: str

@api_router.post("/parent/set-pin")
async def set_parent_pin(payload: PinReq, request: Request):
    user = await current_user(request)
    if len(payload.pin) < 4:
        raise HTTPException(status_code=400, detail="PIN must be at least 4 digits")
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"parent_pin_hash": hash_pin(payload.pin)}},
    )
    return {"ok": True}

@api_router.post("/parent/verify-pin")
async def verify_parent_pin(payload: PinReq, request: Request):
    user = await current_user(request)
    if not user.parent_pin_hash:
        raise HTTPException(status_code=400, detail="No PIN set. Set a PIN first from Settings.")
    if hash_pin(payload.pin) != user.parent_pin_hash:
        raise HTTPException(status_code=401, detail="Incorrect PIN")
    return {"ok": True}

@api_router.get("/parent/has-pin")
async def parent_has_pin(request: Request):
    user = await current_user(request)
    return {"has_pin": bool(user.parent_pin_hash)}

# =============================================================
# 5. CHILD DEVICE PAIRING + ACTIVITY LOGGING
# =============================================================
class PairChildReq(BaseModel):
    device_name: str

@api_router.post("/children/pair")
async def pair_child(payload: PairChildReq, request: Request):
    user = await current_user(request)
    pairing_code = str(random.randint(100000, 999999))
    child = {
        "child_id": new_id("chd"),
        "parent_id": user.user_id,
        "device_name": payload.device_name,
        "pairing_code": pairing_code,
        "monitoring_active": True,
        "last_heartbeat_at": utcnow(),
        "push_token": None,
        "created_at": utcnow(),
    }
    await db.children.insert_one(child.copy())
    child.pop("_id", None)
    return child

@api_router.get("/children")
async def list_children(request: Request):
    user = await current_user(request)
    cursor = db.children.find({"parent_id": user.user_id}, {"_id": 0})
    return await cursor.to_list(200)

class ActivityLogReq(BaseModel):
    child_id: str
    app_name: str
    duration_seconds: int

@api_router.post("/activity/log")
async def log_activity(payload: ActivityLogReq, request: Request):
    user = await current_user(request)
    child = await db.children.find_one({"child_id": payload.child_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    doc = {
        "log_id": new_id("act"),
        "child_id": payload.child_id,
        "parent_id": child["parent_id"],
        "app_name": payload.app_name,
        "duration_seconds": payload.duration_seconds,
        "started_at": utcnow(),
    }
    await db.activity.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api_router.get("/activity/summary/{child_id}")
async def activity_summary(child_id: str, request: Request, days: int = 7):
    user = await current_user(request)
    child = await db.children.find_one({"child_id": child_id, "parent_id": user.user_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    since = utcnow() - timedelta(days=days)
    pipeline = [
        {"$match": {"child_id": child_id, "started_at": {"$gte": since}}},
        {"$group": {"_id": "$app_name", "total": {"$sum": "$duration_seconds"}}},
    ]
    per_app = {r["_id"]: r["total"] for r in await db.activity.aggregate(pipeline).to_list(100)}

    # Daily breakdown (last 7 days) per app for charts
    daily = []
    for i in range(days - 1, -1, -1):
        day_start = (utcnow() - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        p2 = [
            {"$match": {"child_id": child_id, "started_at": {"$gte": day_start, "$lt": day_end}}},
            {"$group": {"_id": "$app_name", "total": {"$sum": "$duration_seconds"}}},
        ]
        rows = {r["_id"]: r["total"] for r in await db.activity.aggregate(p2).to_list(100)}
        daily.append({
            "date": day_start.strftime("%a"),
            "YouTube": rows.get("YouTube", 0) // 60,
            "Instagram": rows.get("Instagram", 0) // 60,
            "Chrome": rows.get("Chrome", 0) // 60,
        })

    total_seconds = sum(per_app.values())
    return {
        "child_id": child_id,
        "device_name": child["device_name"],
        "monitoring_active": child.get("monitoring_active", True),
        "total_minutes": total_seconds // 60,
        "per_app_minutes": {k: v // 60 for k, v in per_app.items()},
        "daily": daily,
    }

# =============================================================
# 6. MONITORING HEARTBEAT & ALERTS
# =============================================================
class HeartbeatReq(BaseModel):
    child_id: str
    monitoring_active: bool = True
    push_token: Optional[str] = None

@api_router.post("/monitoring/heartbeat")
async def heartbeat(payload: HeartbeatReq):
    child = await db.children.find_one({"child_id": payload.child_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    update = {
        "last_heartbeat_at": utcnow(),
        "monitoring_active": payload.monitoring_active,
    }
    if payload.push_token:
        update["push_token"] = payload.push_token
    await db.children.update_one({"child_id": payload.child_id}, {"$set": update})
    # If monitoring was disabled, create an alert for the parent
    if not payload.monitoring_active:
        await db.alerts.insert_one({
            "alert_id": new_id("alrt"),
            "parent_id": child["parent_id"],
            "child_id": payload.child_id,
            "type": "MONITORING_DISABLED",
            "message": f"Monitoring has been disabled on {child['device_name']}!",
            "created_at": utcnow(),
            "read": False,
        })
    return {"ok": True}

@api_router.get("/alerts")
async def list_alerts(request: Request):
    user = await current_user(request)
    cursor = db.alerts.find({"parent_id": user.user_id}, {"_id": 0}).sort("created_at", -1).limit(50)
    return await cursor.to_list(50)

# =============================================================
# 7. ADMIN ANALYTICS & LEADS (HIDDEN PANEL)
# =============================================================
@api_router.get("/admin/stats")
async def admin_stats(request: Request, days: int = 30):
    await require_admin(request)
    since = utcnow() - timedelta(days=days)

    total_users = await db.users.count_documents({})
    new_users = await db.users.count_documents({"created_at": {"$gte": since}})
    active_users = await db.users.count_documents({"last_login_at": {"$gte": utcnow() - timedelta(days=7)}})
    total_leads = await db.leads.count_documents({})
    converted = await db.leads.count_documents({"completed_onboarding": True})
    dropped = total_leads - converted

    # Daily signup trend
    trend = []
    for i in range(days - 1, -1, -1):
        d0 = (utcnow() - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        d1 = d0 + timedelta(days=1)
        cnt = await db.users.count_documents({"created_at": {"$gte": d0, "$lt": d1}})
        trend.append({"date": d0.strftime("%d/%m"), "signups": cnt})

    by_role = {}
    async for u in db.users.find({}, {"_id": 0, "role": 1}):
        by_role[u.get("role", "parent")] = by_role.get(u.get("role", "parent"), 0) + 1

    return {
        "total_users": total_users,
        "new_users_in_window": new_users,
        "active_users_7d": active_users,
        "total_leads": total_leads,
        "converted_leads": converted,
        "dropped_leads": dropped,
        "conversion_rate": round((converted / total_leads * 100) if total_leads else 0, 1),
        "signup_trend": trend,
        "by_role": by_role,
        "premium_enabled": premium_enabled(),
    }

@api_router.get("/admin/leads")
async def admin_leads(
    request: Request,
    q: Optional[str] = None,
    source: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    await require_admin(request)
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [
            {"email": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
        ]
    if source:
        query["source"] = source
    if from_date or to_date:
        dr: Dict[str, Any] = {}
        if from_date:
            dr["$gte"] = datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc)
        if to_date:
            dr["$lte"] = datetime.fromisoformat(to_date).replace(tzinfo=timezone.utc)
        query["created_at"] = dr

    total = await db.leads.count_documents(query)
    cursor = db.leads.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    rows = await cursor.to_list(limit)
    return {"total": total, "rows": rows}

class PremiumToggleReq(BaseModel):
    enabled: bool

@api_router.post("/admin/premium/toggle")
async def admin_toggle_premium(payload: PremiumToggleReq, request: Request):
    """
    >>> OWNER / ADMIN ONLY <<<
    Flip the PREMIUM_ENABLED feature flag at runtime. When false, all
    Razorpay endpoints return 503 Service Unavailable. This is how the
    owner activates the premium tier without a code change.
    """
    await require_admin(request)
    set_premium_enabled(payload.enabled)
    # Persist flag intent in DB so future restarts can read it
    await db.config.update_one(
        {"key": "PREMIUM_ENABLED"},
        {"$set": {"key": "PREMIUM_ENABLED", "value": payload.enabled, "updated_at": utcnow()}},
        upsert=True,
    )
    return {"premium_enabled": premium_enabled()}

@api_router.get("/admin/premium/config")
async def admin_premium_config(request: Request):
    await require_admin(request)
    keys = razorpay_keys()
    return {
        "premium_enabled": premium_enabled(),
        "razorpay_linked": bool(keys["key_id"] and keys["key_secret"]),
        "razorpay_key_id_preview": (keys["key_id"][:6] + "…") if keys["key_id"] else "",
        "webhook_configured": bool(keys["webhook_secret"]),
    }

# =============================================================
# 8. RAZORPAY PAYMENTS  --- SCAFFOLDED, DISABLED BY DEFAULT ---
# =============================================================
#   !!!  OWNER INSTRUCTIONS  !!!
#   1. Get keys at https://dashboard.razorpay.com/app/keys
#   2. Paste RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in backend/.env
#   3. Open the hidden Admin Panel -> "Premium Config" -> flip the toggle
#   The endpoints below will start working once PREMIUM_ENABLED=true.
# =============================================================

def _razorpay_guard():
    if not premium_enabled():
        raise HTTPException(
            status_code=503,
            detail="Premium tier is disabled. Enable it from the Admin Panel -> Premium Config.",
        )
    keys = razorpay_keys()
    if not keys["key_id"] or not keys["key_secret"]:
        raise HTTPException(
            status_code=503,
            detail="Razorpay keys not configured. Paste them in backend/.env and restart.",
        )
    return keys

class CreateOrderReq(BaseModel):
    plan: str  # monthly | yearly

PLAN_PRICES_INR_PAISE = {"monthly": 19900, "yearly": 199900}

@api_router.post("/payments/create-order")
async def create_order(payload: CreateOrderReq, request: Request):
    user = await current_user(request)
    keys = _razorpay_guard()
    if payload.plan not in PLAN_PRICES_INR_PAISE:
        raise HTTPException(status_code=400, detail="Invalid plan")
    amount = PLAN_PRICES_INR_PAISE[payload.plan]

    import razorpay
    rz = razorpay.Client(auth=(keys["key_id"], keys["key_secret"]))
    rz_order = rz.order.create({
        "amount": amount, "currency": "INR",
        "notes": {"user_id": user.user_id, "plan": payload.plan},
    })
    doc = {
        "order_id": new_id("ord"),
        "user_id": user.user_id,
        "amount": amount,
        "currency": "INR",
        "plan": payload.plan,
        "status": "created",
        "razorpay_order_id": rz_order["id"],
        "razorpay_payment_id": None,
        "created_at": utcnow(),
    }
    await db.orders.insert_one(doc.copy())
    doc.pop("_id", None)
    return {"order": doc, "key_id": keys["key_id"]}

class VerifyPaymentReq(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

@api_router.post("/payments/verify")
async def verify_payment(payload: VerifyPaymentReq, request: Request):
    user = await current_user(request)
    keys = _razorpay_guard()
    body = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode()
    expected = hmac.new(keys["key_secret"].encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid signature")
    await db.orders.update_one(
        {"razorpay_order_id": payload.razorpay_order_id, "user_id": user.user_id},
        {"$set": {"status": "paid", "razorpay_payment_id": payload.razorpay_payment_id}},
    )
    # Grant premium
    expires = utcnow() + timedelta(days=365 if "yearly" in payload.razorpay_order_id else 30)
    await db.subscriptions.update_one(
        {"user_id": user.user_id},
        {"$set": {"user_id": user.user_id, "tier": "premium", "expires_at": expires,
                  "updated_at": utcnow()}},
        upsert=True,
    )
    return {"ok": True}

@api_router.post("/payments/webhook")
async def razorpay_webhook(request: Request):
    keys = _razorpay_guard()
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    expected = hmac.new(keys["webhook_secret"].encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    # Persist raw event for audit
    await db.razorpay_events.insert_one({"body": body.decode(), "received_at": utcnow()})
    return {"ok": True}

@api_router.get("/subscription/status")
async def subscription_status(request: Request):
    user = await current_user(request)
    sub = await db.subscriptions.find_one({"user_id": user.user_id}, {"_id": 0})
    tier = "free"
    if sub and sub.get("expires_at"):
        exp = sub["expires_at"]
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp > utcnow():
            tier = sub.get("tier", "premium")
    return {"tier": tier, "premium_enabled_globally": premium_enabled()}

# =============================================================
# 9. SEED DEMO DATA (idempotent)
# =============================================================
DEMO_APPS = ["YouTube", "Instagram", "Chrome"]

@api_router.post("/dev/seed")
async def seed_demo(request: Request):
    """Seeds realistic demo data for portfolio display."""
    # Create/ensure demo parent
    parent_email = "demo.parent@guardiannest.app"
    parent = await db.users.find_one({"email": parent_email}, {"_id": 0})
    if not parent:
        parent = {
            "user_id": new_id("usr"),
            "email": parent_email,
            "name": "Demo Parent",
            "picture": None,
            "role": "parent",
            "is_admin": False,
            "created_at": utcnow() - timedelta(days=20),
            "last_login_at": utcnow(),
        }
        await db.users.insert_one(parent.copy())

    # Ensure a child device
    child = await db.children.find_one({"parent_id": parent["user_id"]}, {"_id": 0})
    if not child:
        child = {
            "child_id": new_id("chd"),
            "parent_id": parent["user_id"],
            "device_name": "Aarav's Phone",
            "pairing_code": "482193",
            "monitoring_active": True,
            "last_heartbeat_at": utcnow(),
            "push_token": None,
            "created_at": utcnow() - timedelta(days=18),
        }
        await db.children.insert_one(child.copy())

    # Clear + seed 7 days of activity
    await db.activity.delete_many({"child_id": child["child_id"]})
    logs = []
    for day_offset in range(7):
        day = utcnow() - timedelta(days=day_offset)
        # realistic daily minutes:  YT 60-180, IG 30-120, Chrome 20-90
        for app, (lo, hi) in zip(DEMO_APPS, [(60, 180), (30, 120), (20, 90)]):
            minutes = random.randint(lo, hi)
            logs.append({
                "log_id": new_id("act"),
                "child_id": child["child_id"],
                "parent_id": parent["user_id"],
                "app_name": app,
                "duration_seconds": minutes * 60,
                "started_at": day.replace(hour=random.randint(8, 21), minute=random.randint(0, 59)),
            })
    if logs:
        await db.activity.insert_many(logs)

    # Seed leads with varied sources/dates
    await db.leads.delete_many({"source": "demo_seed"})
    sources = ["google_signup", "role_select", "signup_dropoff", "mock_signup"]
    leads = []
    for i in range(48):
        d = utcnow() - timedelta(days=random.randint(0, 29),
                                  hours=random.randint(0, 23))
        role = random.choice(["parent", "child"])
        src = random.choice(sources)
        leads.append({
            "lead_id": new_id("lead"),
            "email": f"user{i}@example.com",
            "name": f"User {i}",
            "source": "demo_seed",  # tag so we can clear next seed
            "_real_source": src,
            "role_selected": role,
            "completed_onboarding": random.random() > 0.35,
            "created_at": d,
        })
    # Overwrite source field to _real_source so it looks real in admin
    for l in leads:
        l["source"] = l.pop("_real_source")
        l["_seed_tag"] = "demo_seed"
    if leads:
        await db.leads.insert_many(leads)

    return {"ok": True, "activity_seeded": len(logs), "leads_seeded": len(leads)}

# =============================================================
# Health / root
# =============================================================
@api_router.get("/")
async def root():
    return {"service": "GuardianNest API", "premium_enabled": premium_enabled()}

@api_router.get("/config/public")
async def public_config():
    return {
        "premium_enabled": premium_enabled(),
        "app_name": "GuardianNest",
    }

# Startup: load persisted premium flag from db
@app.on_event("startup")
async def startup_event():
    cfg = await db.config.find_one({"key": "PREMIUM_ENABLED"}, {"_id": 0})
    if cfg and isinstance(cfg.get("value"), bool):
        set_premium_enabled(cfg["value"])
    logger.info("GuardianNest API started. Premium enabled: %s", premium_enabled())

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
