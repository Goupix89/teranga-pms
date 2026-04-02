package com.hotelpms.pos.data.local

import android.content.Context
import androidx.room.*
import com.hotelpms.pos.domain.model.CachedArticle
import com.hotelpms.pos.domain.model.PendingTransaction
import kotlinx.coroutines.flow.Flow

// =============================================================================
// DAOs
// =============================================================================

@Dao
interface PendingTransactionDao {

    @Query("SELECT * FROM pending_transactions WHERE syncStatus = :status ORDER BY createdAt ASC")
    suspend fun getByStatus(status: String): List<PendingTransaction>

    @Query("SELECT * FROM pending_transactions ORDER BY createdAt DESC")
    fun getAllFlow(): Flow<List<PendingTransaction>>

    @Query("SELECT COUNT(*) FROM pending_transactions WHERE syncStatus = 'PENDING'")
    fun getPendingCountFlow(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(transaction: PendingTransaction)

    @Query("UPDATE pending_transactions SET syncStatus = :status WHERE transactionUuid = :uuid")
    suspend fun updateStatus(uuid: String, status: String)

    @Query("""
        UPDATE pending_transactions 
        SET syncStatus = 'PENDING', retryCount = retryCount + 1, lastError = :error 
        WHERE transactionUuid = :uuid
    """)
    suspend fun incrementRetry(uuid: String, error: String)

    @Query("DELETE FROM pending_transactions WHERE syncStatus = 'SYNCED' AND createdAt < :before")
    suspend fun cleanSynced(before: Long)
}

@Dao
interface CachedArticleDao {

    @Query("SELECT * FROM cached_articles ORDER BY name ASC")
    fun getAllFlow(): Flow<List<CachedArticle>>

    @Query("SELECT * FROM cached_articles ORDER BY name ASC")
    suspend fun getAll(): List<CachedArticle>

    @Query("SELECT * FROM cached_articles WHERE id = :id")
    suspend fun getById(id: String): CachedArticle?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(articles: List<CachedArticle>)

    @Query("DELETE FROM cached_articles")
    suspend fun clearAll()

    @Query("SELECT * FROM cached_articles WHERE name LIKE '%' || :query || '%' OR sku LIKE '%' || :query || '%' ORDER BY name ASC")
    fun searchFlow(query: String): Flow<List<CachedArticle>>
}

// =============================================================================
// Database
// =============================================================================

@Database(
    entities = [PendingTransaction::class, CachedArticle::class],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun pendingTransactionDao(): PendingTransactionDao
    abstract fun cachedArticleDao(): CachedArticleDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "hotel_pms_pos.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
