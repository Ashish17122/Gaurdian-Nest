package app.guardiannest

import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Intent
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import android.content.Context
import android.util.Log

import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class UsageService : Service() {

    private val handler = Handler(Looper.getMainLooper())

    private var isRunning = false // 🔥 prevents duplicate loops

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val runnable = object : Runnable {
        override fun run() {
            try {
                sendUsage()
            } catch (e: Exception) {
                Log.e("UsageService", "Loop error: ${e.message}")
            }

            if (isRunning) {
                handler.postDelayed(this, 10000) // every 10s
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {

        if (!isRunning) {
            Log.d("UsageService", "Service started")
            isRunning = true
            handler.post(runnable)
        } else {
            Log.d("UsageService", "Service already running")
        }

        return START_STICKY
    }

    override fun onDestroy() {
        Log.d("UsageService", "Service destroyed")
        isRunning = false
        handler.removeCallbacks(runnable)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // 🔥 IMPROVED foreground app detection
    private fun getForegroundApp(): String {
        val usageStatsManager =
            getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

        val end = System.currentTimeMillis()
        val start = end - 15000 // slightly larger window (more stable)

        val stats = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            start,
            end
        )

        if (stats.isEmpty()) return "unknown"

        val recent = stats.maxByOrNull { it.lastTimeUsed }
        return recent?.packageName ?: "unknown"
    }

    // 🚀 SEND DATA TO BACKEND
    private fun sendUsage() {
        val app = getForegroundApp()
        val childId = getChildId()

        if (childId.isEmpty()) {
            Log.e("UsageService", "No child_id found, skipping")
            return
        }

        if (app == "unknown") {
            Log.d("UsageService", "Unknown app, skipping")
            return
        }

        val json = JSONObject().apply {
            put("app", app)
            put("duration", 10)
            put("child_id", childId)
        }

        val body = json.toString()
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("https://gaurdian-nest.onrender.com/api/activity/log")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {

            override fun onFailure(call: Call, e: IOException) {
                Log.e("UsageService", "Network error: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    Log.d("UsageService", "Usage sent: $app")
                } else {
                    Log.e("UsageService", "Server error: ${response.code}")
                }
                response.close()
            }
        })
    }

    // 🔐 GET CHILD ID FROM STORAGE
    private fun getChildId(): String {
        val prefs = getSharedPreferences("GN", Context.MODE_PRIVATE)
        return prefs.getString("child_id", "") ?: ""
    }
}