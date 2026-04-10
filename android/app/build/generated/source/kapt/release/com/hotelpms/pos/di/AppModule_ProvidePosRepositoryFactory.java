package com.hotelpms.pos.di;

import com.google.gson.Gson;
import com.hotelpms.pos.data.local.AppDatabase;
import com.hotelpms.pos.data.local.TokenManager;
import com.hotelpms.pos.data.remote.PmsApiService;
import com.hotelpms.pos.data.repository.PosRepository;
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
public final class AppModule_ProvidePosRepositoryFactory implements Factory<PosRepository> {
  private final Provider<PmsApiService> apiProvider;

  private final Provider<AppDatabase> dbProvider;

  private final Provider<TokenManager> tokenManagerProvider;

  private final Provider<Gson> gsonProvider;

  public AppModule_ProvidePosRepositoryFactory(Provider<PmsApiService> apiProvider,
      Provider<AppDatabase> dbProvider, Provider<TokenManager> tokenManagerProvider,
      Provider<Gson> gsonProvider) {
    this.apiProvider = apiProvider;
    this.dbProvider = dbProvider;
    this.tokenManagerProvider = tokenManagerProvider;
    this.gsonProvider = gsonProvider;
  }

  @Override
  public PosRepository get() {
    return providePosRepository(apiProvider.get(), dbProvider.get(), tokenManagerProvider.get(), gsonProvider.get());
  }

  public static AppModule_ProvidePosRepositoryFactory create(Provider<PmsApiService> apiProvider,
      Provider<AppDatabase> dbProvider, Provider<TokenManager> tokenManagerProvider,
      Provider<Gson> gsonProvider) {
    return new AppModule_ProvidePosRepositoryFactory(apiProvider, dbProvider, tokenManagerProvider, gsonProvider);
  }

  public static PosRepository providePosRepository(PmsApiService api, AppDatabase db,
      TokenManager tokenManager, Gson gson) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.providePosRepository(api, db, tokenManager, gson));
  }
}
