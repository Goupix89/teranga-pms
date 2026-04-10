package com.hotelpms.pos.ui.pos;

import com.hotelpms.pos.data.local.TokenManager;
import com.hotelpms.pos.data.remote.OrderSyncService;
import com.hotelpms.pos.data.remote.PmsApiService;
import com.hotelpms.pos.data.repository.PosRepository;
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
public final class PosViewModel_Factory implements Factory<PosViewModel> {
  private final Provider<PosRepository> repositoryProvider;

  private final Provider<PmsApiService> apiServiceProvider;

  private final Provider<TokenManager> tokenManagerProvider;

  private final Provider<OrderSyncService> orderSyncServiceProvider;

  public PosViewModel_Factory(Provider<PosRepository> repositoryProvider,
      Provider<PmsApiService> apiServiceProvider, Provider<TokenManager> tokenManagerProvider,
      Provider<OrderSyncService> orderSyncServiceProvider) {
    this.repositoryProvider = repositoryProvider;
    this.apiServiceProvider = apiServiceProvider;
    this.tokenManagerProvider = tokenManagerProvider;
    this.orderSyncServiceProvider = orderSyncServiceProvider;
  }

  @Override
  public PosViewModel get() {
    return newInstance(repositoryProvider.get(), apiServiceProvider.get(), tokenManagerProvider.get(), orderSyncServiceProvider.get());
  }

  public static PosViewModel_Factory create(Provider<PosRepository> repositoryProvider,
      Provider<PmsApiService> apiServiceProvider, Provider<TokenManager> tokenManagerProvider,
      Provider<OrderSyncService> orderSyncServiceProvider) {
    return new PosViewModel_Factory(repositoryProvider, apiServiceProvider, tokenManagerProvider, orderSyncServiceProvider);
  }

  public static PosViewModel newInstance(PosRepository repository, PmsApiService apiService,
      TokenManager tokenManager, OrderSyncService orderSyncService) {
    return new PosViewModel(repository, apiService, tokenManager, orderSyncService);
  }
}
