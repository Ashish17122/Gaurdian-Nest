package app.guardiannest

import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class UsageService : Service() {

    private var lastApp: String = ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {

        CoroutineScope(Dispatchers.IO).launch {
            while (true) {
                try {
                    val app = getForegroundApp()

                    if (app != null && app != lastApp) {
                        sendToBackend(app)
                        lastApp = app
                    }

                    delay(5000)
                } catch (e: Exception) {
                    Log.e("UsageService", "Error: ${e.message}")
                }
            }
        }

        return START_STICKY
    }

    private fun getForegroundApp(): String? {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val time = System.currentTimeMillis()

        val stats = usm.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            time - 10000,
            time
        )

        if (stats.isNullOrEmpty()) return null

        val recent = stats.maxByOrNull { it.lastTimeUsed }
        return recent?.packageName
    }

    private fun sendToBackend(pkg: String) {
        try {
            val url = URL("https://gaurdian-nest.onrender.com/api/activity/log")
            val conn = url.openConnection() as HttpURLConnection

            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true

            val json = JSONObject()
            json.put("app", pkg)
            json.put("duration", 5)

            conn.outputStream.write(json.toString().toByteArray())
            conn.outputStream.flush()
            conn.outputStream.close()

            conn.responseCode
        } catch (e: Exception) {
            Log.e("UsageService", "Send error: ${e.message}")
        }
    }
}