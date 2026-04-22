package app.guardiannest

import android.content.Intent
import com.facebook.react.bridge.*

class UsageModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UsageModule"

    @ReactMethod
    fun startLocation() {
        val intent = Intent(reactApplicationContext, LocationService::class.java)
        reactApplicationContext.startService(intent)
    }
}