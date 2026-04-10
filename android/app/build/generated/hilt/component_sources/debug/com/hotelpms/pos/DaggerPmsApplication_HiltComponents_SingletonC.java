package com.hotelpms.pos;

import android.app.Activity;
import android.app.Service;
import android.view.View;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.SavedStateHandle;
import androidx.lifecycle.ViewModel;
import com.google.gson.Gson;
import com.hotelpms.pos.data.local.AppDatabase;
import com.hotelpms.pos.data.local.TokenManager;
import com.hotelpms.pos.data.remote.OrderSyncService;
import com.hotelpms.pos.data.remote.PmsApiService;
import com.hotelpms.pos.data.repository.PosRepository;
import com.hotelpms.pos.di.AppModule_ProvideDatabaseFactory;
import com.hotelpms.pos.di.AppModule_ProvideGsonFactory;
import com.hotelpms.pos.di.AppModule_ProvideOkHttpClientFactory;
import com.hotelpms.pos.di.AppModule_ProvideOrderSyncServiceFactory;
import com.hotelpms.pos.di.AppModule_ProvidePmsApiServiceFactory;
import com.hotelpms.pos.di.AppModule_ProvidePosRepositoryFactory;
import com.hotelpms.pos.di.AppModule_ProvideRetrofitFactory;
import com.hotelpms.pos.di.AppModule_ProvideTokenManagerFactory;
import com.hotelpms.pos.domain.printer.BluetoothPrinterManager;
import com.hotelpms.pos.ui.approvals.ApprovalsViewModel;
import com.hotelpms.pos.ui.approvals.ApprovalsViewModel_HiltModules_KeyModule_ProvideFactory;
import com.hotelpms.pos.ui.auth.AuthViewModel;
import com.hotelpms.pos.ui.auth.AuthViewModel_HiltModules_KeyModule_ProvideFactory;
import com.hotelpms.pos.ui.cleaning.CleaningViewModel;
import com.hotelpms.pos.ui.cleaning.CleaningViewModel_HiltModules_KeyModule_ProvideFactory;
import com.hotelpms.pos.ui.dashboard.DashboardViewModel;
import com.hotelpms.pos.ui.dashboard.DashboardViewModel_HiltModules_KeyModule_ProvideFactory;
import com.hotelpms.pos.ui.invoices.InvoicesViewModel;
import com.hotelpms.pos.ui.invoices.InvoicesViewModel_HiltModules_KeyModule_ProvideFactory;
import com.hotelpms.pos.ui.kitchen.KitchenViewModel;
import com.hotelpms.pos.ui.kitchen.KitchenViewModel_HiltModules_KeyModule_ProvideFactory;
import com.hotelpms.pos.ui.notifications.NotificationsViewModel;
import com.hotelpms.pos.ui.notifications.NotificationsViewModel_HiltModules_KeyModule_ProvideFactory;
import com.hotelpms.pos.ui.orders.OrdersViewModel;
import com.hotelpms.pos.ui.orders.OrdersViewModel_HiltModules_KeyModule_ProvideFactory;
import com.hotelpms.pos.ui.pos.PosViewModel;
import com.hotelpms.pos.ui.pos.PosViewModel_HiltModules_KeyModule_ProvideFactory;
import com.hotelpms.pos.ui.receipt.ReceiptViewModel;
import com.hotelpms.pos.ui.receipt.ReceiptViewModel_HiltModules_KeyModule_ProvideFactory;
import com.hotelpms.pos.ui.reservations.ReservationsViewModel;
import com.hotelpms.pos.ui.reservations.ReservationsViewModel_HiltModules_KeyModule_ProvideFactory;
import com.hotelpms.pos.ui.rooms.RoomsViewModel;
import com.hotelpms.pos.ui.rooms.RoomsViewModel_HiltModules_KeyModule_ProvideFactory;
import com.hotelpms.pos.ui.stock.StockViewModel;
import com.hotelpms.pos.ui.stock.StockViewModel_HiltModules_KeyModule_ProvideFactory;
import dagger.hilt.android.ActivityRetainedLifecycle;
import dagger.hilt.android.ViewModelLifecycle;
import dagger.hilt.android.internal.builders.ActivityComponentBuilder;
import dagger.hilt.android.internal.builders.ActivityRetainedComponentBuilder;
import dagger.hilt.android.internal.builders.FragmentComponentBuilder;
import dagger.hilt.android.internal.builders.ServiceComponentBuilder;
import dagger.hilt.android.internal.builders.ViewComponentBuilder;
import dagger.hilt.android.internal.builders.ViewModelComponentBuilder;
import dagger.hilt.android.internal.builders.ViewWithFragmentComponentBuilder;
import dagger.hilt.android.internal.lifecycle.DefaultViewModelFactories;
import dagger.hilt.android.internal.lifecycle.DefaultViewModelFactories_InternalFactoryFactory_Factory;
import dagger.hilt.android.internal.managers.ActivityRetainedComponentManager_LifecycleModule_ProvideActivityRetainedLifecycleFactory;
import dagger.hilt.android.internal.managers.SavedStateHandleHolder;
import dagger.hilt.android.internal.modules.ApplicationContextModule;
import dagger.hilt.android.internal.modules.ApplicationContextModule_ProvideContextFactory;
import dagger.internal.DaggerGenerated;
import dagger.internal.DoubleCheck;
import dagger.internal.MapBuilder;
import dagger.internal.Preconditions;
import dagger.internal.Provider;
import dagger.internal.SetBuilder;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import javax.annotation.processing.Generated;
import okhttp3.OkHttpClient;
import retrofit2.Retrofit;

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
public final class DaggerPmsApplication_HiltComponents_SingletonC {
  private DaggerPmsApplication_HiltComponents_SingletonC() {
  }

