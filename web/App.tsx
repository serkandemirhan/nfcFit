import React, { FC, useEffect, useMemo, useState } from 'react';
import { translations } from './i18n';
import { Locale, LocaleContext } from './i18n/context';
import { supabase } from './supabaseClient';
import {
  DailyGoalProgress,
  ExerciseType,
  NfcCard,
  Page,
  Task,
  TaskStatus,
  User,
  UserExercise,
  WellnessGoal,
  WellnessLog,
  WellnessType,
} from './types';
import { DashboardPage } from './pages/DashboardPage';
import { FitnessPage } from './pages/FitnessPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { TasksPage } from './pages/TasksPage';
import { CardsPage } from './pages/CardsPage';
import { LoginPage } from './pages/LoginPage';
import { WellnessPage } from './pages/WellnessPage';
import { MembersPage } from './pages/MembersPage';
import { BrowserFrame, BrandMark, Panel } from './components/web-ui';
import { fallbackCards } from './data/fallbackCards';
import { fallbackExerciseTypes, fallbackUserExercises } from './data/fallbackExerciseTypes';
import { fallbackWellnessGoals, fallbackWellnessLogs, fallbackWellnessTypes } from './data/fallbackWellness';

const SINGLE_USER: User = {
  id: 'u1',
  name: 'Serkan',
  username: 'serkan',
  email: 'serkan@example.com',
  avatarUrl: 'https://i.pravatar.cc/150?u=serkan',
  avatarurl: 'https://i.pravatar.cc/150?u=serkan',
};

const parseCard = (raw: any): NfcCard => ({
  ...raw,
  uid: raw.uid ?? raw.nfc_uid,
  assignedLocationId: raw.assignedLocationId ?? raw.assignedlocationid ?? raw.location_id ?? null,
  assignedlocationid: raw.assignedLocationId ?? raw.assignedlocationid ?? raw.location_id ?? null,
  alias: raw.alias ?? raw.name ?? raw.id,
  active: raw.active ?? raw.is_active ?? true,
  lifecycle_status: raw.lifecycle_status ?? (raw.action_domain === 'unassigned' ? 'pending' : 'active'),
  exercise_name: raw.exercise_name ?? raw.exercise_types?.name ?? null,
  wellness_name: raw.wellness_name ?? raw.wellness_types?.name ?? null,
});

const parseExerciseLogAsTask = (raw: any): Task => {
  const createdAt = new Date(raw.createdat ?? raw.createdAt ?? new Date().toISOString());
  const exerciseName = raw.exercise_name ?? raw.exercise_types?.name ?? raw.exercise_type_id ?? 'Exercise';
  const quantity = Number(raw.quantity ?? 0);
  const unit = raw.unit ?? '';
  return {
    id: raw.id,
    title: `${quantity} ${unit} ${exerciseName}`,
    description: raw.source === 'nfc' ? 'NFC tag ile kaydedildi' : 'Manual exercise log',
    status: TaskStatus.Completed,
    locationId: '',
    userId: raw.user_id ?? 'u1',
    createdAt,
    dueDate: createdAt,
    attachments: [],
    lastCompletedAt: createdAt,
    active: true,
    repeat: null,
    calorie_estimate: raw.calorie_estimate,
    exercise_type_id: raw.exercise_type_id,
    quantity: raw.quantity,
    unit: raw.unit,
    source: raw.source,
  } as Task;
};

const parseWellnessLog = (raw: any): WellnessLog => ({
  ...raw,
  wellness_name: raw.wellness_name ?? raw.wellness_types?.name ?? null,
});

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Overview', icon: '⌂' },
  { id: 'members', label: 'Members', icon: '◎' },
  { id: 'fitness', label: 'Fitness', icon: '↯' },
  { id: 'wellness', label: 'Wellness', icon: '+' },
  { id: 'tasks', label: 'History', icon: '◷' },
  { id: 'cards', label: 'Tags', icon: '◇' },
  { id: 'exercises', label: 'Exercises', icon: '≡' },
  { id: 'profile', label: 'Profile', icon: '○' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

const AppWithContext: FC = () => {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem('locale');
    return saved === 'tr' || saved === 'en' ? saved : 'en';
  });

  useEffect(() => localStorage.setItem('locale', locale), [locale]);

  const i18nValue = useMemo(
    () => ({ locale, setLocale, t: (key: string) => translations[locale]?.[key] ?? key }),
    [locale]
  );

  return <LocaleContext.Provider value={i18nValue}><App /></LocaleContext.Provider>;
};

