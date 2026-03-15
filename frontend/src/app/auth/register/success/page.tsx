'use client';

import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

export default function RegisterSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-gray-900">
          Inscription réussie !
        </h1>
        <p className="mt-3 text-gray-600">
          Votre compte a été créé et votre abonnement est actif.
          Vous pouvez maintenant vous connecter à votre espace de gestion.
        </p>
        <Link href="/auth/login" className="btn-primary inline-block mt-8 px-8 py-3">
          Se connecter
        </Link>
      </div>
    </div>
  );
}
