package app.guardiannest

import android.app.Service
import android.content.Intent
import android.location.Location
import android.os.IBinder
import android.os.Looper
import android.util.Log
import com.google.android.gms.location.*
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class LocationService : Service() {

    private lateinit var fusedClient: FusedLocationProviderClient

    override fun onCreate() {
        super.onCreate()
        fusedClient = LocationServices.getFusedLocationProviderClient(this)
        startTracking()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startTracking() {
        val request = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            10000
        ).build()

        fusedClient.requestLocationUpdates(
            request,
            object : LocationCallback() {
                override fun onLocationResult(result: LocationResult) {
                    val loc = result.lastLocation ?: return
                    sendLocation(loc)
                }
            },
            Looper.getMainLooper()
        )
    }

    private fun sendLocation(loc: Location) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL("https://gaurdian-nest.onrender.com/api/location/update")

                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true

                val json = JSONObject()
                json.put("lat", loc.latitude)
                json.put("lng", loc.longitude)

                conn.outputStream.write(json.toString().toByteArray())
                conn.outputStream.close()

                conn.responseCode
            } catch (e: Exception) {
                Log.e("LocationService", e.message ?: "error")
            }
        }
    }
}