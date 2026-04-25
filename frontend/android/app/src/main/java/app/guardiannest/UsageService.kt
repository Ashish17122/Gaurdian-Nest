package app.guardiannest

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.Handler
import android.os.HandlerThread
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

    private lateinit var handler: Handler
    private lateinit var thread: HandlerThread

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    override fun onCreate() {
        super.onCreate()

        thread = HandlerThread("UsageThread")
        thread.start()
        handler = Handler(thread.looper)

        startForegroundSafe()

        Log.d("UsageService", "SERVICE CREATED")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d("UsageService", "SERVICE STARTED")

        handler.post(loop)

        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        thread.quitSafely()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // 🔁 MAIN LOOP
    private val loop = object : Runnable {
        override fun run() {
            try {
                sendUsage()
                sendHeartbeat()
            } catch (e: Exception) {
                Log.e("UsageService", "Loop error: ${e.message}")
            }

            handler.postDelayed(this, 10000)
        }
    }

    // 🔥 FOREGROUND
    private fun startForegroundSafe() {
        val channelId = "guardian_channel"

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Guardian Tracking",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("GuardianNest Running")
            .setContentText("Tracking device activity")
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .build()

        startForeground(1, notification)
    }

    // 📱 APP DETECTION
    private fun getForegroundApp(): String {
        return try {
            val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

            val end = System.currentTimeMillis()
            val start = end - 15000

            val stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                start,
                end
            )

            val recent = stats.maxByOrNull { it.lastTimeUsed }
            recent?.packageName ?: "unknown"

        } catch (e: Exception) {
            Log.e("UsageService", "Usage error: ${e.message}")
            "unknown"
        }
    }

    // 📊 SEND USAGE
    private fun sendUsage() {
        val app = getForegroundApp()
        val childId = getChildId()

        Log.d("UsageService", "APP: $app")

        if (childId.isEmpty() || app == "unknown") return

        val json = JSONObject().apply {
            put("app", app)
            put("duration", 10)
            put("child_id", childId)
        }

        val req = Request.Builder()
            .url("https://gaurdian-nest.onrender.com/api/activity/log")
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(req).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("UsageService", "Usage fail: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                Log.d("UsageService", "Usage sent")
                response.close()
            }
        })
    }

    // 🟢 HEARTBEAT (ONLINE STATUS)
    private fun sendHeartbeat() {
        val childId = getChildId()
        if (childId.isEmpty()) return

        val json = JSONObject().apply {
            put("child_id", childId)
        }

        val req = Request.Builder()
            .url("https://gaurdian-nest.onrender.com/api/child/heartbeat")
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(req).enqueue(object : Callback {
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