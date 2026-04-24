package app.guardiannest

import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Intent
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import android.app.ActivityManager
import android.content.Context
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class UsageService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private val client = OkHttpClient()

    private val runnable = object : Runnable {
        override fun run() {
            sendUsage()
            handler.postDelayed(this, 10000) // every 10s
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        handler.post(runnable)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(runnable)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun getForegroundApp(): String {
        val usageStatsManager =
            getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

        val end = System.currentTimeMillis()
        val start = end - 10000

        val stats = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            start,
            end
        )

        if (stats.isEmpty()) return "unknown"

        val recent = stats.maxByOrNull { it.lastTimeUsed }
        return recent?.packageName ?: "unknown"
    }

    private fun sendUsage() {
        val app = getForegroundApp()

        val json = JSONObject()
        json.put("app", app)
        json.put("duration", 10)
        json.put("child_id", getChildId())

        val body = RequestBody.create(
            MediaType.parse("application/json"),
            json.toString()
        )

        val request = Request.Builder()
            .url("https://gaurdian-nest.onrender.com/api/activity/log")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}

            override fun onResponse(call: Call, response: Response) {
                response.close()
            }
        })
    }

    private fun getChildId(): String {
        val prefs = getSharedPreferences("GN", Context.MODE_PRIVATE)
        return prefs.getString("child_id", "") ?: ""
    }
}