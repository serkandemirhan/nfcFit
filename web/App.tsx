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
import { ProfilePage, SettingsPage } from './pages/AccountPages';
import { BrowserFrame, BrandMark, Panel, UserAvatar } from './components/web-ui';
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
    userId: raw.user_id ?? '',
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
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [dataError, setDataError] = useState('');
  const [nfcCards, setNfcCards] = useState<NfcCard[]>([]);
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([]);
  const [userExercises, setUserExercises] = useState<UserExercise[]>([]);
  const [dailyGoalProgress, setDailyGoalProgress] = useState<DailyGoalProgress[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [wellnessTypes, setWellnessTypes] = useState<WellnessType[]>([]);
  const [wellnessGoals, setWellnessGoals] = useState<WellnessGoal[]>([]);
  const [wellnessLogs, setWellnessLogs] = useState<WellnessLog[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadProfile = async (session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>) => {
      const { data, error } = await supabase.rpc('get_or_create_profile', {
        p_name: session.user.user_metadata?.name ?? null,
      }).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Kullanıcı profili bulunamadı.');
      const profile = { ...data, avatarUrl: data.avatarurl } as User;
      if (active) {
        setCurrentUser(profile);
        setUsers([profile]);
        setAuthError('');
      }
    };

    const handleSession = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (!session) {
        setCurrentUser(null);
        setUsers([]);
        setAuthLoading(false);
        return;
      }
      setCurrentUser(null);
      setUsers([]);
      setAuthLoading(true);
      setTimeout(() => {
        void loadProfile(session)
          .catch((error: unknown) => {
            if (active) {
              setCurrentUser(null);
              setUsers([]);
              setAuthError(error instanceof Error ? error.message : 'Profil yüklenemedi.');
            }
          })
          .finally(() => {
            if (active) setAuthLoading(false);
          });
      }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || event === 'SIGNED_OUT') {
        handleSession(null);
      } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        handleSession(session);
      }
    });

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        handleSession(data.session);
      })
      .catch((error: unknown) => {
        if (active) {
          setAuthError(error instanceof Error ? error.message : 'Oturum kontrol edilemedi.');
          setAuthLoading(false);
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!currentUser) {
      setNfcCards([]);
      setExerciseTypes([]);
      setUserExercises([]);
      setDailyGoalProgress([]);
      setTasks([]);
      setWellnessTypes([]);
      setWellnessGoals([]);
      setWellnessLogs([]);
      setDataError('');
      return () => { active = false; };
    }

    setNfcCards([]);
    setExerciseTypes([]);
    setUserExercises([]);
    setDailyGoalProgress([]);
    setTasks([]);
    setWellnessTypes([]);
    setWellnessGoals([]);
    setWellnessLogs([]);
    setDataError('');

    const load = async () => {
      const fetchTable = async <T,>(tableName: string): Promise<T[]> => {
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) throw error;
        return (data ?? []) as T[];
      };

      try {
        const [
          cardsData,
          logsData,
          exerciseTypesData,
          userExercisesData,
          goalProgressData,
          wellnessTypesData,
          wellnessGoalsData,
          wellnessLogsData,
        ] = await Promise.all([
          fetchTable<NfcCard>('exercise_tags'),
          fetchTable<any>('exercise_logs'),
          fetchTable<ExerciseType>('exercise_types'),
          fetchTable<UserExercise>('user_exercises'),
          fetchTable<DailyGoalProgress>('daily_goal_progress'),
          fetchTable<WellnessType>('wellness_types'),
          fetchTable<WellnessGoal>('wellness_goals'),
          fetchTable<any>('wellness_logs'),
        ]);
        if (!active) return;
        setNfcCards(cardsData.map(parseCard));
        setTasks(logsData.map(parseExerciseLogAsTask));
        setExerciseTypes(exerciseTypesData);
        setUserExercises(userExercisesData);
        setDailyGoalProgress(goalProgressData);
        setWellnessTypes(wellnessTypesData);
        setWellnessGoals(wellnessGoalsData);
        setWellnessLogs(wellnessLogsData.map(parseWellnessLog));
        setDataError('');
      } catch (error) {
        if (!active) return;
        setDataError(error instanceof Error ? error.message : 'Supabase verileri yüklenemedi.');
      }
    };
    void load();
    return () => { active = false; };
  }, [currentUser]);

  useEffect(() => {
    const onPop = () => {
      const hash = window.location.hash.substring(1) as Page;
      if (navItems.some(item => item.id === hash)) setPage(hash);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const selectedExerciseTypes = exerciseTypes.filter(type =>
    userExercises.some(item => item.user_id === currentUser?.id && item.exercise_type_id === type.id && item.active !== false)
  );

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    window.history.pushState({ page: nextPage }, '', `#${nextPage}`);
    setIsSidebarOpen(false);
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { name: email.trim().split('@')[0] } },
    });
    if (error) throw error;
    return Boolean(data.session);
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setCurrentUser(null);
  };

  if (authLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#020b14] text-white">Checking session…</div>;
  }

  if (!currentUser) {
    return <LoginPage authError={authError} onLoginSuccess={login} onSignUp={signUp} />;
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
        return <ProfilePage user={currentUser} onLogout={logout} />;
      case 'settings':
        return <SettingsPage user={currentUser} onLogout={logout} />;
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
                    <UserAvatar user={currentUser} className="h-9 w-9 text-sm" />
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
                {dataError && (
                  <p role="alert" className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                    Supabase verileri yüklenemedi: {dataError}
                  </p>
                )}
                {renderPage()}
              </div>
            </main>
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
};

export default AppWithContext;
