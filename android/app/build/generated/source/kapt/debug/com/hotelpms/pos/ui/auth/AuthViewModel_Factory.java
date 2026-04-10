package com.hotelpms.pos.ui.auth;

import com.hotelpms.pos.data.local.TokenManager;
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
public final class AuthViewModel_Factory implements Factory<AuthViewModel> {
  private final Provider<PosRepository> repositoryProvider;

  private final Provider<PmsApiService> apiProvider;

  private final Provider<TokenManager> tokenManagerProvider;

  public AuthViewModel_Factory(Provider<PosRepository> repositoryProvider,
      Provider<PmsApiService> apiProvider, Provider<TokenManager> tokenManagerProvider) {
    this.repositoryProvider = repositoryProvider;
    this.apiProvider = apiProvider;
    this.tokenManagerProvider = tokenManagerProvider;
  }

  @Override
  public AuthViewModel get() {
    return newInstance(repositoryProvider.get(), apiProvider.get(), tokenManagerProvider.get());
  }

  public static AuthViewModel_Factory create(Provider<PosRepository> repositoryProvider,
      Provider<PmsApiService> apiProvider, Provider<TokenManager> tokenManagerProvider) {
    return new AuthViewModel_Factory(repositoryProvider, apiProvider, tokenManagerProvider);
  }

  public static AuthViewModel newInstance(PosRepository repository, PmsApiService api,
      TokenManager tokenManager) {
    return new AuthViewModel(repository, api, tokenManager);
  }
}
