package com.guardiannest

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.*
import android.app.usage.*
import androidx.core.app.NotificationCompat
import java.net.HttpURLConnection
import java.net.URL

class UsageService : Service() {

    private lateinit var usageStatsManager: UsageStatsManager
    private val handler = Handler(Looper.getMainLooper())

    private var lastApp: String? = null
    private var startTime: Long = System.currentTimeMillis()

    override fun onCreate() {
        super.onCreate()

        usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

        startForeground(1, createNotification())
        handler.post(runnable)
    }

    private val runnable = object : Runnable {
        override fun run() {
            val end = System.currentTimeMillis()
            val start = end - 2000

            val events = usageStatsManager.queryEvents(start, end)
            val event = UsageEvents.Event()

            var currentApp: String? = null

            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    currentApp = event.packageName
                }
            }

            if (currentApp != null && currentApp != lastApp) {

                if (lastApp != null) {
                    val duration = (System.currentTimeMillis() - startTime) / 1000
                    sendToServer(lastApp!!, duration.toInt())

                    // 🔔 Local alert if >10 min
                    if (duration > 600) {
                        sendAlert(lastApp!!)
                    }
                }

                lastApp = currentApp
                startTime = System.currentTimeMillis()
            }

            handler.postDelayed(this, 2000)
        }
    }

    private fun sendToServer(pkg: String, duration: Int) {
        Thread {
            try {
                val url = URL("https://gaurdian-nest.onrender.com/api/activity/log")
                val conn = url.openConnection() as HttpURLConnection

                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true

                val json = """{"app":"$pkg","duration":$duration}"""
                conn.outputStream.write(json.toByteArray())

                conn.outputStream.flush()
                conn.outputStream.close()

                conn.responseCode
            } catch (_: Exception) {}
        }.start()
    }

    private fun sendAlert(app: String) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "alerts"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Alerts", NotificationManager.IMPORTANCE_HIGH)
            manager.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Usage Alert")
            .setContentText("$app exceeded usage limit")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .build()

        manager.notify(2, notification)
    }

    private fun createNotification(): Notification {
        val channelId = "tracking_channel"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Tracking", NotificationManager.IMPORTANCE_LOW)
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }

        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("GuardianNest Running")
            .setContentText("Tracking app usage")
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .build()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        val restartIntent = Intent(applicationContext, UsageService::class.java)
        startForegroundService(restartIntent)
        super.onTaskRemoved(rootIntent)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}