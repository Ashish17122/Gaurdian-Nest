package app.guardiannest

import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.*

class UsageModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UsageModule"

    // 🔥 SAVE CHILD ID (CRITICAL)
    @ReactMethod
    fun setChildId(childId: String) {
        val prefs = reactContext.getSharedPreferences("GN", Context.MODE_PRIVATE)
        prefs.edit().putString("child_id", childId).apply()
    }

    // 🚀 START USAGE TRACKING SERVICE
    @ReactMethod
    fun startService() {
        val intent = Intent(reactContext, UsageService::class.java)
        reactContext.startService(intent)
    }

    // 📍 START LOCATION SERVICE (keep your feature)
    @ReactMethod
    fun startLocation() {
        val intent = Intent(reactContext, LocationService::class.java)
        reactContext.startService(intent)
    }
}