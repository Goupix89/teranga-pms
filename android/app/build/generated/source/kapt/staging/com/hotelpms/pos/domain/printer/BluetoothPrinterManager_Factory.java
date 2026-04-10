package com.hotelpms.pos.domain.printer;

import android.content.Context;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata("javax.inject.Singleton")
@QualifierMetadata("dagger.hilt.android.qualifiers.ApplicationContext")
@DaggerGenerated
@Generated(
    value = "dagger.internal.codegen.ComponentProcessor",
    comments = "https://dagger.dev"
)
@SuppressWarnings({
    "unchecked",
    "rawtypes",
    "KotlinInternal",
    "KotlinInternalInJava"
})
public final class BluetoothPrinterManager_Factory implements Factory<BluetoothPrinterManager> {
  private final Provider<Context> contextProvider;

  public BluetoothPrinterManager_Factory(Provider<Context> contextProvider) {
    this.contextProvider = contextProvider;
  }

  @Override
  public BluetoothPrinterManager get() {
    return newInstance(contextProvider.get());
  }

  public static BluetoothPrinterManager_Factory create(Provider<Context> contextProvider) {
    return new BluetoothPrinterManager_Factory(contextProvider);
  }

  public static BluetoothPrinterManager newInstance(Context context) {
    return new BluetoothPrinterManager(context);
  }
}
