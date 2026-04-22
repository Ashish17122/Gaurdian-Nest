from collections import defaultdict
from motor.motor_asyncio import AsyncIOMotorDatabase


async def generate_insights(db: AsyncIOMotorDatabase, child_ids: list):
    stats = defaultdict(int)

    async for d in db.daily.find({
        "child_id": {"$in": child_ids}
    }):
        stats[d["app"]] += d["duration"]

    if not stats:
        return {"message": "No data yet"}

    total = sum(stats.values())

    top_app = max(stats, key=stats.get)
    top_usage = stats[top_app]

    insights = []

    # 🔥 Heavy usage detection
    if total > 3 * 60 * 60:
        insights.append("High screen time detected")

    # 🎥 Video addiction detection
    if "youtube" in top_app.lower():
        insights.append("High video consumption")

    # 💬 Social overuse
    if "instagram" in top_app.lower() or "facebook" in top_app.lower():
        insights.append("Excessive social media usage")

    return {
        "top_app": top_app,
        "total_hours": round(total / 3600, 1),
        "insights": insights if insights else ["Healthy usage pattern"]
    }