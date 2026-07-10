'use client';
import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { PracticeScreen } from '@tutor/app';
export default function Page({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = use(params);
  const search = useSearchParams();
  const lesson = search.get('lesson');
  return <PracticeScreen skillId={Number(skillId)} lessonId={lesson ? Number(lesson) : undefined} />;
}
