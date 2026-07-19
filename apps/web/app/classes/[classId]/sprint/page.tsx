'use client';
import { use } from 'react';
import { SprintStatsScreen } from '@tutor/app';
export default function Page({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  return <SprintStatsScreen classId={Number(classId)} />;
}
