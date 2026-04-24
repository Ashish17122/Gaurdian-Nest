package app.guardiannest

import android.app.*
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat

import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class UsageService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false

    private var lastApp = ""
    private var lastStartTime = System.currentTimeMillis()

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {

        if (!isRunning) {
            startForegroundService()

            isRunning = true
            lastStartTime = System.currentTimeMillis()
            handler.post(runnable)
        }

        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        handler.removeCallbacks(runnable)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private val runnable = object : Runnable {
        override fun run() {
            try {
                trackUsage()
            } catch (e: Exception) {
                Log.e("UsageService", "Error: ${e.message}")
            }

            if (isRunning) {
                handler.postDelayed(this, 10000)
            }
        }
    }

    private fun startForegroundService() {
        val channelId = "guardian_tracking"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Guardian Tracking",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("GuardianNest Active")
            .setContentText("Monitoring device activity")
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .build()

        startForeground(1, notification)
    }

    private fun getForegroundApp(): String {
        val usageStatsManager =
            getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

        val end = System.currentTimeMillis()
        val start = end - 15000

        val stats = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            start,
            end
        )

        if (stats.isEmpty()) return "unknown"

        val recent = stats.maxByOrNull { it.lastTimeUsed }
        return recent?.packageName ?: "unknown"
    }

    private fun trackUsage() {
        val currentApp = getForegroundApp()
        val now = System.currentTimeMillis()

        if (currentApp != lastApp && lastApp.isNotEmpty()) {
            val duration = ((now - lastStartTime) / 1000).toInt()

            sendUsage(lastApp, duration)

            lastStartTime = now
        }

        lastApp = currentApp
    }

    private fun sendUsage(app: String, duration: Int) {
        val childId = getChildId()

        if (childId.isEmpty()) return

        val json = JSONObject().apply {
            put("app", app)
            put("duration", duration)
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
                Log.e("UsageService", "Network error")
            }

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