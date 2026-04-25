from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
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


# ================= REALTIME =================
class Manager:
    def __init__(self):
        self.clients = {}

    async def connect(self, ws: WebSocket, parent_id: str):
        await ws.accept()
        self.clients.setdefault(parent_id, []).append(ws)

    def disconnect(self, ws, parent_id):
        if parent_id in self.clients:
            self.clients[parent_id].remove(ws)

    async def send(self, parent_id, data):
        for ws in self.clients.get(parent_id, []):
            try:
                await ws.send_json(data)
            except:
                pass

manager = Manager()


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
    name = data.get("name")

    user = await db.users.find_one({"email": email})

    if not user:
        user = {
            "_id": new_id(),
            "email": email,
            "role": "parent",
            "is_admin": email == ADMIN_EMAIL,
            "name": name
        }
        await db.users.insert_one(user)
    else:
        if name:
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"name": name}})

    token = "tok_" + new_id()

    await db.sessions.insert_one({
        "user_id": user["_id"],
        "token": token
    })

    return {"session_token": token, "user": user}


# ================= CHILD =================
@app.post("/api/children/create")
async def create_child(data: dict = {}):
    code = uuid.uuid4().hex[:6].upper()

    child = {
        "_id": new_id(),
        "role": "child",
        "name": data.get("name", "Child"),
        "child_public_id": code,
        "linked": False,
        "last_seen": now()
    }

    await db.users.insert_one(child)

    return {
        "child_id": child["_id"],
        "child_public_id": code,
        "name": child["name"]
    }


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


@app.get("/api/children/list")
async def list_children(req: Request):
    parent = await get_user(req)

    links = db.links.find({"parent_id": parent["_id"]})
    result = []

    async for l in links:
        child = await db.users.find_one({"_id": l["child_id"]})
        if child:
            online = (now() - child.get("last_seen", now())).seconds < 20

            result.append({
                "child_id": child["_id"],
                "name": child.get("name"),
                "code": child.get("child_public_id"),
                "online": online
            })

    return result


# ================= LIMITS =================
@app.post("/api/limits/set")
async def set_limit(data: dict):
    await db.limits.update_one(
        {"child_id": data["child_id"], "app": data["app"]},
        {"$set": {"limit": data["limit"]}},
        upsert=True
    )
    return {"ok": True}


@app.get("/api/limits/get")
async def get_limits(child_id: str):
    result = []
    async for l in db.limits.find({"child_id": child_id}):
        result.append({
            "app": l["app"],
            "limit": l["limit"]
        })
    return result


# ================= ACTIVITY =================
@app.post("/api/activity/log")
async def log(data: dict):
    child_id = data["child_id"]

    await db.activity.insert_one({
        "child_id": child_id,
        "app": data["app"],
        "duration": data["duration"],
        "date": today(),
        "hour": now().hour
    })

    await db.users.update_one(
        {"_id": child_id},
        {"$set": {"last_seen": now()}}
    )

    # 🔥 LIMIT CHECK
    limit_doc = await db.limits.find_one({
        "child_id": child_id,
        "app": data["app"]
    })

    if limit_doc:
        total = 0
        async for d in db.activity.find({
            "child_id": child_id,
            "app": data["app"],
            "date": today()
        }):
            total += d["duration"]

        if total >= limit_doc["limit"] * 60:
            link = await db.links.find_one({"child_id": child_id})
            if link:
                await manager.send(link["parent_id"], {
                    "type": "limit",
                    "app": data["app"]
                })

    # 🔥 REALTIME ACTIVITY
    link = await db.links.find_one({"child_id": child_id})
    if link:
        await manager.send(link["parent_id"], {"type": "activity"})

    return {"ok": True}


# ================= ANALYTICS =================
@app.get("/api/activity/daily")
async def daily(req: Request, child_id: str):
    stats = defaultdict(int)

    async for d in db.activity.find({
        "child_id": child_id,
        "date": today()
    }):
        stats[d["app"]] += d["duration"]

    apps = [{"app": k, "minutes": v // 60} for k, v in stats.items()]

    return {"apps": apps}


# ================= SOCKET =================
@app.websocket("/ws/{parent_id}")
async def ws(websocket: WebSocket, parent_id: str):
    await manager.connect(websocket, parent_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, parent_id)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)