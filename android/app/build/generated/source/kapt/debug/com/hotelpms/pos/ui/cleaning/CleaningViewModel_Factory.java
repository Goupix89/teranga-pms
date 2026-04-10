package com.hotelpms.pos.ui.cleaning;

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
public final class CleaningViewModel_Factory implements Factory<CleaningViewModel> {
  private final Provider<PmsApiService> apiProvider;

  private final Provider<TokenManager> tokenManagerProvider;

  public CleaningViewModel_Factory(Provider<PmsApiService> apiProvider,
      Provider<TokenManager> tokenManagerProvider) {
    this.apiProvider = apiProvider;
    this.tokenManagerProvider = tokenManagerProvider;
  }

  @Override
  public CleaningViewModel get() {
    return newInstance(apiProvider.get(), tokenManagerProvider.get());
  }

  public static CleaningViewModel_Factory create(Provider<PmsApiService> apiProvider,
      Provider<TokenManager> tokenManagerProvider) {
    return new CleaningViewModel_Factory(apiProvider, tokenManagerProvider);
  }

  public static CleaningViewModel newInstance(PmsApiService api, TokenManager tokenManager) {
    return new CleaningViewModel(api, tokenManager);
  }
}
