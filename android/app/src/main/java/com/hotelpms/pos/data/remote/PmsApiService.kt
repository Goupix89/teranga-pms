package com.hotelpms.pos.data.remote

import com.hotelpms.pos.domain.model.*
import retrofit2.Response
import retrofit2.http.*

interface PmsApiService {

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("api/auth/refresh")
    suspend fun refresh(): Response<RefreshResponse>

    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>

    @GET("api/articles")
    suspend fun getArticles(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 200
    ): Response<ArticlesResponse>

    @POST("api/pos/transactions")
    suspend fun postTransaction(
        @Body request: PosTransactionRequest
    ): Response<PosTransactionResponse>
}
