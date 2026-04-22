package app.guardiannest

import android.content.Intent
import com.facebook.react.bridge.*

class UsageModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "UsageModule"

    @ReactMethod
    fun startService() {
        val intent = Intent(reactApplicationContext, UsageService::class.java)
        reactApplicationContext.startService(intent)
    }
}