from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from collections import defaultdict
import uuid, os

app = FastAPI()

client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
db = client["guardian"]

ADMIN_EMAIL = "ashishworksat@gmail.com"

def now():
    return datetime.utcnow()

def today():
    return now().date().isoformat()

def new_id():
    return uuid.uuid4().hex

# ================= AUTH =================
async def get_user(req: Request):
    token = req.headers.get("Authorization", "").replace("Bearer ", "")
    session = await db.sessions.find_one({"token": token})
    if not session:
        raise HTTPException(401, "Unauthorized")
    return await db.users.find_one({"_id": session["user_id"]})

# ================= LOGIN =================
@app.post("/api/auth/google")
async def login(data: dict):
    email = data.get("email") or "fallback@user.dev"

    user = await db.users.find_one({"email": email})

    if not user:
        user = {
            "_id": new_id(),
            "email": email,
            "role": "parent",
            "is_admin": email == ADMIN_EMAIL,
        }
        await db.users.insert_one(user)

    token = "tok_" + new_id()

    await db.sessions.insert_one({
        "user_id": user["_id"],
        "token": token
    })

    return {"session_token": token, "user": user}

# ================= CHILD CREATE =================
@app.post("/api/children/create")
async def create_child():
    code = uuid.uuid4().hex[:6].upper()

    child = {
        "_id": new_id(),
        "role": "child",
        "child_public_id": code,
        "linked": False
    }

    await db.users.insert_one(child)

    return {"child_id": child["_id"], "child_public_id": code}

# ================= LINK =================
@app.post("/api/children/link")
async def link_child(data: dict, req: Request):
    parent = await get_user(req)

    child = await db.users.find_one({
        "child_public_id": data["child_public_id"]
    })

    if not child:
        raise HTTPException(404, "Invalid code")

    existing = await db.links.find_one({"child_id": child["_id"]})
    if existing:
        raise HTTPException(400, "Already linked")

    await db.links.insert_one({
        "parent_id": parent["_id"],
        "child_id": child["_id"]
    })

    await db.users.update_one(
        {"_id": child["_id"]},
        {"$set": {"linked": True}}
    )

    return {"ok": True}

# ================= LIST CHILDREN =================
@app.get("/api/children/list")
async def list_children(req: Request):
    parent = await get_user(req)

    links = db.links.find({"parent_id": parent["_id"]})
    result = []

    async for l in links:
        child = await db.users.find_one({"_id": l["child_id"]})
        if child:
            result.append({
                "child_id": child["_id"],
                "code": child.get("child_public_id")
            })

    return result

# ================= ACTIVITY =================
@app.post("/api/activity/log")
async def log(data: dict):
    await db.activity.insert_one({
        "child_id": data["child_id"],
        "app": data["app"],
        "duration": data["duration"],
        "hour": now().hour,
        "date": today()
    })
    return {"ok": True}

# ================= ANALYTICS =================
@app.get("/api/activity/daily")
async def daily(req: Request, child_id: str = None):
    user = await get_user(req)

    links = db.links.find({"parent_id": user["_id"]})
    child_ids = [l["child_id"] async for l in links]

    if child_id:
        child_ids = [child_id]

    stats = defaultdict(int)

    async for d in db.activity.find({
        "child_id": {"$in": child_ids},
        "date": today()
    }):
        stats[d["app"]] += d["duration"]

    return [{"app": k, "minutes": v // 60} for k, v in stats.items()]

# ================= LOCATION =================
@app.post("/api/location/update")
async def loc(data: dict, req: Request):
    user = await get_user(req)

    await db.location.update_one(
        {"child_id": user["_id"]},
        {"$set": data},
        upsert=True
    )

    return {"ok": True}

@app.get("/api/location/latest")
async def loc_get(req: Request, child_id: str = None):
    user = await get_user(req)

    if not child_id:
        link = await db.links.find_one({"parent_id": user["_id"]})
        if not link:
            return {}
        child_id = link["child_id"]

    return await db.location.find_one({"child_id": child_id}) or {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)