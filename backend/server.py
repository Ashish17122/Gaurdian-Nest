from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from collections import defaultdict
import uuid, os, requests

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

def send_push(token, title, body):
    try:
        requests.post(
            "https://exp.host/--/api/v2/push/send",
            json={
                "to": token,
                "title": title,
                "body": body,
            },
        )
    except Exception as e:
        print("Push error:", e)

# ================= AUTH =================
async def get_user(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    session = await db.sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(401, "Unauthorized")
    return await db.users.find_one({"user_id": session["user_id"]})

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

@api.get("/auth/me")
async def me(request: Request):
    return await get_user(request)

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

# ================= TRACK =================
@api.post("/activity/log")
async def log_activity(payload: dict, request: Request):
    user = await get_user(request)

    pkg = payload["app"]
    duration = payload["duration"]

    # auto register app
    app_doc = await db.apps.find_one({"package": pkg})
    if not app_doc:
        app_doc = {
            "package": pkg,
            "name": format_app_name(pkg),
            "category": get_category(pkg)
        }
        await db.apps.insert_one(app_doc)

    # raw log
    await db.activity.insert_one({
        "child_id": user["user_id"],
        "app": pkg,
        "duration": duration,
        "timestamp": utc()
    })

    # daily aggregation
    await db.daily.update_one(
        {
            "child_id": user["user_id"],
            "date": today(),
            "app": pkg
        },
        {
            "$inc": {"duration": duration}
        },
        upsert=True
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
            "category": app_doc["category"],
            "minutes": round(secs / 60, 1)
        })

    result.sort(key=lambda x: -x["minutes"])
    return result

# ================= LIMITS =================
@api.post("/limits/set")
async def set_limit(payload: dict, request: Request):
    user = await get_user(request)

    await db.limits.update_one(
        {"user_id": user["user_id"], "app": payload["app"]},
        {"$set": {"limit": payload["limit"]}},
        upsert=True
    )

    return {"ok": True}

@api.get("/limits/check")
async def check_limits(request: Request):
    user = await get_user(request)

    limits = db.limits.find({"user_id": user["user_id"]})
    activity = await daily_summary(request)

    alerts = []

    async for l in limits:
        for a in activity:
            if a["app"] == l["app"] and a["minutes"] > l["limit"]:

                alert = {
                    "app": a["app"],
                    "used": a["minutes"],
                    "limit": l["limit"]
                }

                alerts.append(alert)

                token_doc = await db.tokens.find_one({"user_id": user["user_id"]})
                if token_doc:
                    send_push(
                        token_doc["token"],
                        "Limit Exceeded",
                        f"{a['app']} used {a['minutes']} min"
                    )

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

app.include_router(api)