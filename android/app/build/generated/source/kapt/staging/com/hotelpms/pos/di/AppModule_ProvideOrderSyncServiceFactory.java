package com.hotelpms.pos.di;

import com.hotelpms.pos.data.local.TokenManager;
import com.hotelpms.pos.data.remote.OrderSyncService;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
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
public final class AppModule_ProvideOrderSyncServiceFactory implements Factory<OrderSyncService> {
  private final Provider<TokenManager> tokenManagerProvider;

  public AppModule_ProvideOrderSyncServiceFactory(Provider<TokenManager> tokenManagerProvider) {
    this.tokenManagerProvider = tokenManagerProvider;
  }

  @Override
  public OrderSyncService get() {
    return provideOrderSyncService(tokenManagerProvider.get());
  }

  public static AppModule_ProvideOrderSyncServiceFactory create(
      Provider<TokenManager> tokenManagerProvider) {
    return new AppModule_ProvideOrderSyncServiceFactory(tokenManagerProvider);
  }

  public static OrderSyncService provideOrderSyncService(TokenManager tokenManager) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideOrderSyncService(tokenManager));
  }
}
