import { useLocalSearchParams } from 'expo-router';
import { LessonScreen } from '@tutor/app';
export default function Lesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LessonScreen id={Number(id)} />;
}
