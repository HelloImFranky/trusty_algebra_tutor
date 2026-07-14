'use client';
import { use } from 'react';
import { ClassRosterScreen } from '@tutor/app';
export default function Page({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  return <ClassRosterScreen classId={Number(classId)} />;
}
