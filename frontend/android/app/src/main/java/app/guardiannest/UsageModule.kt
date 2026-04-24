package app.guardiannest

import android.content.Intent
import android.content.Context
import com.facebook.react.bridge.*

class UsageModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UsageModule"

    @ReactMethod
    fun startService() {
        val intent = Intent(reactContext, UsageService::class.java)
        reactContext.startForegroundService(intent)
    }

    @ReactMethod
    fun setChildId(id: String) {
        val prefs = reactContext.getSharedPreferences("GN", Context.MODE_PRIVATE)
        prefs.edit().putString("child_id", id).apply()
    }

    @ReactMethod
    fun startLocation() {
        val intent = Intent(reactContext, LocationService::class.java)
        reactContext.startService(intent)
    }
}