  public static Builder builder() {
    return new Builder();
  }

  public static final class Builder {
    private ApplicationContextModule applicationContextModule;

    private Builder() {
    }

    public Builder applicationContextModule(ApplicationContextModule applicationContextModule) {
      this.applicationContextModule = Preconditions.checkNotNull(applicationContextModule);
      return this;
    }

    public PmsApplication_HiltComponents.SingletonC build() {
      Preconditions.checkBuilderRequirement(applicationContextModule, ApplicationContextModule.class);
      return new SingletonCImpl(applicationContextModule);
    }
  }

  private static final class ActivityRetainedCBuilder implements PmsApplication_HiltComponents.ActivityRetainedC.Builder {
    private final SingletonCImpl singletonCImpl;

    private SavedStateHandleHolder savedStateHandleHolder;

    private ActivityRetainedCBuilder(SingletonCImpl singletonCImpl) {
      this.singletonCImpl = singletonCImpl;
    }

    @Override
    public ActivityRetainedCBuilder savedStateHandleHolder(
        SavedStateHandleHolder savedStateHandleHolder) {
      this.savedStateHandleHolder = Preconditions.checkNotNull(savedStateHandleHolder);
      return this;
    }

    @Override
    public PmsApplication_HiltComponents.ActivityRetainedC build() {
      Preconditions.checkBuilderRequirement(savedStateHandleHolder, SavedStateHandleHolder.class);
      return new ActivityRetainedCImpl(singletonCImpl, savedStateHandleHolder);
    }
  }

  private static final class ActivityCBuilder implements PmsApplication_HiltComponents.ActivityC.Builder {
    private final SingletonCImpl singletonCImpl;

    private final ActivityRetainedCImpl activityRetainedCImpl;

    private Activity activity;

    private ActivityCBuilder(SingletonCImpl singletonCImpl,
        ActivityRetainedCImpl activityRetainedCImpl) {
      this.singletonCImpl = singletonCImpl;
      this.activityRetainedCImpl = activityRetainedCImpl;
    }

    @Override
    public ActivityCBuilder activity(Activity activity) {
      this.activity = Preconditions.checkNotNull(activity);
      return this;
    }

    @Override
    public PmsApplication_HiltComponents.ActivityC build() {
      Preconditions.checkBuilderRequirement(activity, Activity.class);
      return new ActivityCImpl(singletonCImpl, activityRetainedCImpl, activity);
    }
  }

  private static final class FragmentCBuilder implements PmsApplication_HiltComponents.FragmentC.Builder {
    private final SingletonCImpl singletonCImpl;

    private final ActivityRetainedCImpl activityRetainedCImpl;

    private final ActivityCImpl activityCImpl;

    private Fragment fragment;

