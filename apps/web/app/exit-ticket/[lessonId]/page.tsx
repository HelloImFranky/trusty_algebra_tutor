'use client';
import { use } from 'react';
import { ExitTicketScreen } from '@tutor/app';
export default function Page({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  return <ExitTicketScreen lessonId={Number(lessonId)} />;
}
