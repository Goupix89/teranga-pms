package com.hotelpms.pos.di;

import com.hotelpms.pos.data.remote.PmsApiService;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;
import retrofit2.Retrofit;

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
public final class AppModule_ProvidePmsApiServiceFactory implements Factory<PmsApiService> {
  private final Provider<Retrofit> retrofitProvider;

  public AppModule_ProvidePmsApiServiceFactory(Provider<Retrofit> retrofitProvider) {
    this.retrofitProvider = retrofitProvider;
  }

  @Override
  public PmsApiService get() {
    return providePmsApiService(retrofitProvider.get());
  }

  public static AppModule_ProvidePmsApiServiceFactory create(Provider<Retrofit> retrofitProvider) {
    return new AppModule_ProvidePmsApiServiceFactory(retrofitProvider);
  }

  public static PmsApiService providePmsApiService(Retrofit retrofit) {
    return Preconditions.checkNotNullFromProvides(AppModule.INSTANCE.providePmsApiService(retrofit));
  }
}