    private FragmentCBuilder(SingletonCImpl singletonCImpl,
        ActivityRetainedCImpl activityRetainedCImpl, ActivityCImpl activityCImpl) {
      this.singletonCImpl = singletonCImpl;
      this.activityRetainedCImpl = activityRetainedCImpl;
      this.activityCImpl = activityCImpl;
    }

    @Override
    public FragmentCBuilder fragment(Fragment fragment) {
      this.fragment = Preconditions.checkNotNull(fragment);
      return this;
    }

    @Override
    public PmsApplication_HiltComponents.FragmentC build() {
      Preconditions.checkBuilderRequirement(fragment, Fragment.class);
      return new FragmentCImpl(singletonCImpl, activityRetainedCImpl, activityCImpl, fragment);
    }
  }

  private static final class ViewWithFragmentCBuilder implements PmsApplication_HiltComponents.ViewWithFragmentC.Builder {
    private final SingletonCImpl singletonCImpl;

    private final ActivityRetainedCImpl activityRetainedCImpl;

    private final ActivityCImpl activityCImpl;

    private final FragmentCImpl fragmentCImpl;

    private View view;

    private ViewWithFragmentCBuilder(SingletonCImpl singletonCImpl,
        ActivityRetainedCImpl activityRetainedCImpl, ActivityCImpl activityCImpl,
        FragmentCImpl fragmentCImpl) {
      this.singletonCImpl = singletonCImpl;
      this.activityRetainedCImpl = activityRetainedCImpl;
      this.activityCImpl = activityCImpl;
      this.fragmentCImpl = fragmentCImpl;
    }

    @Override
    public ViewWithFragmentCBuilder view(View view) {
      this.view = Preconditions.checkNotNull(view);
      return this;
    }

    @Override
    public PmsApplication_HiltComponents.ViewWithFragmentC build() {
      Preconditions.checkBuilderRequirement(view, View.class);
      return new ViewWithFragmentCImpl(singletonCImpl, activityRetainedCImpl, activityCImpl, fragmentCImpl, view);
    }
  }

  private static final class ViewCBuilder implements PmsApplication_HiltComponents.ViewC.Builder {
    private final SingletonCImpl singletonCImpl;

    private final ActivityRetainedCImpl activityRetainedCImpl;

    private final ActivityCImpl activityCImpl;

    private View view;

    private ViewCBuilder(SingletonCImpl singletonCImpl, ActivityRetainedCImpl activityRetainedCImpl,
        ActivityCImpl activityCImpl) {
      this.singletonCImpl = singletonCImpl;
      this.activityRetainedCImpl = activityRetainedCImpl;
      this.activityCImpl = activityCImpl;
    }

    @Override
    public ViewCBuilder view(View view) {
      this.view = Preconditions.checkNotNull(view);
      return this;
    }

    @Override
    public PmsApplication_HiltComponents.ViewC build() {
      Preconditions.checkBuilderRequirement(view, View.class);
      return new ViewCImpl(singletonCImpl, activityRetainedCImpl, activityCImpl, view);
    }
  }

  private static final class ViewModelCBuilder implements PmsApplication_HiltComponents.ViewModelC.Builder {
    private final SingletonCImpl singletonCImpl;

    private final ActivityRetainedCImpl activityRetainedCImpl;

    private SavedStateHandle savedStateHandle;

    private ViewModelLifecycle viewModelLifecycle;

    private ViewModelCBuilder(SingletonCImpl singletonCImpl,
        ActivityRetainedCImpl activityRetainedCImpl) {
      this.singletonCImpl = singletonCImpl;
      this.activityRetainedCImpl = activityRetainedCImpl;
    }

    @Override
    public ViewModelCBuilder savedStateHandle(SavedStateHandle handle) {
      this.savedStateHandle = Preconditions.checkNotNull(handle);
      return this;
    }

    @Override
    public ViewModelCBuilder viewModelLifecycle(ViewModelLifecycle viewModelLifecycle) {
      this.viewModelLifecycle = Preconditions.checkNotNull(viewModelLifecycle);
      return this;
    }

    @Override
    public PmsApplication_HiltComponents.ViewModelC build() {
      Preconditions.checkBuilderRequirement(savedStateHandle, SavedStateHandle.class);
      Preconditions.checkBuilderRequirement(viewModelLifecycle, ViewModelLifecycle.class);
      return new ViewModelCImpl(singletonCImpl, activityRetainedCImpl, savedStateHandle, viewModelLifecycle);
    }
  }

