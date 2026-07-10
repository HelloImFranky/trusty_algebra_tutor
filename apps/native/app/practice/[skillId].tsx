import { useLocalSearchParams } from 'expo-router';
import { PracticeScreen } from '@tutor/app';
export default function Practice() {
  const { skillId, lesson } = useLocalSearchParams<{ skillId: string; lesson?: string }>();
  return <PracticeScreen skillId={Number(skillId)} lessonId={lesson ? Number(lesson) : undefined} />;
}
