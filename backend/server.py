from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from collections import defaultdict
import uuid, os, traceback

from google.oauth2 import id_token
from google.auth.transport import requests as grequests

# ================= SAFE IMPORTS =================
try:
    from notifications import check_and_notify_limits
except:
    async def check_and_notify_limits(*args, **kwargs):
        print("⚠️ notification module missing")

try:
    from insights import generate_insights
except:
    async def generate_insights(*args, **kwargs):
        return {}

# ================= CONFIG =================
GOOGLE_CLIENT_ID = os.getenv(
    "GOOGLE_CLIENT_ID",
    "786843635437-k0qqfgirae0jvgqfpss59jam2rmj7bs3.apps.googleusercontent.com"
)

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME")

if not MONGO_URL or not DB_NAME:
    raise Exception("❌ Missing MONGO_URL or DB_NAME")

# ================= APP =================
app = FastAPI()
api = APIRouter(prefix="/api")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ================= UTIL =================
def utc():
    return datetime.utcnow()

def today():
    return utc().date().isoformat()

def new_id(p):
    return f"{p}_{uuid.uuid4().hex[:8]}"

def format_app_name(pkg: str):
    try:
        return pkg.split(".")[-2].capitalize()
    except:
        return pkg

def get_category(pkg: str):
    if "youtube" in pkg: return "Video"
    if "instagram" in pkg or "facebook" in pkg: return "Social"
    if "whatsapp" in pkg: return "Messaging"
    if "chrome" in pkg: return "Browsing"
    return "Other"

# ================= AUTH =================
async def get_user(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    session = await db.sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(401, "Unauthorized")
    return await db.users.find_one({"user_id": session["user_id"]})

# ================= HEALTH =================
@app.get("/")
def health():
    return {"status": "ok"}

# ================= GOOGLE LOGIN =================
@api.post("/auth/google")
async def google_login(payload: dict):
    try:
        token = payload.get("token")

        if not token:
            raise HTTPException(400, "Missing token")

        idinfo = id_token.verify_oauth2_token(
            token,
            grequests.Request(),
            GOOGLE_CLIENT_ID
        )

        email = idinfo.get("email")
        name = idinfo.get("name")

        if not email:
            raise HTTPException(400, "No email")

        user = await db.users.find_one({"email": email})

        if not user:
            user = {
                "user_id": new_id("usr"),
                "email": email,
                "name": name,
                "role": "parent",
                "created_at": utc()
            }
            await db.users.insert_one(user)

        # 🔐 ADMIN LOGIC (SECURE)
        is_admin = email == "ashishworksat@gmail.com"

        await db.users.update_one(
            {"user_id": user["user_id"]},
            {
                "$set": {
                    "is_admin": is_admin,
                    "role": "admin" if is_admin else "parent"
                }
            }
        )

        # refresh user
        user = await db.users.find_one({"user_id": user["user_id"]})

        session_token = "tok_" + uuid.uuid4().hex

        await db.sessions.insert_one({
            "user_id": user["user_id"],
            "session_token": session_token
        })

        # ✅ FIX: return user ALSO
        return {
            "user": {
                "email": user["email"],
                "role": user.get("role", "parent"),
                "is_admin": user.get("is_admin", False)
            },
            "session_token": session_token
        }

    except Exception as e:
        print("❌ GOOGLE ERROR:", str(e))
        traceback.print_exc()
        raise HTTPException(401, "Invalid Google token")

# ================= MOCK LOGIN =================
@api.post("/auth/mock-login")
async def login(payload: dict):
    email = payload["email"]
    role = payload.get("role", "parent")

    user = await db.users.find_one({"email": email})

    if not user:
        user = {
            "user_id": new_id("usr"),
            "email": email,
            "role": role,
            "child_public_id": new_id("CHILD") if role == "child" else None,
            "created_at": utc()
        }
        await db.users.insert_one(user)

    token = "tok_" + uuid.uuid4().hex

    await db.sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": token
    })

    return {"user": user, "session_token": token}

# ================= LINK =================
@api.post("/children/link")
async def link(payload: dict, request: Request):
    parent = await get_user(request)

    child = await db.users.find_one({
        "child_public_id": payload["child_public_id"]
    })

    if not child:
        raise HTTPException(404, "Child not found")

    await db.links.insert_one({
        "parent_id": parent["user_id"],
        "child_id": child["user_id"]
    })

    return {"ok": True}

# ================= ACTIVITY =================
@api.post("/activity/log")
async def log_activity(payload: dict):
    try:
        pkg = payload["app"]
        duration = payload["duration"]
        child_id = payload["child_id"]

        await db.daily.update_one(
            {"child_id": child_id, "date": today(), "app": pkg},
            {"$inc": {"duration": duration}},
            upsert=True
        )

        updated = await db.daily.find_one({
            "child_id": child_id,
            "date": today(),
            "app": pkg
        })

        await check_and_notify_limits(db, child_id, pkg, updated["duration"])

        return {"ok": True}

    except Exception as e:
        print("❌ ACTIVITY ERROR:", str(e))
        traceback.print_exc()
        raise HTTPException(500, "Activity failed")

# ================= DAILY =================
@api.get("/activity/daily")
async def daily_summary(request: Request):
    parent = await get_user(request)

    links = db.links.find({"parent_id": parent["user_id"]})
    child_ids = [l["child_id"] async for l in links]

    stats = defaultdict(int)

    async for d in db.daily.find({
        "child_id": {"$in": child_ids},
        "date": today()
    }):
        stats[d["app"]] += d["duration"]

    result = []
    for pkg, secs in stats.items():
        result.append({
            "app": format_app_name(pkg),
            "minutes": round(secs / 60, 1)
        })

    result.sort(key=lambda x: -x["minutes"])
    return result

# ================= AI =================
@api.get("/ai/insights")
async def ai_insights(request: Request):
    try:
        parent = await get_user(request)

        links = db.links.find({"parent_id": parent["user_id"]})
        child_ids = [l["child_id"] async for l in links]

        return await generate_insights(db, child_ids)

    except Exception as e:
        print("❌ AI ERROR:", str(e))
        return {"message": "AI failed"}

# ================= LIMIT =================
@api.get("/limits/check")
async def check_limits(request: Request):
    parent = await get_user(request)

    links = db.links.find({"parent_id": parent["user_id"]})
    child_ids = [l["child_id"] async for l in links]

    alerts = []

    async for d in db.daily.find({"child_id": {"$in": child_ids}}):
        if d["duration"] > 3600:
            alerts.append({"app": d["app"]})

    return alerts

# ================= PUSH =================
@api.post("/notifications/register")
async def register_token(payload: dict, request: Request):
    user = await get_user(request)

    await db.tokens.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"token": payload["token"]}},
        upsert=True
    )

    return {"ok": True}

# ================= LOCATION =================
@api.post("/location/update")
async def update_location(payload: dict, request: Request):
    user = await get_user(request)

    await db.locations.update_one(
        {"child_id": user["user_id"]},
        {
            "$set": {
                "lat": payload["lat"],
                "lng": payload["lng"],
                "updated_at": utc()
            }
        },
        upsert=True
    )

    return {"ok": True}

@api.get("/location/latest")
async def get_location(request: Request):
    parent = await get_user(request)

    link = await db.links.find_one({"parent_id": parent["user_id"]})
    if not link:
        return {}

    loc = await db.locations.find_one({"child_id": link["child_id"]})
    return loc or {}

# ================= CORS =================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api)