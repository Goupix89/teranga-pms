package com.hotelpms.pos.data.local;

import android.database.Cursor;
import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.room.CoroutinesRoom;
import androidx.room.EntityInsertionAdapter;
import androidx.room.RoomDatabase;
import androidx.room.RoomSQLiteQuery;
import androidx.room.SharedSQLiteStatement;
import androidx.room.util.CursorUtil;
import androidx.room.util.DBUtil;
import androidx.sqlite.db.SupportSQLiteStatement;
import com.hotelpms.pos.domain.model.PendingTransaction;
import java.lang.Class;
import java.lang.Exception;
import java.lang.Integer;
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
public final class PendingTransactionDao_Impl implements PendingTransactionDao {
  private final RoomDatabase __db;

  private final EntityInsertionAdapter<PendingTransaction> __insertionAdapterOfPendingTransaction;

  private final SharedSQLiteStatement __preparedStmtOfUpdateStatus;

  private final SharedSQLiteStatement __preparedStmtOfIncrementRetry;

  private final SharedSQLiteStatement __preparedStmtOfCleanSynced;

  public PendingTransactionDao_Impl(@NonNull final RoomDatabase __db) {
    this.__db = __db;
    this.__insertionAdapterOfPendingTransaction = new EntityInsertionAdapter<PendingTransaction>(__db) {
      @Override
      @NonNull
      protected String createQuery() {
        return "INSERT OR REPLACE INTO `pending_transactions` (`transactionUuid`,`tenantId`,`invoiceId`,`itemsJson`,`totalAmount`,`timestamp`,`syncStatus`,`retryCount`,`lastError`,`createdAt`) VALUES (?,?,?,?,?,?,?,?,?,?)";
      }

      @Override
      protected void bind(@NonNull final SupportSQLiteStatement statement,
          @NonNull final PendingTransaction entity) {
        if (entity.getTransactionUuid() == null) {
          statement.bindNull(1);
        } else {
          statement.bindString(1, entity.getTransactionUuid());
        }
        if (entity.getTenantId() == null) {
          statement.bindNull(2);
        } else {
          statement.bindString(2, entity.getTenantId());
        }
        if (entity.getInvoiceId() == null) {
          statement.bindNull(3);
        } else {
          statement.bindString(3, entity.getInvoiceId());
        }
        if (entity.getItemsJson() == null) {
          statement.bindNull(4);
        } else {
          statement.bindString(4, entity.getItemsJson());
        }
        statement.bindDouble(5, entity.getTotalAmount());
        if (entity.getTimestamp() == null) {
          statement.bindNull(6);
        } else {
          statement.bindString(6, entity.getTimestamp());
        }
        if (entity.getSyncStatus() == null) {
          statement.bindNull(7);
        } else {
          statement.bindString(7, entity.getSyncStatus());
        }
        statement.bindLong(8, entity.getRetryCount());
        if (entity.getLastError() == null) {
          statement.bindNull(9);
        } else {
          statement.bindString(9, entity.getLastError());
        }
        statement.bindLong(10, entity.getCreatedAt());
      }
    };
    this.__preparedStmtOfUpdateStatus = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "UPDATE pending_transactions SET syncStatus = ? WHERE transactionUuid = ?";
        return _query;
      }
    };
    this.__preparedStmtOfIncrementRetry = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "\n"
                + "        UPDATE pending_transactions \n"
                + "        SET syncStatus = 'PENDING', retryCount = retryCount + 1, lastError = ? \n"
                + "        WHERE transactionUuid = ?\n"
                + "    ";
        return _query;
      }
    };
    this.__preparedStmtOfCleanSynced = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "DELETE FROM pending_transactions WHERE syncStatus = 'SYNCED' AND createdAt < ?";
        return _query;
      }
    };
  }

  @Override
  public Object insert(final PendingTransaction transaction,
      final Continuation<? super Unit> arg1) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __insertionAdapterOfPendingTransaction.insert(transaction);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, arg1);
  }

  @Override
  public Object updateStatus(final String uuid, final String status,
      final Continuation<? super Unit> arg2) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfUpdateStatus.acquire();
        int _argIndex = 1;
        if (status == null) {
          _stmt.bindNull(_argIndex);
        } else {
          _stmt.bindString(_argIndex, status);
        }
        _argIndex = 2;
        if (uuid == null) {
          _stmt.bindNull(_argIndex);
        } else {
          _stmt.bindString(_argIndex, uuid);
        }
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
          __preparedStmtOfUpdateStatus.release(_stmt);
        }
      }
    }, arg2);
  }

  @Override
  public Object incrementRetry(final String uuid, final String error,
      final Continuation<? super Unit> arg2) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfIncrementRetry.acquire();
        int _argIndex = 1;
        if (error == null) {
          _stmt.bindNull(_argIndex);
        } else {
          _stmt.bindString(_argIndex, error);
        }
        _argIndex = 2;
        if (uuid == null) {
          _stmt.bindNull(_argIndex);
        } else {
          _stmt.bindString(_argIndex, uuid);
        }
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
          __preparedStmtOfIncrementRetry.release(_stmt);
        }
      }
    }, arg2);
  }

  @Override
  public Object cleanSynced(final long before, final Continuation<? super Unit> arg1) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfCleanSynced.acquire();
        int _argIndex = 1;
        _stmt.bindLong(_argIndex, before);
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
          __preparedStmtOfCleanSynced.release(_stmt);
        }
      }
    }, arg1);
  }

  @Override
  public Object getByStatus(final String status,
      final Continuation<? super List<PendingTransaction>> arg1) {
    final String _sql = "SELECT * FROM pending_transactions WHERE syncStatus = ? ORDER BY createdAt ASC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 1);
    int _argIndex = 1;
    if (status == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, status);
    }
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<List<PendingTransaction>>() {
      @Override
      @NonNull
      public List<PendingTransaction> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfTransactionUuid = CursorUtil.getColumnIndexOrThrow(_cursor, "transactionUuid");
          final int _cursorIndexOfTenantId = CursorUtil.getColumnIndexOrThrow(_cursor, "tenantId");
          final int _cursorIndexOfInvoiceId = CursorUtil.getColumnIndexOrThrow(_cursor, "invoiceId");
          final int _cursorIndexOfItemsJson = CursorUtil.getColumnIndexOrThrow(_cursor, "itemsJson");
          final int _cursorIndexOfTotalAmount = CursorUtil.getColumnIndexOrThrow(_cursor, "totalAmount");
          final int _cursorIndexOfTimestamp = CursorUtil.getColumnIndexOrThrow(_cursor, "timestamp");
          final int _cursorIndexOfSyncStatus = CursorUtil.getColumnIndexOrThrow(_cursor, "syncStatus");
          final int _cursorIndexOfRetryCount = CursorUtil.getColumnIndexOrThrow(_cursor, "retryCount");
          final int _cursorIndexOfLastError = CursorUtil.getColumnIndexOrThrow(_cursor, "lastError");
          final int _cursorIndexOfCreatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "createdAt");
          final List<PendingTransaction> _result = new ArrayList<PendingTransaction>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final PendingTransaction _item;
            final String _tmpTransactionUuid;
            if (_cursor.isNull(_cursorIndexOfTransactionUuid)) {
              _tmpTransactionUuid = null;
            } else {
              _tmpTransactionUuid = _cursor.getString(_cursorIndexOfTransactionUuid);
            }
            final String _tmpTenantId;
            if (_cursor.isNull(_cursorIndexOfTenantId)) {
              _tmpTenantId = null;
            } else {
              _tmpTenantId = _cursor.getString(_cursorIndexOfTenantId);
            }
            final String _tmpInvoiceId;
            if (_cursor.isNull(_cursorIndexOfInvoiceId)) {
              _tmpInvoiceId = null;
            } else {
              _tmpInvoiceId = _cursor.getString(_cursorIndexOfInvoiceId);
            }
            final String _tmpItemsJson;
            if (_cursor.isNull(_cursorIndexOfItemsJson)) {
              _tmpItemsJson = null;
            } else {
              _tmpItemsJson = _cursor.getString(_cursorIndexOfItemsJson);
            }
            final double _tmpTotalAmount;
            _tmpTotalAmount = _cursor.getDouble(_cursorIndexOfTotalAmount);
            final String _tmpTimestamp;
            if (_cursor.isNull(_cursorIndexOfTimestamp)) {
              _tmpTimestamp = null;
            } else {
              _tmpTimestamp = _cursor.getString(_cursorIndexOfTimestamp);
            }
            final String _tmpSyncStatus;
            if (_cursor.isNull(_cursorIndexOfSyncStatus)) {
              _tmpSyncStatus = null;
            } else {
              _tmpSyncStatus = _cursor.getString(_cursorIndexOfSyncStatus);
            }
            final int _tmpRetryCount;
            _tmpRetryCount = _cursor.getInt(_cursorIndexOfRetryCount);
            final String _tmpLastError;
            if (_cursor.isNull(_cursorIndexOfLastError)) {
              _tmpLastError = null;
            } else {
              _tmpLastError = _cursor.getString(_cursorIndexOfLastError);
            }
            final long _tmpCreatedAt;
            _tmpCreatedAt = _cursor.getLong(_cursorIndexOfCreatedAt);
            _item = new PendingTransaction(_tmpTransactionUuid,_tmpTenantId,_tmpInvoiceId,_tmpItemsJson,_tmpTotalAmount,_tmpTimestamp,_tmpSyncStatus,_tmpRetryCount,_tmpLastError,_tmpCreatedAt);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, arg1);
  }

  @Override
  public Flow<List<PendingTransaction>> getAllFlow() {
    final String _sql = "SELECT * FROM pending_transactions ORDER BY createdAt DESC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    return CoroutinesRoom.createFlow(__db, false, new String[] {"pending_transactions"}, new Callable<List<PendingTransaction>>() {
      @Override
      @NonNull
      public List<PendingTransaction> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfTransactionUuid = CursorUtil.getColumnIndexOrThrow(_cursor, "transactionUuid");
          final int _cursorIndexOfTenantId = CursorUtil.getColumnIndexOrThrow(_cursor, "tenantId");
          final int _cursorIndexOfInvoiceId = CursorUtil.getColumnIndexOrThrow(_cursor, "invoiceId");
          final int _cursorIndexOfItemsJson = CursorUtil.getColumnIndexOrThrow(_cursor, "itemsJson");
          final int _cursorIndexOfTotalAmount = CursorUtil.getColumnIndexOrThrow(_cursor, "totalAmount");
          final int _cursorIndexOfTimestamp = CursorUtil.getColumnIndexOrThrow(_cursor, "timestamp");
          final int _cursorIndexOfSyncStatus = CursorUtil.getColumnIndexOrThrow(_cursor, "syncStatus");
          final int _cursorIndexOfRetryCount = CursorUtil.getColumnIndexOrThrow(_cursor, "retryCount");
          final int _cursorIndexOfLastError = CursorUtil.getColumnIndexOrThrow(_cursor, "lastError");
          final int _cursorIndexOfCreatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "createdAt");
          final List<PendingTransaction> _result = new ArrayList<PendingTransaction>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final PendingTransaction _item;
            final String _tmpTransactionUuid;
            if (_cursor.isNull(_cursorIndexOfTransactionUuid)) {
              _tmpTransactionUuid = null;
            } else {
              _tmpTransactionUuid = _cursor.getString(_cursorIndexOfTransactionUuid);
            }
            final String _tmpTenantId;
            if (_cursor.isNull(_cursorIndexOfTenantId)) {
              _tmpTenantId = null;
            } else {
              _tmpTenantId = _cursor.getString(_cursorIndexOfTenantId);
            }
            final String _tmpInvoiceId;
            if (_cursor.isNull(_cursorIndexOfInvoiceId)) {
              _tmpInvoiceId = null;
            } else {
              _tmpInvoiceId = _cursor.getString(_cursorIndexOfInvoiceId);
            }
            final String _tmpItemsJson;
            if (_cursor.isNull(_cursorIndexOfItemsJson)) {
              _tmpItemsJson = null;
            } else {
              _tmpItemsJson = _cursor.getString(_cursorIndexOfItemsJson);
            }
            final double _tmpTotalAmount;
            _tmpTotalAmount = _cursor.getDouble(_cursorIndexOfTotalAmount);
            final String _tmpTimestamp;
            if (_cursor.isNull(_cursorIndexOfTimestamp)) {
              _tmpTimestamp = null;
            } else {
              _tmpTimestamp = _cursor.getString(_cursorIndexOfTimestamp);
            }
            final String _tmpSyncStatus;
            if (_cursor.isNull(_cursorIndexOfSyncStatus)) {
              _tmpSyncStatus = null;
            } else {
              _tmpSyncStatus = _cursor.getString(_cursorIndexOfSyncStatus);
            }
            final int _tmpRetryCount;
            _tmpRetryCount = _cursor.getInt(_cursorIndexOfRetryCount);
            final String _tmpLastError;
            if (_cursor.isNull(_cursorIndexOfLastError)) {
              _tmpLastError = null;
            } else {
              _tmpLastError = _cursor.getString(_cursorIndexOfLastError);
            }
            final long _tmpCreatedAt;
            _tmpCreatedAt = _cursor.getLong(_cursorIndexOfCreatedAt);
            _item = new PendingTransaction(_tmpTransactionUuid,_tmpTenantId,_tmpInvoiceId,_tmpItemsJson,_tmpTotalAmount,_tmpTimestamp,_tmpSyncStatus,_tmpRetryCount,_tmpLastError,_tmpCreatedAt);
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
  public Flow<Integer> getPendingCountFlow() {
    final String _sql = "SELECT COUNT(*) FROM pending_transactions WHERE syncStatus = 'PENDING'";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    return CoroutinesRoom.createFlow(__db, false, new String[] {"pending_transactions"}, new Callable<Integer>() {
      @Override
      @NonNull
      public Integer call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final Integer _result;
          if (_cursor.moveToFirst()) {
            final Integer _tmp;
            if (_cursor.isNull(0)) {
              _tmp = null;
            } else {
              _tmp = _cursor.getInt(0);
            }
            _result = _tmp;
          } else {
            _result = null;
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
