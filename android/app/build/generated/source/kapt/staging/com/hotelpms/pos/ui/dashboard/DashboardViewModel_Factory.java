package com.hotelpms.pos.ui.dashboard;

import com.hotelpms.pos.data.local.TokenManager;
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
public final class DashboardViewModel_Factory implements Factory<DashboardViewModel> {
  private final Provider<PmsApiService> apiProvider;

  private final Provider<TokenManager> tokenManagerProvider;

  public DashboardViewModel_Factory(Provider<PmsApiService> apiProvider,
      Provider<TokenManager> tokenManagerProvider) {
    this.apiProvider = apiProvider;
    this.tokenManagerProvider = tokenManagerProvider;
  }

  @Override
  public DashboardViewModel get() {
    return newInstance(apiProvider.get(), tokenManagerProvider.get());
  }

  public static DashboardViewModel_Factory create(Provider<PmsApiService> apiProvider,
      Provider<TokenManager> tokenManagerProvider) {
    return new DashboardViewModel_Factory(apiProvider, tokenManagerProvider);
  }

  public static DashboardViewModel newInstance(PmsApiService api, TokenManager tokenManager) {
    return new DashboardViewModel(api, tokenManager);
  }
}