  private static final class ServiceCBuilder implements PmsApplication_HiltComponents.ServiceC.Builder {
    private final SingletonCImpl singletonCImpl;

    private Service service;

    private ServiceCBuilder(SingletonCImpl singletonCImpl) {
      this.singletonCImpl = singletonCImpl;
    }

    @Override
    public ServiceCBuilder service(Service service) {
      this.service = Preconditions.checkNotNull(service);
      return this;
    }

    @Override
    public PmsApplication_HiltComponents.ServiceC build() {
      Preconditions.checkBuilderRequirement(service, Service.class);
      return new ServiceCImpl(singletonCImpl, service);
    }
  }

  private static final class ViewWithFragmentCImpl extends PmsApplication_HiltComponents.ViewWithFragmentC {
    private final SingletonCImpl singletonCImpl;

    private final ActivityRetainedCImpl activityRetainedCImpl;

    private final ActivityCImpl activityCImpl;

    private final FragmentCImpl fragmentCImpl;

    private final ViewWithFragmentCImpl viewWithFragmentCImpl = this;

    private ViewWithFragmentCImpl(SingletonCImpl singletonCImpl,
        ActivityRetainedCImpl activityRetainedCImpl, ActivityCImpl activityCImpl,
        FragmentCImpl fragmentCImpl, View viewParam) {
      this.singletonCImpl = singletonCImpl;
      this.activityRetainedCImpl = activityRetainedCImpl;
      this.activityCImpl = activityCImpl;
      this.fragmentCImpl = fragmentCImpl;


    }
  }

  private static final class FragmentCImpl extends PmsApplication_HiltComponents.FragmentC {
    private final SingletonCImpl singletonCImpl;

    private final ActivityRetainedCImpl activityRetainedCImpl;

    private final ActivityCImpl activityCImpl;

    private final FragmentCImpl fragmentCImpl = this;

    private FragmentCImpl(SingletonCImpl singletonCImpl,
        ActivityRetainedCImpl activityRetainedCImpl, ActivityCImpl activityCImpl,
        Fragment fragmentParam) {
      this.singletonCImpl = singletonCImpl;
      this.activityRetainedCImpl = activityRetainedCImpl;
      this.activityCImpl = activityCImpl;


    }

    @Override
    public DefaultViewModelFactories.InternalFactoryFactory getHiltInternalFactoryFactory() {
      return activityCImpl.getHiltInternalFactoryFactory();
    }

    @Override
    public ViewWithFragmentComponentBuilder viewWithFragmentComponentBuilder() {
      return new ViewWithFragmentCBuilder(singletonCImpl, activityRetainedCImpl, activityCImpl, fragmentCImpl);
    }
  }

  private static final class ViewCImpl extends PmsApplication_HiltComponents.ViewC {
    private final SingletonCImpl singletonCImpl;

    private final ActivityRetainedCImpl activityRetainedCImpl;

    private final ActivityCImpl activityCImpl;

    private final ViewCImpl viewCImpl = this;

    private ViewCImpl(SingletonCImpl singletonCImpl, ActivityRetainedCImpl activityRetainedCImpl,
        ActivityCImpl activityCImpl, View viewParam) {
      this.singletonCImpl = singletonCImpl;
      this.activityRetainedCImpl = activityRetainedCImpl;
      this.activityCImpl = activityCImpl;


    }
  }

  private static final class ActivityCImpl extends PmsApplication_HiltComponents.ActivityC {
    private final SingletonCImpl singletonCImpl;

    private final ActivityRetainedCImpl activityRetainedCImpl;

    private final ActivityCImpl activityCImpl = this;

    private ActivityCImpl(SingletonCImpl singletonCImpl,
        ActivityRetainedCImpl activityRetainedCImpl, Activity activityParam) {
      this.singletonCImpl = singletonCImpl;
      this.activityRetainedCImpl = activityRetainedCImpl;


    }

    @Override
    public void injectMainActivity(MainActivity mainActivity) {
    }

    @Override
    public DefaultViewModelFactories.InternalFactoryFactory getHiltInternalFactoryFactory() {
      return DefaultViewModelFactories_InternalFactoryFactory_Factory.newInstance(getViewModelKeys(), new ViewModelCBuilder(singletonCImpl, activityRetainedCImpl));
    }

