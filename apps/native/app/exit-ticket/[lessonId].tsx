import { useLocalSearchParams } from 'expo-router';
import { ExitTicketScreen } from '@tutor/app';
export default function ExitTicket() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  return <ExitTicketScreen lessonId={Number(lessonId)} />;
}
