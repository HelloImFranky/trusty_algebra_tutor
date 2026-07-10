'use client';
import { use } from 'react';
import { LessonScreen } from '@tutor/app';
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <LessonScreen id={Number(id)} />;
}
