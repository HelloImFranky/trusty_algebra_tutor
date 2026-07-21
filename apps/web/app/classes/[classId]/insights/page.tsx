'use client';
import { use } from 'react';
import { ClassInsightsScreen } from '@tutor/app';
export default function Page({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  return <ClassInsightsScreen classId={Number(classId)} />;
}
