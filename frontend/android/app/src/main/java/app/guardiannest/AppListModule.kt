package app.guardiannest

import android.content.pm.PackageManager
import android.graphics.drawable.BitmapDrawable
import android.util.Base64
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream

class AppListModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppListModule"

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val packages = pm.getInstalledApplications(0)

            val list = Arguments.createArray()

            for (pkg in packages) {
                // skip system apps if needed
                if ((pkg.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0) continue

                val appName = pm.getApplicationLabel(pkg).toString()
                val packageName = pkg.packageName

                val iconDrawable = pm.getApplicationIcon(pkg)
                val bitmap = (iconDrawable as BitmapDrawable).bitmap

                val stream = ByteArrayOutputStream()
                bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, stream)
                val byteArray = stream.toByteArray()
                val base64Icon = Base64.encodeToString(byteArray, Base64.DEFAULT)

                val map = Arguments.createMap()
                map.putString("name", appName)
                map.putString("package", packageName)
                map.putString("icon", base64Icon)

                list.pushMap(map)
            }

            promise.resolve(list)

        } catch (e: Exception) {
            promise.reject("APP_LIST_ERROR", e)
        }
    }
}