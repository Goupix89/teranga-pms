'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { PageHeader, LoadingPage } from '@/components/ui';
import { User, Lock, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/useAuthStore';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  const [tab, setTab] = useState<'info' | 'password'>('info');

  // Profile form
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: '',
  });
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Fetch full profile from /auth/me
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiGet<any>('/auth/me'),
    refetchOnWindowFocus: false,
  });

  // Populate form once loaded
  if (profile?.data && !profileLoaded) {
    setProfileForm({
      firstName: profile.data.firstName || '',
      lastName: profile.data.lastName || '',
      phone: profile.data.phone || '',
    });
    setProfileLoaded(true);
  }

  const updateProfileMutation = useMutation({
    mutationFn: (body: any) => apiPatch(`/users/${user?.id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      // Update local auth store
      if (user) {
        setUser({
          ...user,
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
        });
      }
      toast.success('Profil mis à jour');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors de la mise à jour'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (body: any) => apiPost('/auth/change-password', body),
    onSuccess: () => {
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Mot de passe modifié avec succes. Veuillez vous reconnecter.');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors du changement'),
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      firstName: profileForm.firstName,
      lastName: profileForm.lastName,
      phone: profileForm.phone || undefined,
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caracteres');
      return;
    }
    changePasswordMutation.mutate({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  if (isLoading) return <LoadingPage />;

  const profileData = profile?.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Mon profil" subtitle="Gerez vos informations personnelles et votre securite" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('info')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'info' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <User className="h-4 w-4" /> Informations
        </button>
        <button
          onClick={() => setTab('password')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'password' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Lock className="h-4 w-4" /> Mot de passe
        </button>
      </div>

      {tab === 'info' && (
        <div className="card max-w-2xl p-6">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-wood-200">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xl font-bold">
              {profileData?.firstName?.[0]}{profileData?.lastName?.[0]}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {profileData?.firstName} {profileData?.lastName}
              </h3>
              <p className="text-sm text-gray-500">{profileData?.email}</p>
              <p className="text-xs text-accent-600 mt-0.5">
                {profileData?.role === 'SUPERADMIN' ? 'Super Admin' :
                  profileData?.memberships?.[0]?.role || 'Employe'}
              </p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Prenom</label>
                <input
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Nom</label>
                <input
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input value={profileData?.email || ''} className="input bg-gray-50" disabled />
              <p className="text-xs text-gray-400 mt-1">L'email ne peut pas etre modifie</p>
            </div>
            <div>
              <label className="label">Telephone</label>
              <input
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="input"
                placeholder="+22890001234"
              />
            </div>

            {/* Memberships display */}
            {profileData?.memberships && profileData.memberships.length > 0 && (
              <div>
                <label className="label">Etablissements</label>
                <div className="space-y-2">
                  {profileData.memberships.map((m: any) => (
                    <div key={m.establishmentId} className="flex items-center justify-between rounded-lg bg-wood-50 px-3 py-2 text-sm">
                      <span className="font-medium text-gray-700">{m.establishmentName}</span>
                      <span className="text-xs text-accent-600 bg-accent-50 px-2 py-0.5 rounded-full">{m.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'password' && (
        <div className="card max-w-2xl p-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="label">Mot de passe actuel</label>
              <div className="relative">
                <input
                  type={showOld ? 'text' : 'password'}
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                  className="input pr-10"
                  required
                />
                <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="input pr-10"
                  required
                  minLength={8}
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Minimum 8 caracteres, 1 majuscule, 1 minuscule, 1 chiffre</p>
            </div>
            <div>
              <label className="label">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="input"
                required
              />
              {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="text-sm text-red-600 mt-1">Les mots de passe ne correspondent pas</p>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                Changer le mot de passe
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
