import { useLocalSearchParams } from 'expo-router';
import { ProgressScreen } from '@tutor/app';
export default function StudentProgress() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  return <ProgressScreen studentId={Number(studentId)} />;
}
