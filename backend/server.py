from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from collections import defaultdict
import uuid, os, requests
from notification import check_and_notify_limits
from insights import generate_insights

from google.oauth2 import id_token
from google.auth.transport import requests as grequests

# ================= CONFIG =================
GOOGLE_CLIENT_ID = "786843635437-k0qqfgirae0jvgqfpss59jam2rmj7bs3.apps.googleusercontent.com"

app = FastAPI()
api = APIRouter(prefix="/api")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

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

# ================= GOOGLE LOGIN =================
@api.post("/auth/google")
async def google_login(payload: dict):
    token = payload.get("token")

    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            grequests.Request(),
            GOOGLE_CLIENT_ID
        )
        email = idinfo.get("email")
    except:
        raise HTTPException(401, "Invalid Google token")

    user = await db.users.find_one({"email": email})

    if not user:
        user = {
            "user_id": new_id("usr"),
            "email": email,
            "role": "parent",
            "created_at": utc()
        }
        await db.users.insert_one(user)

    session_token = "tok_" + uuid.uuid4().hex

    await db.sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token
    })

    return {"session_token": session_token}

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

# ================= TRACK (FIXED) =================
@api.post("/activity/log")
async def log_activity(payload: dict):
    pkg = payload["app"]
    duration = payload["duration"]
    child_id = payload["child_id"]

    app_doc = await db.apps.find_one({"package": pkg})

    if not app_doc:
        app_doc = {
            "package": pkg,
            "name": format_app_name(pkg),
            "category": get_category(pkg)
        }
        await db.apps.insert_one(app_doc)

    await db.daily.update_one(
        {
            "child_id": child_id,
            "date": today(),
            "app": pkg
        },
        {"$inc": {"duration": duration}},
        upsert=True
    )

    # 🔔 CHECK LIMIT + SEND PUSH
    updated = await db.daily.find_one({
        "child_id": child_id,
        "date": today(),
        "app": pkg
    })

    await check_and_notify_limits(
        db,
        child_id,
        pkg,
        updated["duration"]
    )

    return {"ok": True}

# ================= SUMMARY =================
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
        app_doc = await db.apps.find_one({"package": pkg})
        result.append({
            "app": app_doc["name"],
            "minutes": round(secs / 60, 1)
        })

    result.sort(key=lambda x: -x["minutes"])
    return result

# ================= AI INSIGHTS =================
@api.get("/ai/insights")
async def ai_insights(request: Request):
    parent = await get_user(request)

    # 🔗 get children
    links = db.links.find({"parent_id": parent["user_id"]})
    child_ids = [l["child_id"] async for l in links]

    if not child_ids:
        return {"message": "No children linked"}

    total = 0
    app_usage = {}

    async for d in db.daily.find({
        "child_id": {"$in": child_ids}
    }):
        app = d["app"]
        duration = d["duration"]

        total += duration
        app_usage[app] = app_usage.get(app, 0) + duration

    if total == 0:
        return {"message": "No data yet"}

    # 🧠 ANALYSIS
    insights = []

    # 🔥 total screen time
    hours = total / 3600
    if hours > 6:
        insights.append("Very high screen time (>6h)")
    elif hours > 3:
        insights.append("Moderate screen time")
    else:
        insights.append("Healthy screen time")

    # 📱 top app
    top_app = max(app_usage, key=app_usage.get)
    top_ratio = app_usage[top_app] / total

    if top_ratio > 0.5:
        insights.append(f"Most time spent on {top_app}")

    # 🎥 video detection
    video_time = sum(
        v for k, v in app_usage.items()
        if "youtube" in k or "netflix" in k
    )

    if video_time / total > 0.4:
        insights.append("High video consumption")

    # 💬 social detection
    social_time = sum(
        v for k, v in app_usage.items()
        if "instagram" in k or "facebook" in k
    )

    if social_time / total > 0.4:
        insights.append("High social media usage")

    # 🎮 gaming detection
    game_time = sum(
        v for k, v in app_usage.items()
        if "game" in k or "pubg" in k or "freefire" in k
    )

    if game_time / total > 0.4:
        insights.append("High gaming activity")

    return {
        "total_hours": round(hours, 2),
        "top_app": top_app,
        "insights": insights
    }

# ================= LIMIT CHECK =================
@api.get("/limits/check")
async def check_limits(request: Request):
    parent = await get_user(request)

    links = db.links.find({"parent_id": parent["user_id"]})
    child_ids = [l["child_id"] async for l in links]

    alerts = []

    async for d in db.daily.find({"child_id": {"$in": child_ids}}):
        limit = await db.limits.find_one({"app": d["app"]})

        if limit and d["duration"] > limit["limit"]:
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

# ================= CORS =================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =================== Location API =============
@api.post("/location/update")
async def update_location(payload: dict, request: Request):
    user = await get_user(request)

    await db.locations.update_one(
        {"child_id": user["user_id"]},
        {
            "$set": {
                "lat": payload["lat"],
                "lng": payload["lng"],
                "updated_at": datetime.utcnow()
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

app.include_router(api)