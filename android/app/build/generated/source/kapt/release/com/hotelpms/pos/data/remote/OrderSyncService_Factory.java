package com.hotelpms.pos.data.remote;

import com.hotelpms.pos.data.local.TokenManager;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata("javax.inject.Singleton")
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
public final class OrderSyncService_Factory implements Factory<OrderSyncService> {
  private final Provider<TokenManager> tokenManagerProvider;

  public OrderSyncService_Factory(Provider<TokenManager> tokenManagerProvider) {
    this.tokenManagerProvider = tokenManagerProvider;
  }

  @Override
  public OrderSyncService get() {
    return newInstance(tokenManagerProvider.get());
  }

  public static OrderSyncService_Factory create(Provider<TokenManager> tokenManagerProvider) {
    return new OrderSyncService_Factory(tokenManagerProvider);
  }

  public static OrderSyncService newInstance(TokenManager tokenManager) {
    return new OrderSyncService(tokenManager);
  }
}