    @Override
    public Set<String> getViewModelKeys() {
      return SetBuilder.<String>newSetBuilder(13).add(ApprovalsViewModel_HiltModules_KeyModule_ProvideFactory.provide()).add(AuthViewModel_HiltModules_KeyModule_ProvideFactory.provide()).add(CleaningViewModel_HiltModules_KeyModule_ProvideFactory.provide()).add(DashboardViewModel_HiltModules_KeyModule_ProvideFactory.provide()).add(InvoicesViewModel_HiltModules_KeyModule_ProvideFactory.provide()).add(KitchenViewModel_HiltModules_KeyModule_ProvideFactory.provide()).add(NotificationsViewModel_HiltModules_KeyModule_ProvideFactory.provide()).add(OrdersViewModel_HiltModules_KeyModule_ProvideFactory.provide()).add(PosViewModel_HiltModules_KeyModule_ProvideFactory.provide()).add(ReceiptViewModel_HiltModules_KeyModule_ProvideFactory.provide()).add(ReservationsViewModel_HiltModules_KeyModule_ProvideFactory.provide()).add(RoomsViewModel_HiltModules_KeyModule_ProvideFactory.provide()).add(StockViewModel_HiltModules_KeyModule_ProvideFactory.provide()).build();
    }

    @Override
    public ViewModelComponentBuilder getViewModelComponentBuilder() {
      return new ViewModelCBuilder(singletonCImpl, activityRetainedCImpl);
    }

    @Override
    public FragmentComponentBuilder fragmentComponentBuilder() {
      return new FragmentCBuilder(singletonCImpl, activityRetainedCImpl, activityCImpl);
    }

    @Override
    public ViewComponentBuilder viewComponentBuilder() {
      return new ViewCBuilder(singletonCImpl, activityRetainedCImpl, activityCImpl);
    }
  }

  private static final class ViewModelCImpl extends PmsApplication_HiltComponents.ViewModelC {
    private final SingletonCImpl singletonCImpl;

    private final ActivityRetainedCImpl activityRetainedCImpl;

    private final ViewModelCImpl viewModelCImpl = this;

    private Provider<ApprovalsViewModel> approvalsViewModelProvider;

    private Provider<AuthViewModel> authViewModelProvider;

    private Provider<CleaningViewModel> cleaningViewModelProvider;

    private Provider<DashboardViewModel> dashboardViewModelProvider;

    private Provider<InvoicesViewModel> invoicesViewModelProvider;

    private Provider<KitchenViewModel> kitchenViewModelProvider;

    private Provider<NotificationsViewModel> notificationsViewModelProvider;

    private Provider<OrdersViewModel> ordersViewModelProvider;

    private Provider<PosViewModel> posViewModelProvider;

    private Provider<ReceiptViewModel> receiptViewModelProvider;

    private Provider<ReservationsViewModel> reservationsViewModelProvider;

    private Provider<RoomsViewModel> roomsViewModelProvider;

    private Provider<StockViewModel> stockViewModelProvider;

    private ViewModelCImpl(SingletonCImpl singletonCImpl,
        ActivityRetainedCImpl activityRetainedCImpl, SavedStateHandle savedStateHandleParam,
        ViewModelLifecycle viewModelLifecycleParam) {
      this.singletonCImpl = singletonCImpl;
      this.activityRetainedCImpl = activityRetainedCImpl;

      initialize(savedStateHandleParam, viewModelLifecycleParam);

    }