const App: FC = () => {
  const [page, setPage] = useState<Page>(() => {
    const hash = window.location.hash.substring(1) as Page;
    return navItems.some(item => item.id === hash) ? hash : 'dashboard';
  });
  const [users, setUsers] = useState<User[]>([SINGLE_USER]);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('nfcfit-web-user');
    return saved ? JSON.parse(saved) : null;
  });
  const [nfcCards, setNfcCards] = useState<NfcCard[]>([]);
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([]);
  const [userExercises, setUserExercises] = useState<UserExercise[]>([]);
  const [dailyGoalProgress, setDailyGoalProgress] = useState<DailyGoalProgress[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [wellnessTypes, setWellnessTypes] = useState<WellnessType[]>(fallbackWellnessTypes);
  const [wellnessGoals, setWellnessGoals] = useState<WellnessGoal[]>(fallbackWellnessGoals);
  const [wellnessLogs, setWellnessLogs] = useState<WellnessLog[]>(fallbackWellnessLogs);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const fetchWith = async <T extends unknown>(tableName: string, fallback: T[] = []): Promise<T[]> => {
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) {
          console.warn(`${tableName} verisi alinamadi:`, error.message);
          return fallback;
        }
        return data as T[];
      };

      const [
        usersData,
        cardsData,
        logsData,
        exerciseTypesData,
        userExercisesData,
        goalProgressData,
        wellnessTypesData,
        wellnessGoalsData,
        wellnessLogsData,
      ] = await Promise.all([
        fetchWith<User>('users', [SINGLE_USER]),
        fetchWith<NfcCard>('exercise_tags', fallbackCards),
        fetchWith<any>('exercise_logs', []),
        fetchWith<ExerciseType>('exercise_types', fallbackExerciseTypes),
        fetchWith<UserExercise>('user_exercises', fallbackUserExercises),
        fetchWith<DailyGoalProgress>('daily_goal_progress', []),
        fetchWith<WellnessType>('wellness_types', fallbackWellnessTypes),
        fetchWith<WellnessGoal>('wellness_goals', fallbackWellnessGoals),
        fetchWith<any>('wellness_logs', fallbackWellnessLogs),
      ]);

      const user = usersData.find(item => item.id === SINGLE_USER.id) ?? usersData[0] ?? SINGLE_USER;
      setUsers([user]);
      setNfcCards((cardsData as any[]).map(parseCard));
      setTasks((logsData as any[]).map(parseExerciseLogAsTask));
      setExerciseTypes(exerciseTypesData.length > 0 ? exerciseTypesData : fallbackExerciseTypes);
      const savedUserExercises = localStorage.getItem('nfcfit-user-exercises');
      setUserExercises(savedUserExercises ? JSON.parse(savedUserExercises) : userExercisesData.length > 0 ? userExercisesData : fallbackUserExercises);
      setDailyGoalProgress(goalProgressData);
      setWellnessTypes(wellnessTypesData.length > 0 ? wellnessTypesData : fallbackWellnessTypes);
      setWellnessGoals(wellnessGoalsData.length > 0 ? wellnessGoalsData : fallbackWellnessGoals);
      setWellnessLogs((wellnessLogsData as any[]).map(parseWellnessLog));
    };
    load();
  }, []);

  useEffect(() => {
    localStorage.setItem('nfcfit-user-exercises', JSON.stringify(userExercises));
  }, [userExercises]);

  useEffect(() => {
    const onPop = () => {
      const hash = window.location.hash.substring(1) as Page;
      if (navItems.some(item => item.id === hash)) setPage(hash);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const selectedExerciseTypes = exerciseTypes.filter(type =>
    userExercises.some(item => item.user_id === (users[0]?.id ?? 'u1') && item.exercise_type_id === type.id && item.active !== false)
  );

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    window.history.pushState({ page: nextPage }, '', `#${nextPage}`);
    setIsSidebarOpen(false);
  };

  const login = (user: User | { id: 'admin'; name: 'Admin'; avatarUrl: string }) => {
    const nextUser = user.id === 'admin' ? SINGLE_USER : user as User;
    setCurrentUser(nextUser);
    localStorage.setItem('nfcfit-web-user', JSON.stringify(nextUser));
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('nfcfit-web-user');
  };

  if (!currentUser) {
    return <LoginPage users={users} onLoginSuccess={login} />;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <DashboardPage tasks={tasks} users={users} cards={nfcCards} goals={dailyGoalProgress} wellnessTypes={wellnessTypes} wellnessGoals={wellnessGoals} wellnessLogs={wellnessLogs} />;
      case 'members':
        return <MembersPage users={users} tasks={tasks} wellnessLogs={wellnessLogs} />;
      case 'fitness':
        return <FitnessPage tasks={tasks} users={users} exerciseTypes={exerciseTypes} userExercises={userExercises} />;
      case 'wellness':
        return <WellnessPage wellnessTypes={wellnessTypes} wellnessGoals={wellnessGoals} wellnessLogs={wellnessLogs} />;
      case 'tasks':
        return <TasksPage tasks={tasks} wellnessLogs={wellnessLogs} wellnessTypes={wellnessTypes} />;
      case 'cards':
        return <CardsPage cards={nfcCards} exerciseTypes={selectedExerciseTypes} wellnessTypes={wellnessTypes} setNfcCards={setNfcCards} />;
      case 'exercises':
        return <ExercisesPage exerciseTypes={exerciseTypes} userExercises={userExercises} users={users} setUserExercises={setUserExercises} />;
      case 'profile':
        return <SimplePage title="Profile" description="Single user profile and body metrics." user={currentUser} onLogout={logout} />;
      case 'settings':
        return <SimplePage title="Settings" description="Theme, defaults and account settings." user={currentUser} onLogout={logout} />;
      default:
        return <DashboardPage tasks={tasks} users={users} cards={nfcCards} goals={dailyGoalProgress} wellnessTypes={wellnessTypes} wellnessGoals={wellnessGoals} wellnessLogs={wellnessLogs} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#020b14] p-4 text-white md:p-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-5 text-center">
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">
            NFCFit <span className="text-green-400">MVP</span> <span className="text-sky-400">Web UI</span>
          </h1>
          <p className="mt-2 text-sm text-slate-300">Fitness • Wellness • Health • NFC Powered • Habit Tracking</p>
        </div>

        <BrowserFrame>
          <div className="flex min-h-[760px]">
            <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-56 border-r border-white/10 bg-[#061523] p-4 transition md:static md:translate-x-0`}>
              <div className="mb-6 flex items-center justify-between">
                <BrandMark small />
                <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}>x</button>
              </div>
              <nav className="space-y-1">
                {navItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${page === item.id ? 'bg-green-500/20 text-green-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                    <span className="grid h-6 w-6 place-items-center text-xs">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </nav>
              <div className="mt-auto pt-8">
                <Panel className="p-3">
                  <div className="flex items-center gap-3">
                    <img src={currentUser.avatarurl ?? currentUser.avatarUrl} alt={currentUser.name} className="h-9 w-9 rounded-full" />
                    <div>
                      <p className="text-sm font-bold text-white">{currentUser.name}</p>
                      <p className="text-xs text-slate-400">Admin</p>
                    </div>
                  </div>
                </Panel>
              </div>
            </aside>
            <main className="min-w-0 flex-1 bg-[#081827]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:hidden">
                <BrandMark small />
                <button onClick={() => setIsSidebarOpen(true)} className="rounded-lg border border-white/10 px-3 py-2">Menu</button>
              </div>
              <div className="p-4 md:p-6">
                {renderPage()}
              </div>
            </main>
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
};

function SimplePage({ title, description, user, onLogout }: { title: string; description: string; user: User; onLogout: () => void }) {
  return (
    <Panel className="max-w-2xl p-6">
      <h1 className="text-2xl font-black text-white">{title}</h1>
      <p className="mt-2 text-slate-400">{description}</p>
      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <p className="font-bold text-white">{user.name}</p>
        <p className="text-sm text-slate-400">{user.email}</p>
      </div>
      <button onClick={onLogout} className="mt-6 rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white">Log out</button>
    </Panel>
  );
}

export default AppWithContext;
