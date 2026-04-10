package com.hotelpms.pos.data.local;

import android.database.Cursor;
import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.room.CoroutinesRoom;
import androidx.room.EntityInsertionAdapter;
import androidx.room.RoomDatabase;
import androidx.room.RoomSQLiteQuery;
import androidx.room.SharedSQLiteStatement;
import androidx.room.util.CursorUtil;
import androidx.room.util.DBUtil;
import androidx.sqlite.db.SupportSQLiteStatement;
import com.hotelpms.pos.domain.model.CachedArticle;
import java.lang.Class;
import java.lang.Exception;
import java.lang.Object;
import java.lang.Override;
import java.lang.String;
import java.lang.SuppressWarnings;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import javax.annotation.processing.Generated;
import kotlin.Unit;
import kotlin.coroutines.Continuation;
import kotlinx.coroutines.flow.Flow;

@Generated("androidx.room.RoomProcessor")
@SuppressWarnings({"unchecked", "deprecation"})
public final class CachedArticleDao_Impl implements CachedArticleDao {
  private final RoomDatabase __db;

  private final EntityInsertionAdapter<CachedArticle> __insertionAdapterOfCachedArticle;

  private final SharedSQLiteStatement __preparedStmtOfClearAll;

  public CachedArticleDao_Impl(@NonNull final RoomDatabase __db) {
    this.__db = __db;
    this.__insertionAdapterOfCachedArticle = new EntityInsertionAdapter<CachedArticle>(__db) {
      @Override
      @NonNull
      protected String createQuery() {
        return "INSERT OR REPLACE INTO `cached_articles` (`id`,`name`,`sku`,`unitPrice`,`currentStock`,`unit`,`categoryName`,`description`,`imageUrl`,`cachedAt`) VALUES (?,?,?,?,?,?,?,?,?,?)";
      }

      @Override
      protected void bind(@NonNull final SupportSQLiteStatement statement,
          @NonNull final CachedArticle entity) {
        if (entity.getId() == null) {
          statement.bindNull(1);
        } else {
          statement.bindString(1, entity.getId());
        }
        if (entity.getName() == null) {
          statement.bindNull(2);
        } else {
          statement.bindString(2, entity.getName());
        }
        if (entity.getSku() == null) {
          statement.bindNull(3);
        } else {
          statement.bindString(3, entity.getSku());
        }
        statement.bindDouble(4, entity.getUnitPrice());
        statement.bindLong(5, entity.getCurrentStock());
        if (entity.getUnit() == null) {
          statement.bindNull(6);
        } else {
          statement.bindString(6, entity.getUnit());
        }
        if (entity.getCategoryName() == null) {
          statement.bindNull(7);
        } else {
          statement.bindString(7, entity.getCategoryName());
        }
        if (entity.getDescription() == null) {
          statement.bindNull(8);
        } else {
          statement.bindString(8, entity.getDescription());
        }
        if (entity.getImageUrl() == null) {
          statement.bindNull(9);
        } else {
          statement.bindString(9, entity.getImageUrl());
        }
        statement.bindLong(10, entity.getCachedAt());
      }
    };
    this.__preparedStmtOfClearAll = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "DELETE FROM cached_articles";
        return _query;
      }
    };
  }

  @Override
  public Object insertAll(final List<CachedArticle> articles,
      final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __insertionAdapterOfCachedArticle.insert(articles);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object clearAll(final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfClearAll.acquire();
        try {
          __db.beginTransaction();
          try {
            _stmt.executeUpdateDelete();
            __db.setTransactionSuccessful();
            return Unit.INSTANCE;
          } finally {
            __db.endTransaction();
          }
        } finally {
          __preparedStmtOfClearAll.release(_stmt);
        }
      }
    }, $completion);
  }

  @Override
  public Flow<List<CachedArticle>> getAllFlow() {
    final String _sql = "SELECT * FROM cached_articles ORDER BY name ASC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    return CoroutinesRoom.createFlow(__db, false, new String[] {"cached_articles"}, new Callable<List<CachedArticle>>() {
      @Override
      @NonNull
      public List<CachedArticle> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfName = CursorUtil.getColumnIndexOrThrow(_cursor, "name");
          final int _cursorIndexOfSku = CursorUtil.getColumnIndexOrThrow(_cursor, "sku");
          final int _cursorIndexOfUnitPrice = CursorUtil.getColumnIndexOrThrow(_cursor, "unitPrice");
          final int _cursorIndexOfCurrentStock = CursorUtil.getColumnIndexOrThrow(_cursor, "currentStock");
          final int _cursorIndexOfUnit = CursorUtil.getColumnIndexOrThrow(_cursor, "unit");
          final int _cursorIndexOfCategoryName = CursorUtil.getColumnIndexOrThrow(_cursor, "categoryName");
          final int _cursorIndexOfDescription = CursorUtil.getColumnIndexOrThrow(_cursor, "description");
          final int _cursorIndexOfImageUrl = CursorUtil.getColumnIndexOrThrow(_cursor, "imageUrl");
          final int _cursorIndexOfCachedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "cachedAt");
          final List<CachedArticle> _result = new ArrayList<CachedArticle>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final CachedArticle _item;
            final String _tmpId;
            if (_cursor.isNull(_cursorIndexOfId)) {
              _tmpId = null;
            } else {
              _tmpId = _cursor.getString(_cursorIndexOfId);
            }
            final String _tmpName;
            if (_cursor.isNull(_cursorIndexOfName)) {
              _tmpName = null;
            } else {
              _tmpName = _cursor.getString(_cursorIndexOfName);
            }
            final String _tmpSku;
            if (_cursor.isNull(_cursorIndexOfSku)) {
              _tmpSku = null;
            } else {
              _tmpSku = _cursor.getString(_cursorIndexOfSku);
            }
            final double _tmpUnitPrice;
            _tmpUnitPrice = _cursor.getDouble(_cursorIndexOfUnitPrice);
            final int _tmpCurrentStock;
            _tmpCurrentStock = _cursor.getInt(_cursorIndexOfCurrentStock);
            final String _tmpUnit;
            if (_cursor.isNull(_cursorIndexOfUnit)) {
              _tmpUnit = null;
            } else {
              _tmpUnit = _cursor.getString(_cursorIndexOfUnit);
            }
            final String _tmpCategoryName;
            if (_cursor.isNull(_cursorIndexOfCategoryName)) {
              _tmpCategoryName = null;
            } else {
              _tmpCategoryName = _cursor.getString(_cursorIndexOfCategoryName);
            }
            final String _tmpDescription;
            if (_cursor.isNull(_cursorIndexOfDescription)) {
              _tmpDescription = null;
            } else {
              _tmpDescription = _cursor.getString(_cursorIndexOfDescription);
            }
            final String _tmpImageUrl;
            if (_cursor.isNull(_cursorIndexOfImageUrl)) {
              _tmpImageUrl = null;
            } else {
              _tmpImageUrl = _cursor.getString(_cursorIndexOfImageUrl);
            }
            final long _tmpCachedAt;
            _tmpCachedAt = _cursor.getLong(_cursorIndexOfCachedAt);
            _item = new CachedArticle(_tmpId,_tmpName,_tmpSku,_tmpUnitPrice,_tmpCurrentStock,_tmpUnit,_tmpCategoryName,_tmpDescription,_tmpImageUrl,_tmpCachedAt);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
        }
      }

      @Override
      protected void finalize() {
        _statement.release();
      }
    });
  }

  @Override
  public Object getAll(final Continuation<? super List<CachedArticle>> $completion) {
    final String _sql = "SELECT * FROM cached_articles ORDER BY name ASC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<List<CachedArticle>>() {
      @Override
      @NonNull
      public List<CachedArticle> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfName = CursorUtil.getColumnIndexOrThrow(_cursor, "name");
          final int _cursorIndexOfSku = CursorUtil.getColumnIndexOrThrow(_cursor, "sku");
          final int _cursorIndexOfUnitPrice = CursorUtil.getColumnIndexOrThrow(_cursor, "unitPrice");
          final int _cursorIndexOfCurrentStock = CursorUtil.getColumnIndexOrThrow(_cursor, "currentStock");
          final int _cursorIndexOfUnit = CursorUtil.getColumnIndexOrThrow(_cursor, "unit");
          final int _cursorIndexOfCategoryName = CursorUtil.getColumnIndexOrThrow(_cursor, "categoryName");
          final int _cursorIndexOfDescription = CursorUtil.getColumnIndexOrThrow(_cursor, "description");
          final int _cursorIndexOfImageUrl = CursorUtil.getColumnIndexOrThrow(_cursor, "imageUrl");
          final int _cursorIndexOfCachedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "cachedAt");
          final List<CachedArticle> _result = new ArrayList<CachedArticle>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final CachedArticle _item;
            final String _tmpId;
            if (_cursor.isNull(_cursorIndexOfId)) {
              _tmpId = null;
            } else {
              _tmpId = _cursor.getString(_cursorIndexOfId);
            }
            final String _tmpName;
            if (_cursor.isNull(_cursorIndexOfName)) {
              _tmpName = null;
            } else {
              _tmpName = _cursor.getString(_cursorIndexOfName);
            }
            final String _tmpSku;
            if (_cursor.isNull(_cursorIndexOfSku)) {
              _tmpSku = null;
            } else {
              _tmpSku = _cursor.getString(_cursorIndexOfSku);
            }
            final double _tmpUnitPrice;
            _tmpUnitPrice = _cursor.getDouble(_cursorIndexOfUnitPrice);
            final int _tmpCurrentStock;
            _tmpCurrentStock = _cursor.getInt(_cursorIndexOfCurrentStock);
            final String _tmpUnit;
            if (_cursor.isNull(_cursorIndexOfUnit)) {
              _tmpUnit = null;
            } else {
              _tmpUnit = _cursor.getString(_cursorIndexOfUnit);
            }
            final String _tmpCategoryName;
            if (_cursor.isNull(_cursorIndexOfCategoryName)) {
              _tmpCategoryName = null;
            } else {
              _tmpCategoryName = _cursor.getString(_cursorIndexOfCategoryName);
            }
            final String _tmpDescription;
            if (_cursor.isNull(_cursorIndexOfDescription)) {
              _tmpDescription = null;
            } else {
              _tmpDescription = _cursor.getString(_cursorIndexOfDescription);
            }
            final String _tmpImageUrl;
            if (_cursor.isNull(_cursorIndexOfImageUrl)) {
              _tmpImageUrl = null;
            } else {
              _tmpImageUrl = _cursor.getString(_cursorIndexOfImageUrl);
            }
            final long _tmpCachedAt;
            _tmpCachedAt = _cursor.getLong(_cursorIndexOfCachedAt);
            _item = new CachedArticle(_tmpId,_tmpName,_tmpSku,_tmpUnitPrice,_tmpCurrentStock,_tmpUnit,_tmpCategoryName,_tmpDescription,_tmpImageUrl,_tmpCachedAt);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @Override
  public Object getById(final String id, final Continuation<? super CachedArticle> $completion) {
    final String _sql = "SELECT * FROM cached_articles WHERE id = ?";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 1);
    int _argIndex = 1;
    if (id == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, id);
    }
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<CachedArticle>() {
      @Override
      @Nullable
      public CachedArticle call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfName = CursorUtil.getColumnIndexOrThrow(_cursor, "name");
          final int _cursorIndexOfSku = CursorUtil.getColumnIndexOrThrow(_cursor, "sku");
          final int _cursorIndexOfUnitPrice = CursorUtil.getColumnIndexOrThrow(_cursor, "unitPrice");
          final int _cursorIndexOfCurrentStock = CursorUtil.getColumnIndexOrThrow(_cursor, "currentStock");
          final int _cursorIndexOfUnit = CursorUtil.getColumnIndexOrThrow(_cursor, "unit");
          final int _cursorIndexOfCategoryName = CursorUtil.getColumnIndexOrThrow(_cursor, "categoryName");
          final int _cursorIndexOfDescription = CursorUtil.getColumnIndexOrThrow(_cursor, "description");
          final int _cursorIndexOfImageUrl = CursorUtil.getColumnIndexOrThrow(_cursor, "imageUrl");
          final int _cursorIndexOfCachedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "cachedAt");
          final CachedArticle _result;
          if (_cursor.moveToFirst()) {
            final String _tmpId;
            if (_cursor.isNull(_cursorIndexOfId)) {
              _tmpId = null;
            } else {
              _tmpId = _cursor.getString(_cursorIndexOfId);
            }
            final String _tmpName;
            if (_cursor.isNull(_cursorIndexOfName)) {
              _tmpName = null;
            } else {
              _tmpName = _cursor.getString(_cursorIndexOfName);
            }
            final String _tmpSku;
            if (_cursor.isNull(_cursorIndexOfSku)) {
              _tmpSku = null;
            } else {
              _tmpSku = _cursor.getString(_cursorIndexOfSku);
            }
            final double _tmpUnitPrice;
            _tmpUnitPrice = _cursor.getDouble(_cursorIndexOfUnitPrice);
            final int _tmpCurrentStock;
            _tmpCurrentStock = _cursor.getInt(_cursorIndexOfCurrentStock);
            final String _tmpUnit;
            if (_cursor.isNull(_cursorIndexOfUnit)) {
              _tmpUnit = null;
            } else {
              _tmpUnit = _cursor.getString(_cursorIndexOfUnit);
            }
            final String _tmpCategoryName;
            if (_cursor.isNull(_cursorIndexOfCategoryName)) {
              _tmpCategoryName = null;
            } else {
              _tmpCategoryName = _cursor.getString(_cursorIndexOfCategoryName);
            }
            final String _tmpDescription;
            if (_cursor.isNull(_cursorIndexOfDescription)) {
              _tmpDescription = null;
            } else {
              _tmpDescription = _cursor.getString(_cursorIndexOfDescription);
            }
            final String _tmpImageUrl;
            if (_cursor.isNull(_cursorIndexOfImageUrl)) {
              _tmpImageUrl = null;
            } else {
              _tmpImageUrl = _cursor.getString(_cursorIndexOfImageUrl);
            }
            final long _tmpCachedAt;
            _tmpCachedAt = _cursor.getLong(_cursorIndexOfCachedAt);
            _result = new CachedArticle(_tmpId,_tmpName,_tmpSku,_tmpUnitPrice,_tmpCurrentStock,_tmpUnit,_tmpCategoryName,_tmpDescription,_tmpImageUrl,_tmpCachedAt);
          } else {
            _result = null;
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @Override
  public Flow<List<CachedArticle>> searchFlow(final String query) {
    final String _sql = "SELECT * FROM cached_articles WHERE name LIKE '%' || ? || '%' OR sku LIKE '%' || ? || '%' ORDER BY name ASC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 2);
    int _argIndex = 1;
    if (query == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, query);
    }
    _argIndex = 2;
    if (query == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, query);
    }
    return CoroutinesRoom.createFlow(__db, false, new String[] {"cached_articles"}, new Callable<List<CachedArticle>>() {
      @Override
      @NonNull
      public List<CachedArticle> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfId = CursorUtil.getColumnIndexOrThrow(_cursor, "id");
          final int _cursorIndexOfName = CursorUtil.getColumnIndexOrThrow(_cursor, "name");
          final int _cursorIndexOfSku = CursorUtil.getColumnIndexOrThrow(_cursor, "sku");
          final int _cursorIndexOfUnitPrice = CursorUtil.getColumnIndexOrThrow(_cursor, "unitPrice");
          final int _cursorIndexOfCurrentStock = CursorUtil.getColumnIndexOrThrow(_cursor, "currentStock");
          final int _cursorIndexOfUnit = CursorUtil.getColumnIndexOrThrow(_cursor, "unit");
          final int _cursorIndexOfCategoryName = CursorUtil.getColumnIndexOrThrow(_cursor, "categoryName");
          final int _cursorIndexOfDescription = CursorUtil.getColumnIndexOrThrow(_cursor, "description");
          final int _cursorIndexOfImageUrl = CursorUtil.getColumnIndexOrThrow(_cursor, "imageUrl");
          final int _cursorIndexOfCachedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "cachedAt");
          final List<CachedArticle> _result = new ArrayList<CachedArticle>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final CachedArticle _item;
            final String _tmpId;
            if (_cursor.isNull(_cursorIndexOfId)) {
              _tmpId = null;
            } else {
              _tmpId = _cursor.getString(_cursorIndexOfId);
            }
            final String _tmpName;
            if (_cursor.isNull(_cursorIndexOfName)) {
              _tmpName = null;
            } else {
              _tmpName = _cursor.getString(_cursorIndexOfName);
            }
            final String _tmpSku;
            if (_cursor.isNull(_cursorIndexOfSku)) {
              _tmpSku = null;
            } else {
              _tmpSku = _cursor.getString(_cursorIndexOfSku);
            }
            final double _tmpUnitPrice;
            _tmpUnitPrice = _cursor.getDouble(_cursorIndexOfUnitPrice);
            final int _tmpCurrentStock;
            _tmpCurrentStock = _cursor.getInt(_cursorIndexOfCurrentStock);
            final String _tmpUnit;
            if (_cursor.isNull(_cursorIndexOfUnit)) {
              _tmpUnit = null;
            } else {
              _tmpUnit = _cursor.getString(_cursorIndexOfUnit);
            }
            final String _tmpCategoryName;
            if (_cursor.isNull(_cursorIndexOfCategoryName)) {
              _tmpCategoryName = null;
            } else {
              _tmpCategoryName = _cursor.getString(_cursorIndexOfCategoryName);
            }
            final String _tmpDescription;
            if (_cursor.isNull(_cursorIndexOfDescription)) {
              _tmpDescription = null;
            } else {
              _tmpDescription = _cursor.getString(_cursorIndexOfDescription);
            }
            final String _tmpImageUrl;
            if (_cursor.isNull(_cursorIndexOfImageUrl)) {
              _tmpImageUrl = null;
            } else {
              _tmpImageUrl = _cursor.getString(_cursorIndexOfImageUrl);
            }
            final long _tmpCachedAt;
            _tmpCachedAt = _cursor.getLong(_cursorIndexOfCachedAt);
            _item = new CachedArticle(_tmpId,_tmpName,_tmpSku,_tmpUnitPrice,_tmpCurrentStock,_tmpUnit,_tmpCategoryName,_tmpDescription,_tmpImageUrl,_tmpCachedAt);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
        }
      }

      @Override
      protected void finalize() {
        _statement.release();
      }
    });
  }

  @NonNull
  public static List<Class<?>> getRequiredConverters() {
    return Collections.emptyList();
  }
}
