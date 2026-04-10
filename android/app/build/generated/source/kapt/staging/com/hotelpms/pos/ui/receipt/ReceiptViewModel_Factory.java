package com.hotelpms.pos.ui.receipt;

import com.hotelpms.pos.data.remote.PmsApiService;
import com.hotelpms.pos.domain.printer.BluetoothPrinterManager;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata
@QualifierMetadata
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
public final class ReceiptViewModel_Factory implements Factory<ReceiptViewModel> {
  private final Provider<PmsApiService> apiProvider;

  private final Provider<BluetoothPrinterManager> printerManagerProvider;

  public ReceiptViewModel_Factory(Provider<PmsApiService> apiProvider,
      Provider<BluetoothPrinterManager> printerManagerProvider) {
    this.apiProvider = apiProvider;
    this.printerManagerProvider = printerManagerProvider;
  }

  @Override
  public ReceiptViewModel get() {
    return newInstance(apiProvider.get(), printerManagerProvider.get());
  }

  public static ReceiptViewModel_Factory create(Provider<PmsApiService> apiProvider,
      Provider<BluetoothPrinterManager> printerManagerProvider) {
    return new ReceiptViewModel_Factory(apiProvider, printerManagerProvider);
  }

  public static ReceiptViewModel newInstance(PmsApiService api,
      BluetoothPrinterManager printerManager) {
    return new ReceiptViewModel(api, printerManager);
  }
}
