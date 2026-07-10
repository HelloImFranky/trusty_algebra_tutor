'use client';
import { use } from 'react';
import { ProgressScreen } from '@tutor/app';
export default function Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  return <ProgressScreen studentId={Number(studentId)} />;
}
