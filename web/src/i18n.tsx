/** EN/ES UI strings (design doc §4.7): account-level toggle, per-session switch. */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getAuth } from './api';

const dict = {
  en: {
    appName: 'Algebra Tutor',
    login: 'Log in',
    logout: 'Log out',
    register: 'Sign up',
    username: 'Username',
    password: 'Password',
    displayName: 'What should we call you?',
    grade: 'Grade',
    under13: 'I am under 13',
    guardianEmail: "Parent/guardian's email",
    curriculum: 'My Course',
    lesson: 'Lesson',
    practice: 'Practice',
    exitTicket: 'Exit Ticket',
    sprint: 'Sprint',
    review: 'Regents Review',
    progress: 'Progress',
    calculator: 'Calculator',
    referenceSheet: 'Reference Sheet',
    next: 'Next',
    back: 'Back',
    check: 'Check',
    submit: 'Submit',
    hint: 'Hint',
    showStep: 'Walk me through it',
    askTutor: 'Ask the tutor',
    correct: 'Correct! 🎉',
    incorrect: 'Not quite — try again!',
    almostCanonical: "Right value — now write it in its final form!",
    yourAnswer: 'Your answer',
    typeMath: 'Type your answer (shortcuts: x^2, sqrt(), <=)',
    startLesson: 'Start lesson',
    continueBtn: 'Continue',
    finish: 'Finish',
    score: 'Score',
    streak: 'day streak',
    masteryMap: 'Mastery map',
    recentExitTickets: 'Recent exit tickets',
    struggling: 'Needs help',
    practicing: 'Practicing',
    proficient: 'Proficient',
    mastered: 'Mastered',
    not_started: 'Not started',
    timeLeft: 'Time left',
    sprintGo: 'Start sprint!',
    sprintDone: 'Sprint finished!',
    reviewEmpty: 'Practice a few lessons first, then come back to review!',
    tutorPlaceholder: "Ask anything, like: I don't get it",
    workedExample: 'Worked example',
    mnemonic: 'Remember',
    step: 'Step',
    of: 'of',
    problemsSolved: 'problems solved',
    signupNote: 'Students: pick a username — no email needed.',
    guardianView: 'Family view',
    minutes: 'min',
    offlineQueued: 'Saved offline — will sync when you reconnect.',
    classroomScaffold: 'Classroom Scaffold',
    scaffoldNote: 'The original scaffold notes from class — same steps your teacher uses.',
  },
  es: {
    appName: 'Tutor de Álgebra',
    login: 'Iniciar sesión',
    logout: 'Cerrar sesión',
    register: 'Registrarse',
    username: 'Nombre de usuario',
    password: 'Contraseña',
    displayName: '¿Cómo te llamamos?',
    grade: 'Grado',
    under13: 'Tengo menos de 13 años',
    guardianEmail: 'Correo del padre/tutor',
    curriculum: 'Mi Curso',
    lesson: 'Lección',
    practice: 'Práctica',
    exitTicket: 'Boleto de Salida',
    sprint: 'Sprint',
    review: 'Repaso Regents',
    progress: 'Progreso',
    calculator: 'Calculadora',
    referenceSheet: 'Hoja de Referencia',
    next: 'Siguiente',
    back: 'Atrás',
    check: 'Verificar',
    submit: 'Enviar',
    hint: 'Pista',
    showStep: 'Guíame paso a paso',
    askTutor: 'Pregunta al tutor',
    correct: '¡Correcto! 🎉',
    incorrect: 'No exactamente — ¡inténtalo de nuevo!',
    almostCanonical: '¡Valor correcto — ahora escríbelo en su forma final!',
    yourAnswer: 'Tu respuesta',
    typeMath: 'Escribe tu respuesta (atajos: x^2, sqrt(), <=)',
    startLesson: 'Comenzar lección',
    continueBtn: 'Continuar',
    finish: 'Terminar',
    score: 'Puntuación',
    streak: 'días seguidos',
    masteryMap: 'Mapa de dominio',
    recentExitTickets: 'Boletos de salida recientes',
    struggling: 'Necesita ayuda',
    practicing: 'Practicando',
    proficient: 'Competente',
    mastered: 'Dominado',
    not_started: 'Sin comenzar',
    timeLeft: 'Tiempo restante',
    sprintGo: '¡Comenzar sprint!',
    sprintDone: '¡Sprint terminado!',
    reviewEmpty: '¡Practica algunas lecciones primero y vuelve para repasar!',
    tutorPlaceholder: 'Pregunta lo que sea, como: No entiendo',
    workedExample: 'Ejemplo resuelto',
    mnemonic: 'Recuerda',
    step: 'Paso',
    of: 'de',
    problemsSolved: 'problemas resueltos',
    signupNote: 'Estudiantes: elige un nombre de usuario — no necesitas correo.',
    guardianView: 'Vista familiar',
    minutes: 'min',
    offlineQueued: 'Guardado sin conexión — se sincronizará al reconectar.',
    classroomScaffold: 'Andamiaje de la Clase',
    scaffoldNote: 'Las notas de andamiaje originales de la clase (en inglés) — los mismos pasos que usa tu maestra.',
  },
} as const;

export type Locale = 'en' | 'es';
type Key = keyof (typeof dict)['en'];

const I18nContext = createContext<{
  locale: Locale;
  t: (k: Key) => string;
  setLocale: (l: Locale) => void;
}>({ locale: 'en', t: (k) => dict.en[k], setLocale: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(
    (localStorage.getItem('tutor.locale') as Locale) ?? getAuth()?.user.locale ?? 'en',
  );
  useEffect(() => {
    localStorage.setItem('tutor.locale', locale);
  }, [locale]);
  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (getAuth()) {
      api('/api/auth/me/locale', { method: 'PATCH', body: JSON.stringify({ locale: l }) }).catch(
        () => {},
      );
    }
  };
  return (
    <I18nContext.Provider value={{ locale, t: (k) => dict[locale][k], setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
