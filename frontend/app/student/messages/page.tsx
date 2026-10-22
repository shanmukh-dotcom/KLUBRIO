'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MessagesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/student/home');
  }, [router]);
  return null;
}
