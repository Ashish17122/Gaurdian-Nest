package app.guardiannest

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import app.guardiannest.BuildConfig

class MainApplication : Application(), ReactApplication {

  private val mReactNativeHost: ReactNativeHost =
    object : DefaultReactNativeHost(this) {

      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

      override fun getPackages(): List<ReactPackage> {
        return PackageList(this).packages
      }

      override fun getJSMainModuleName(): String = "index"

      // ✅ HARD FIX (no crash, no missing fields)
      override val isNewArchEnabled: Boolean = false
      override val isHermesEnabled: Boolean = true
    }

  override fun getReactNativeHost(): ReactNativeHost = mReactNativeHost

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, false)


  }
}