    @SuppressWarnings("unchecked")
    private void initialize(final SavedStateHandle savedStateHandleParam,
        final ViewModelLifecycle viewModelLifecycleParam) {
      this.approvalsViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 0);
      this.authViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 1);
      this.cleaningViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 2);
      this.dashboardViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 3);
      this.invoicesViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 4);
      this.kitchenViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 5);
      this.notificationsViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 6);
      this.ordersViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 7);
      this.posViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 8);
      this.receiptViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 9);
      this.reservationsViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 10);
      this.roomsViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 11);
      this.stockViewModelProvider = new SwitchingProvider<>(singletonCImpl, activityRetainedCImpl, viewModelCImpl, 12);
    }

    @Override
    public Map<String, javax.inject.Provider<ViewModel>> getHiltViewModelMap() {
      return MapBuilder.<String, javax.inject.Provider<ViewModel>>newMapBuilder(13).put("com.hotelpms.pos.ui.approvals.ApprovalsViewModel", ((Provider) approvalsViewModelProvider)).put("com.hotelpms.pos.ui.auth.AuthViewModel", ((Provider) authViewModelProvider)).put("com.hotelpms.pos.ui.cleaning.CleaningViewModel", ((Provider) cleaningViewModelProvider)).put("com.hotelpms.pos.ui.dashboard.DashboardViewModel", ((Provider) dashboardViewModelProvider)).put("com.hotelpms.pos.ui.invoices.InvoicesViewModel", ((Provider) invoicesViewModelProvider)).put("com.hotelpms.pos.ui.kitchen.KitchenViewModel", ((Provider) kitchenViewModelProvider)).put("com.hotelpms.pos.ui.notifications.NotificationsViewModel", ((Provider) notificationsViewModelProvider)).put("com.hotelpms.pos.ui.orders.OrdersViewModel", ((Provider) ordersViewModelProvider)).put("com.hotelpms.pos.ui.pos.PosViewModel", ((Provider) posViewModelProvider)).put("com.hotelpms.pos.ui.receipt.ReceiptViewModel", ((Provider) receiptViewModelProvider)).put("com.hotelpms.pos.ui.reservations.ReservationsViewModel", ((Provider) reservationsViewModelProvider)).put("com.hotelpms.pos.ui.rooms.RoomsViewModel", ((Provider) roomsViewModelProvider)).put("com.hotelpms.pos.ui.stock.StockViewModel", ((Provider) stockViewModelProvider)).build();
    }

    @Override
    public Map<String, Object> getHiltViewModelAssistedMap() {
      return Collections.<String, Object>emptyMap();
    }

    private static final class SwitchingProvider<T> implements Provider<T> {
      private final SingletonCImpl singletonCImpl;

      private final ActivityRetainedCImpl activityRetainedCImpl;

      private final ViewModelCImpl viewModelCImpl;

      private final int id;

      SwitchingProvider(SingletonCImpl singletonCImpl, ActivityRetainedCImpl activityRetainedCImpl,
          ViewModelCImpl viewModelCImpl, int id) {
        this.singletonCImpl = singletonCImpl;
        this.activityRetainedCImpl = activityRetainedCImpl;
        this.viewModelCImpl = viewModelCImpl;
        this.id = id;
      }

      @SuppressWarnings("unchecked")
      @Override
      public T get() {
        switch (id) {
          case 0: // com.hotelpms.pos.ui.approvals.ApprovalsViewModel 
          return (T) new ApprovalsViewModel(singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.provideTokenManagerProvider.get());

          case 1: // com.hotelpms.pos.ui.auth.AuthViewModel 
          return (T) new AuthViewModel(singletonCImpl.providePosRepositoryProvider.get(), singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.provideTokenManagerProvider.get());

          case 2: // com.hotelpms.pos.ui.cleaning.CleaningViewModel 
          return (T) new CleaningViewModel(singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.provideTokenManagerProvider.get());

          case 3: // com.hotelpms.pos.ui.dashboard.DashboardViewModel 
          return (T) new DashboardViewModel(singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.provideTokenManagerProvider.get());

          case 4: // com.hotelpms.pos.ui.invoices.InvoicesViewModel 
          return (T) new InvoicesViewModel(singletonCImpl.providePmsApiServiceProvider.get());

          case 5: // com.hotelpms.pos.ui.kitchen.KitchenViewModel 
          return (T) new KitchenViewModel(singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.provideTokenManagerProvider.get(), singletonCImpl.provideOrderSyncServiceProvider.get());

          case 6: // com.hotelpms.pos.ui.notifications.NotificationsViewModel 
          return (T) new NotificationsViewModel(singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.provideOrderSyncServiceProvider.get());

          case 7: // com.hotelpms.pos.ui.orders.OrdersViewModel 
          return (T) new OrdersViewModel(singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.provideTokenManagerProvider.get(), singletonCImpl.provideOrderSyncServiceProvider.get());

          case 8: // com.hotelpms.pos.ui.pos.PosViewModel 
          return (T) new PosViewModel(singletonCImpl.providePosRepositoryProvider.get(), singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.provideTokenManagerProvider.get(), singletonCImpl.provideOrderSyncServiceProvider.get());

          case 9: // com.hotelpms.pos.ui.receipt.ReceiptViewModel 
          return (T) new ReceiptViewModel(singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.bluetoothPrinterManagerProvider.get());

          case 10: // com.hotelpms.pos.ui.reservations.ReservationsViewModel 
          return (T) new ReservationsViewModel(singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.provideTokenManagerProvider.get());

          case 11: // com.hotelpms.pos.ui.rooms.RoomsViewModel 
          return (T) new RoomsViewModel(singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.provideTokenManagerProvider.get());

          case 12: // com.hotelpms.pos.ui.stock.StockViewModel 
          return (T) new StockViewModel(singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.provideTokenManagerProvider.get());

          default: throw new AssertionError(id);
        }
      }
    }
  }

  private static final class ActivityRetainedCImpl extends PmsApplication_HiltComponents.ActivityRetainedC {
    private final SingletonCImpl singletonCImpl;

    private final ActivityRetainedCImpl activityRetainedCImpl = this;

    private Provider<ActivityRetainedLifecycle> provideActivityRetainedLifecycleProvider;

    private ActivityRetainedCImpl(SingletonCImpl singletonCImpl,
        SavedStateHandleHolder savedStateHandleHolderParam) {
      this.singletonCImpl = singletonCImpl;

      initialize(savedStateHandleHolderParam);

    }

    @SuppressWarnings("unchecked")
    private void initialize(final SavedStateHandleHolder savedStateHandleHolderParam) {
      this.provideActivityRetainedLifecycleProvider = DoubleCheck.provider(new SwitchingProvider<ActivityRetainedLifecycle>(singletonCImpl, activityRetainedCImpl, 0));
    }

    @Override
    public ActivityComponentBuilder activityComponentBuilder() {
      return new ActivityCBuilder(singletonCImpl, activityRetainedCImpl);
    }

    @Override
    public ActivityRetainedLifecycle getActivityRetainedLifecycle() {
      return provideActivityRetainedLifecycleProvider.get();
    }

    private static final class SwitchingProvider<T> implements Provider<T> {
      private final SingletonCImpl singletonCImpl;

      private final ActivityRetainedCImpl activityRetainedCImpl;

      private final int id;

      SwitchingProvider(SingletonCImpl singletonCImpl, ActivityRetainedCImpl activityRetainedCImpl,
          int id) {
        this.singletonCImpl = singletonCImpl;
        this.activityRetainedCImpl = activityRetainedCImpl;
        this.id = id;
      }

      @SuppressWarnings("unchecked")
      @Override
      public T get() {
        switch (id) {
          case 0: // dagger.hilt.android.ActivityRetainedLifecycle 
          return (T) ActivityRetainedComponentManager_LifecycleModule_ProvideActivityRetainedLifecycleFactory.provideActivityRetainedLifecycle();

          default: throw new AssertionError(id);
        }
      }
    }
  }

  private static final class ServiceCImpl extends PmsApplication_HiltComponents.ServiceC {
    private final SingletonCImpl singletonCImpl;

    private final ServiceCImpl serviceCImpl = this;

    private ServiceCImpl(SingletonCImpl singletonCImpl, Service serviceParam) {
      this.singletonCImpl = singletonCImpl;


    }
  }

  private static final class SingletonCImpl extends PmsApplication_HiltComponents.SingletonC {
    private final ApplicationContextModule applicationContextModule;

    private final SingletonCImpl singletonCImpl = this;

    private Provider<TokenManager> provideTokenManagerProvider;

    private Provider<OkHttpClient> provideOkHttpClientProvider;

    private Provider<Gson> provideGsonProvider;

    private Provider<Retrofit> provideRetrofitProvider;

    private Provider<PmsApiService> providePmsApiServiceProvider;

    private Provider<AppDatabase> provideDatabaseProvider;

    private Provider<PosRepository> providePosRepositoryProvider;

    private Provider<OrderSyncService> provideOrderSyncServiceProvider;

    private Provider<BluetoothPrinterManager> bluetoothPrinterManagerProvider;

    private SingletonCImpl(ApplicationContextModule applicationContextModuleParam) {
      this.applicationContextModule = applicationContextModuleParam;
      initialize(applicationContextModuleParam);

    }

    @SuppressWarnings("unchecked")
    private void initialize(final ApplicationContextModule applicationContextModuleParam) {
      this.provideTokenManagerProvider = DoubleCheck.provider(new SwitchingProvider<TokenManager>(singletonCImpl, 3));
      this.provideOkHttpClientProvider = DoubleCheck.provider(new SwitchingProvider<OkHttpClient>(singletonCImpl, 2));
      this.provideGsonProvider = DoubleCheck.provider(new SwitchingProvider<Gson>(singletonCImpl, 4));
      this.provideRetrofitProvider = DoubleCheck.provider(new SwitchingProvider<Retrofit>(singletonCImpl, 1));
      this.providePmsApiServiceProvider = DoubleCheck.provider(new SwitchingProvider<PmsApiService>(singletonCImpl, 0));
      this.provideDatabaseProvider = DoubleCheck.provider(new SwitchingProvider<AppDatabase>(singletonCImpl, 6));
      this.providePosRepositoryProvider = DoubleCheck.provider(new SwitchingProvider<PosRepository>(singletonCImpl, 5));
      this.provideOrderSyncServiceProvider = DoubleCheck.provider(new SwitchingProvider<OrderSyncService>(singletonCImpl, 7));
      this.bluetoothPrinterManagerProvider = DoubleCheck.provider(new SwitchingProvider<BluetoothPrinterManager>(singletonCImpl, 8));
    }

    @Override
    public void injectPmsApplication(PmsApplication pmsApplication) {
    }

    @Override
    public Set<Boolean> getDisableFragmentGetContextFix() {
      return Collections.<Boolean>emptySet();
    }

    @Override
    public ActivityRetainedComponentBuilder retainedComponentBuilder() {
      return new ActivityRetainedCBuilder(singletonCImpl);
    }

    @Override
    public ServiceComponentBuilder serviceComponentBuilder() {
      return new ServiceCBuilder(singletonCImpl);
    }

    private static final class SwitchingProvider<T> implements Provider<T> {
      private final SingletonCImpl singletonCImpl;

      private final int id;

      SwitchingProvider(SingletonCImpl singletonCImpl, int id) {
        this.singletonCImpl = singletonCImpl;
        this.id = id;
      }

      @SuppressWarnings("unchecked")
      @Override
      public T get() {
        switch (id) {
          case 0: // com.hotelpms.pos.data.remote.PmsApiService 
          return (T) AppModule_ProvidePmsApiServiceFactory.providePmsApiService(singletonCImpl.provideRetrofitProvider.get());

          case 1: // retrofit2.Retrofit 
          return (T) AppModule_ProvideRetrofitFactory.provideRetrofit(singletonCImpl.provideOkHttpClientProvider.get(), singletonCImpl.provideGsonProvider.get());

          case 2: // okhttp3.OkHttpClient 
          return (T) AppModule_ProvideOkHttpClientFactory.provideOkHttpClient(singletonCImpl.provideTokenManagerProvider.get());

          case 3: // com.hotelpms.pos.data.local.TokenManager 
          return (T) AppModule_ProvideTokenManagerFactory.provideTokenManager(ApplicationContextModule_ProvideContextFactory.provideContext(singletonCImpl.applicationContextModule));

          case 4: // com.google.gson.Gson 
          return (T) AppModule_ProvideGsonFactory.provideGson();

          case 5: // com.hotelpms.pos.data.repository.PosRepository 
          return (T) AppModule_ProvidePosRepositoryFactory.providePosRepository(singletonCImpl.providePmsApiServiceProvider.get(), singletonCImpl.provideDatabaseProvider.get(), singletonCImpl.provideTokenManagerProvider.get(), singletonCImpl.provideGsonProvider.get());

          case 6: // com.hotelpms.pos.data.local.AppDatabase 
          return (T) AppModule_ProvideDatabaseFactory.provideDatabase(ApplicationContextModule_ProvideContextFactory.provideContext(singletonCImpl.applicationContextModule));

          case 7: // com.hotelpms.pos.data.remote.OrderSyncService 
          return (T) AppModule_ProvideOrderSyncServiceFactory.provideOrderSyncService(singletonCImpl.provideTokenManagerProvider.get());

          case 8: // com.hotelpms.pos.domain.printer.BluetoothPrinterManager 
          return (T) new BluetoothPrinterManager(ApplicationContextModule_ProvideContextFactory.provideContext(singletonCImpl.applicationContextModule));

          default: throw new AssertionError(id);
        }
      }
    }
  }
}
