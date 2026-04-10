package com.hotelpms.pos.di;

import com.hotelpms.pos.data.local.TokenManager;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;
import okhttp3.OkHttpClient;

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
public final class AppModule_ProvideOkHttpClientFactory implements Factory<OkHttpClient> {
  private final Provider<TokenManager> tokenManagerProvider;

  public AppModule_ProvideOkHttpClientFactory(Provider<TokenManager> tokenManagerProvider) {
    this.tokenManagerProvider = tokenManagerProvider;
  }

  @Override
  public OkHttpClient get() {
    return provideOkHttpClient(tokenManagerProvider.get());
  }

  public static AppModule_ProvideOkHttpClientFactory create(
      Provider<TokenManager> tokenManagerProvider) {
    return new AppModule_ProvideOkHttpClientFactory(tokenManagerProvider);
  }

  public static OkHttpClient provideOkHttpClient(TokenManager tokenManager) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.provideOkHttpClient(tokenManager));
  }
}
