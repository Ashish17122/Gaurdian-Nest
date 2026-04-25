package app.guardiannest

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.Handler
import android.os.Looper
import android.app.usage.UsageStatsManager
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

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val runnable = object : Runnable {
        override fun run() {
            try {
                sendUsage()
            } catch (e: Exception) {
                Log.e("UsageService", "Loop crash prevented: ${e.message}")
            }
            handler.postDelayed(this, 10000)
        }
    }

    override fun onCreate() {
        super.onCreate()
        startForegroundSafe() // 🔥 safe foreground
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

    // ================= SAFE FOREGROUND =================
    private fun startForegroundSafe() {
        try {
            val channelId = "guardian_channel"

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
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
                .setContentText("Monitoring usage in background")
                .setSmallIcon(android.R.drawable.ic_menu_info_details)
                .build()

            startForeground(1, notification)

        } catch (e: Exception) {
            Log.e("UsageService", "Foreground error: ${e.message}")
        }
    }

    // ================= SAFE APP DETECTION =================
    private fun getForegroundApp(): String {
        return try {
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
            recent?.packageName ?: "unknown"

        } catch (e: Exception) {
            Log.e("UsageService", "Permission crash prevented: ${e.message}")
            "unknown"
        }
    }

    // ================= SAFE NETWORK =================
    private fun sendUsage() {
        try {
            val app = getForegroundApp()
            val childId = getChildId()

            if (childId.isEmpty() || app == "unknown") return

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
                    response.close()
                }
            })

        } catch (e: Exception) {
            Log.e("UsageService", "sendUsage crash prevented: ${e.message}")
        }
    }

    // ================= SAFE STORAGE =================
    private fun getChildId(): String {
        return try {
            val prefs = getSharedPreferences("GN", Context.MODE_PRIVATE)
            prefs.getString("child_id", "") ?: ""
        } catch (e: Exception) {
            ""
        }
    }
}