package com.hotelpms.pos.ui.notifications;

import com.hotelpms.pos.data.remote.OrderSyncService;
import com.hotelpms.pos.data.remote.PmsApiService;
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
public final class NotificationsViewModel_Factory implements Factory<NotificationsViewModel> {
  private final Provider<PmsApiService> apiServiceProvider;

  private final Provider<OrderSyncService> orderSyncServiceProvider;

  public NotificationsViewModel_Factory(Provider<PmsApiService> apiServiceProvider,
      Provider<OrderSyncService> orderSyncServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
    this.orderSyncServiceProvider = orderSyncServiceProvider;
  }

  @Override
  public NotificationsViewModel get() {
    return newInstance(apiServiceProvider.get(), orderSyncServiceProvider.get());
  }

  public static NotificationsViewModel_Factory create(Provider<PmsApiService> apiServiceProvider,
      Provider<OrderSyncService> orderSyncServiceProvider) {
    return new NotificationsViewModel_Factory(apiServiceProvider, orderSyncServiceProvider);
  }

  public static NotificationsViewModel newInstance(PmsApiService apiService,
      OrderSyncService orderSyncService) {
    return new NotificationsViewModel(apiService, orderSyncService);
  }
}
