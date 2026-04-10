package com.hotelpms.pos.ui.reservations;

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
public final class ReservationsViewModel_Factory implements Factory<ReservationsViewModel> {
  private final Provider<PmsApiService> apiProvider;

  private final Provider<TokenManager> tokenManagerProvider;

  public ReservationsViewModel_Factory(Provider<PmsApiService> apiProvider,
      Provider<TokenManager> tokenManagerProvider) {
    this.apiProvider = apiProvider;
    this.tokenManagerProvider = tokenManagerProvider;
  }

  @Override
  public ReservationsViewModel get() {
    return newInstance(apiProvider.get(), tokenManagerProvider.get());
  }

  public static ReservationsViewModel_Factory create(Provider<PmsApiService> apiProvider,
      Provider<TokenManager> tokenManagerProvider) {
    return new ReservationsViewModel_Factory(apiProvider, tokenManagerProvider);
  }

  public static ReservationsViewModel newInstance(PmsApiService api, TokenManager tokenManager) {
    return new ReservationsViewModel(api, tokenManager);
  }
}
