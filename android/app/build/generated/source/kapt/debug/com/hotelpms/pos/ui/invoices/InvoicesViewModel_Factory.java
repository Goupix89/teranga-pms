package com.hotelpms.pos.ui.invoices;

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
public final class InvoicesViewModel_Factory implements Factory<InvoicesViewModel> {
  private final Provider<PmsApiService> apiServiceProvider;

  public InvoicesViewModel_Factory(Provider<PmsApiService> apiServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
  }

  @Override
  public InvoicesViewModel get() {
    return newInstance(apiServiceProvider.get());
  }

  public static InvoicesViewModel_Factory create(Provider<PmsApiService> apiServiceProvider) {
    return new InvoicesViewModel_Factory(apiServiceProvider);
  }

  public static InvoicesViewModel newInstance(PmsApiService apiService) {
    return new InvoicesViewModel(apiService);
  }
}
