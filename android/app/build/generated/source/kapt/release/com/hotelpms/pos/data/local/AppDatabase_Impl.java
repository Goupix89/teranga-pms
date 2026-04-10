package com.hotelpms.pos.data.local;

import androidx.annotation.NonNull;
import androidx.room.DatabaseConfiguration;
import androidx.room.InvalidationTracker;
import androidx.room.RoomDatabase;
import androidx.room.RoomOpenHelper;
import androidx.room.migration.AutoMigrationSpec;
import androidx.room.migration.Migration;
import androidx.room.util.DBUtil;
import androidx.room.util.TableInfo;
import androidx.sqlite.db.SupportSQLiteDatabase;
import androidx.sqlite.db.SupportSQLiteOpenHelper;
import java.lang.Class;
import java.lang.Override;
import java.lang.String;
import java.lang.SuppressWarnings;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.annotation.processing.Generated;

@Generated("androidx.room.RoomProcessor")
@SuppressWarnings({"unchecked", "deprecation"})
public final class AppDatabase_Impl extends AppDatabase {
  private volatile PendingTransactionDao _pendingTransactionDao;

  private volatile CachedArticleDao _cachedArticleDao;

  @Override
  @NonNull
  protected SupportSQLiteOpenHelper createOpenHelper(@NonNull final DatabaseConfiguration config) {
    final SupportSQLiteOpenHelper.Callback _openCallback = new RoomOpenHelper(config, new RoomOpenHelper.Delegate(2) {
      @Override
      public void createAllTables(@NonNull final SupportSQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS `pending_transactions` (`transactionUuid` TEXT NOT NULL, `tenantId` TEXT NOT NULL, `invoiceId` TEXT NOT NULL, `itemsJson` TEXT NOT NULL, `totalAmount` REAL NOT NULL, `timestamp` TEXT NOT NULL, `syncStatus` TEXT NOT NULL, `retryCount` INTEGER NOT NULL, `lastError` TEXT, `createdAt` INTEGER NOT NULL, PRIMARY KEY(`transactionUuid`))");
        db.execSQL("CREATE TABLE IF NOT EXISTS `cached_articles` (`id` TEXT NOT NULL, `name` TEXT NOT NULL, `sku` TEXT, `unitPrice` REAL NOT NULL, `currentStock` INTEGER NOT NULL, `unit` TEXT NOT NULL, `categoryName` TEXT, `description` TEXT, `imageUrl` TEXT, `cachedAt` INTEGER NOT NULL, PRIMARY KEY(`id`))");
        db.execSQL("CREATE TABLE IF NOT EXISTS room_master_table (id INTEGER PRIMARY KEY,identity_hash TEXT)");
        db.execSQL("INSERT OR REPLACE INTO room_master_table (id,identity_hash) VALUES(42, 'd939f870bdec2fc17f51dd51dd0463c5')");
      }

      @Override
      public void dropAllTables(@NonNull final SupportSQLiteDatabase db) {
        db.execSQL("DROP TABLE IF EXISTS `pending_transactions`");
        db.execSQL("DROP TABLE IF EXISTS `cached_articles`");
        final List<? extends RoomDatabase.Callback> _callbacks = mCallbacks;
        if (_callbacks != null) {
          for (RoomDatabase.Callback _callback : _callbacks) {
            _callback.onDestructiveMigration(db);
          }
        }
      }

      @Override
      public void onCreate(@NonNull final SupportSQLiteDatabase db) {
        final List<? extends RoomDatabase.Callback> _callbacks = mCallbacks;
        if (_callbacks != null) {
          for (RoomDatabase.Callback _callback : _callbacks) {
            _callback.onCreate(db);
          }
        }
      }

      @Override
      public void onOpen(@NonNull final SupportSQLiteDatabase db) {
        mDatabase = db;
        internalInitInvalidationTracker(db);
        final List<? extends RoomDatabase.Callback> _callbacks = mCallbacks;
        if (_callbacks != null) {
          for (RoomDatabase.Callback _callback : _callbacks) {
            _callback.onOpen(db);
          }
        }
      }

      @Override
      public void onPreMigrate(@NonNull final SupportSQLiteDatabase db) {
        DBUtil.dropFtsSyncTriggers(db);
      }

      @Override
      public void onPostMigrate(@NonNull final SupportSQLiteDatabase db) {
      }

      @Override
      @NonNull
      public RoomOpenHelper.ValidationResult onValidateSchema(
          @NonNull final SupportSQLiteDatabase db) {
        final HashMap<String, TableInfo.Column> _columnsPendingTransactions = new HashMap<String, TableInfo.Column>(10);
        _columnsPendingTransactions.put("transactionUuid", new TableInfo.Column("transactionUuid", "TEXT", true, 1, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingTransactions.put("tenantId", new TableInfo.Column("tenantId", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingTransactions.put("invoiceId", new TableInfo.Column("invoiceId", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingTransactions.put("itemsJson", new TableInfo.Column("itemsJson", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingTransactions.put("totalAmount", new TableInfo.Column("totalAmount", "REAL", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingTransactions.put("timestamp", new TableInfo.Column("timestamp", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingTransactions.put("syncStatus", new TableInfo.Column("syncStatus", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingTransactions.put("retryCount", new TableInfo.Column("retryCount", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingTransactions.put("lastError", new TableInfo.Column("lastError", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsPendingTransactions.put("createdAt", new TableInfo.Column("createdAt", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        final HashSet<TableInfo.ForeignKey> _foreignKeysPendingTransactions = new HashSet<TableInfo.ForeignKey>(0);
        final HashSet<TableInfo.Index> _indicesPendingTransactions = new HashSet<TableInfo.Index>(0);
        final TableInfo _infoPendingTransactions = new TableInfo("pending_transactions", _columnsPendingTransactions, _foreignKeysPendingTransactions, _indicesPendingTransactions);
        final TableInfo _existingPendingTransactions = TableInfo.read(db, "pending_transactions");
        if (!_infoPendingTransactions.equals(_existingPendingTransactions)) {
          return new RoomOpenHelper.ValidationResult(false, "pending_transactions(com.hotelpms.pos.domain.model.PendingTransaction).\n"
                  + " Expected:\n" + _infoPendingTransactions + "\n"
                  + " Found:\n" + _existingPendingTransactions);
        }
        final HashMap<String, TableInfo.Column> _columnsCachedArticles = new HashMap<String, TableInfo.Column>(10);
        _columnsCachedArticles.put("id", new TableInfo.Column("id", "TEXT", true, 1, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCachedArticles.put("name", new TableInfo.Column("name", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCachedArticles.put("sku", new TableInfo.Column("sku", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCachedArticles.put("unitPrice", new TableInfo.Column("unitPrice", "REAL", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCachedArticles.put("currentStock", new TableInfo.Column("currentStock", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCachedArticles.put("unit", new TableInfo.Column("unit", "TEXT", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCachedArticles.put("categoryName", new TableInfo.Column("categoryName", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCachedArticles.put("description", new TableInfo.Column("description", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCachedArticles.put("imageUrl", new TableInfo.Column("imageUrl", "TEXT", false, 0, null, TableInfo.CREATED_FROM_ENTITY));
        _columnsCachedArticles.put("cachedAt", new TableInfo.Column("cachedAt", "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY));
        final HashSet<TableInfo.ForeignKey> _foreignKeysCachedArticles = new HashSet<TableInfo.ForeignKey>(0);
        final HashSet<TableInfo.Index> _indicesCachedArticles = new HashSet<TableInfo.Index>(0);
        final TableInfo _infoCachedArticles = new TableInfo("cached_articles", _columnsCachedArticles, _foreignKeysCachedArticles, _indicesCachedArticles);
        final TableInfo _existingCachedArticles = TableInfo.read(db, "cached_articles");
        if (!_infoCachedArticles.equals(_existingCachedArticles)) {
          return new RoomOpenHelper.ValidationResult(false, "cached_articles(com.hotelpms.pos.domain.model.CachedArticle).\n"
                  + " Expected:\n" + _infoCachedArticles + "\n"
                  + " Found:\n" + _existingCachedArticles);
        }
        return new RoomOpenHelper.ValidationResult(true, null);
      }
    }, "d939f870bdec2fc17f51dd51dd0463c5", "bd7c127d0f68df9594b4250dc24d63dc");
    final SupportSQLiteOpenHelper.Configuration _sqliteConfig = SupportSQLiteOpenHelper.Configuration.builder(config.context).name(config.name).callback(_openCallback).build();
    final SupportSQLiteOpenHelper _helper = config.sqliteOpenHelperFactory.create(_sqliteConfig);
    return _helper;
  }

  @Override
  @NonNull
  protected InvalidationTracker createInvalidationTracker() {
    final HashMap<String, String> _shadowTablesMap = new HashMap<String, String>(0);
    final HashMap<String, Set<String>> _viewTables = new HashMap<String, Set<String>>(0);
    return new InvalidationTracker(this, _shadowTablesMap, _viewTables, "pending_transactions","cached_articles");
  }

  @Override
  public void clearAllTables() {
    super.assertNotMainThread();
    final SupportSQLiteDatabase _db = super.getOpenHelper().getWritableDatabase();
    try {
      super.beginTransaction();
      _db.execSQL("DELETE FROM `pending_transactions`");
      _db.execSQL("DELETE FROM `cached_articles`");
      super.setTransactionSuccessful();
    } finally {
      super.endTransaction();
      _db.query("PRAGMA wal_checkpoint(FULL)").close();
      if (!_db.inTransaction()) {
        _db.execSQL("VACUUM");
      }
    }
  }

  @Override
  @NonNull
  protected Map<Class<?>, List<Class<?>>> getRequiredTypeConverters() {
    final HashMap<Class<?>, List<Class<?>>> _typeConvertersMap = new HashMap<Class<?>, List<Class<?>>>();
    _typeConvertersMap.put(PendingTransactionDao.class, PendingTransactionDao_Impl.getRequiredConverters());
    _typeConvertersMap.put(CachedArticleDao.class, CachedArticleDao_Impl.getRequiredConverters());
    return _typeConvertersMap;
  }

  @Override
  @NonNull
  public Set<Class<? extends AutoMigrationSpec>> getRequiredAutoMigrationSpecs() {
    final HashSet<Class<? extends AutoMigrationSpec>> _autoMigrationSpecsSet = new HashSet<Class<? extends AutoMigrationSpec>>();
    return _autoMigrationSpecsSet;
  }

  @Override
  @NonNull
  public List<Migration> getAutoMigrations(
      @NonNull final Map<Class<? extends AutoMigrationSpec>, AutoMigrationSpec> autoMigrationSpecs) {
    final List<Migration> _autoMigrations = new ArrayList<Migration>();
    return _autoMigrations;
  }

  @Override
  public PendingTransactionDao pendingTransactionDao() {
    if (_pendingTransactionDao != null) {
      return _pendingTransactionDao;
    } else {
      synchronized(this) {
        if(_pendingTransactionDao == null) {
          _pendingTransactionDao = new PendingTransactionDao_Impl(this);
        }
        return _pendingTransactionDao;
      }
    }
  }

  @Override
  public CachedArticleDao cachedArticleDao() {
    if (_cachedArticleDao != null) {
      return _cachedArticleDao;
    } else {
      synchronized(this) {
        if(_cachedArticleDao == null) {
          _cachedArticleDao = new CachedArticleDao_Impl(this);
        }
        return _cachedArticleDao;
      }
    }
  }
}
