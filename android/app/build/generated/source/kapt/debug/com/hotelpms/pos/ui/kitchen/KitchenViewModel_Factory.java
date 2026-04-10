package com.hotelpms.pos.ui.kitchen;

import com.hotelpms.pos.data.local.TokenManager;
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
public final class KitchenViewModel_Factory implements Factory<KitchenViewModel> {
  private final Provider<PmsApiService> apiServiceProvider;

  private final Provider<TokenManager> tokenManagerProvider;

  private final Provider<OrderSyncService> orderSyncServiceProvider;

  public KitchenViewModel_Factory(Provider<PmsApiService> apiServiceProvider,
      Provider<TokenManager> tokenManagerProvider,
      Provider<OrderSyncService> orderSyncServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
    this.tokenManagerProvider = tokenManagerProvider;
    this.orderSyncServiceProvider = orderSyncServiceProvider;
  }

  @Override
  public KitchenViewModel get() {
    return newInstance(apiServiceProvider.get(), tokenManagerProvider.get(), orderSyncServiceProvider.get());
  }

  public static KitchenViewModel_Factory create(Provider<PmsApiService> apiServiceProvider,
      Provider<TokenManager> tokenManagerProvider,
      Provider<OrderSyncService> orderSyncServiceProvider) {
    return new KitchenViewModel_Factory(apiServiceProvider, tokenManagerProvider, orderSyncServiceProvider);
  }

  public static KitchenViewModel newInstance(PmsApiService apiService, TokenManager tokenManager,
      OrderSyncService orderSyncService) {
    return new KitchenViewModel(apiService, tokenManager, orderSyncService);
  }
}
