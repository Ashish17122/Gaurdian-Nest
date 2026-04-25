package app.guardiannest

import android.content.Intent
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*

class UsageModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UsageModule"

    private val prefs: SharedPreferences =
        reactContext.getSharedPreferences("GN", Context.MODE_PRIVATE)

    // ================= SET CHILD ID =================
    @ReactMethod
    fun setChildId(childId: String, promise: Promise) {
        try {
            prefs.edit().putString("child_id", childId).apply()
            promise.resolve("OK")
        } catch (e: Exception) {
            Log.e("UsageModule", "setChildId error: ${e.message}")
            promise.reject("SET_ID_ERROR", e)
        }
    }

    // ================= START SERVICE =================
    @ReactMethod
    fun startService(promise: Promise) {
        try {
            val intent = Intent(reactContext, UsageService::class.java)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }

            promise.resolve("STARTED")

        } catch (e: Exception) {
            Log.e("UsageModule", "startService error: ${e.message}")
            promise.reject("SERVICE_ERROR", e)
        }
    }
}