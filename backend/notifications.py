import requests
from motor.motor_asyncio import AsyncIOMotorDatabase


# 🔔 Send Expo push notification
async def send_push(db: AsyncIOMotorDatabase, user_id: str, title: str, body: str):
    token_doc = await db.tokens.find_one({"user_id": user_id})

    if not token_doc:
        return

    try:
        requests.post(
            "https://exp.host/--/api/v2/push/send",
            json={
                "to": token_doc["token"],
                "title": title,
                "body": body,
                "sound": "default",
            },
        )
    except Exception as e:
        print("Push error:", e)


# 🚨 Check limits + send alerts
async def check_and_notify_limits(db: AsyncIOMotorDatabase, child_id: str, app: str, duration: int):
    limit = await db.limits.find_one({
        "child_id": child_id,
        "app": app
    })

    if not limit:
        return

    if duration >= limit["limit"]:
        # find parent
        link = await db.links.find_one({"child_id": child_id})
        if not link:
            return

        parent_id = link["parent_id"]

        await send_push(
            db,
            parent_id,
            "Limit Exceeded 🚨",
            f"{app} usage exceeded limit"
        )