package app.guardiannest

import android.content.Intent
import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.bridge.*

class UsageModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UsageModule"

    private val prefs: SharedPreferences =
        reactContext.getSharedPreferences("GN", Context.MODE_PRIVATE)

    @ReactMethod
    fun setChildId(childId: String) {
        prefs.edit().putString("child_id", childId).apply()
    }

    @ReactMethod
    fun startService() {
        val intent = Intent(reactContext, UsageService::class.java)
        reactContext.startService(intent)
    }

    @ReactMethod
    fun startLocation() {
        val intent = Intent(reactContext, LocationService::class.java)
        reactContext.startService(intent)
    }
}