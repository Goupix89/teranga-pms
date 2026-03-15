package com.hotelpms.pos.data.remote

import com.hotelpms.pos.data.local.TokenManager
import okhttp3.Interceptor
import okhttp3.Response

/**
 * OkHttp interceptor that automatically adds the Bearer token
 * and X-Tenant-ID header to all API requests.
 */
class AuthInterceptor(private val tokenManager: TokenManager) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        val requestBuilder = originalRequest.newBuilder()

        // Inject access token
        tokenManager.accessToken?.let { token ->
            requestBuilder.header("Authorization", "Bearer $token")
        }

        // Inject tenant ID
        tokenManager.tenantId?.let { tenantId ->
            requestBuilder.header("X-Tenant-ID", tenantId)
        }

        requestBuilder.header("Content-Type", "application/json")

        return chain.proceed(requestBuilder.build())
    }
}
