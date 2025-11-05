import React, { useState, useMemo, FC, useCallback, useRef, useEffect } from 'react';
import { translations } from './i18n';
import layout1Img from './layout1.jpg';
import layout2Img from './layout2.jpg';
import { Page, TaskStatus, User, NfcCard, Location, Task, Layout, Attachment } from './types';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

// --- API helpers & parsers ---
const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

const parseTask = (raw: any): Task => ({
  ...raw,
  createdAt: new Date(raw.createdAt),
  dueDate: new Date(raw.dueDate),
  lastCompletedAt: raw.lastCompletedAt ? new Date(raw.lastCompletedAt) : undefined,
});

// --- I18N (Internationalization) ---
type Locale = 'tr' | 'en';
type I18nValue = { locale: Locale; setLocale: (l: Locale) => void; t: (k: string) => string };

// --- ICONS ---
const Icons = {
    Dashboard: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    Board: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2z" /></svg>,
    Tasks: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    Layouts: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Users: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Cards: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    Plus: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>,
    Repeat: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>,
    Logout: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
    Nfc: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    Attachment: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a3 3 0 006 0V7a1 1 0 112 0v4a5 5 0 01-10 0V7a3 3 0 013-3h1z" clipRule="evenodd" /></svg>,
    Trash: () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
};

const LocaleContext = React.createContext<I18nValue>({
  locale: 'tr',
  setLocale: () => {},
  t: (k: string) => k,
});
const useTranslation = () => React.useContext(LocaleContext);


// --- HELPER COMPONENTS ---

const StatCard: FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg flex items-center space-x-4">
        <div className="bg-blue-600/20 text-blue-400 p-3 rounded-full">{icon}</div>
        <div>
            <p className="text-gray-400 text-sm">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    </div>
);

const DynamicTaskStatusLabel: FC<{ task: Task }> = ({ task }) => {
    const { t } = useTranslation();
    const now = new Date();
    let statusText: string;
    let styles = '';

    if (task.status === TaskStatus.Completed) {
        statusText = t('status.completed');
        styles = 'bg-green-500/20 text-green-400';
    } else if (task.status === TaskStatus.InProgress) {
        statusText = t('status.inProgress');
        styles = 'bg-blue-500/20 text-blue-400';
    } else if (task.dueDate < now) {
        statusText = t('status.overdue');
        styles = 'bg-red-500/20 text-red-400';
    } else {
        statusText = t('status.todo');
        styles = 'bg-yellow-500/20 text-yellow-400';
    }
    
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles}`}>{statusText}</span>;
};


const Modal: FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string, size?: 'md' | 'lg', variant?: 'center' | 'right' }> = ({ isOpen, onClose, children, title, size = 'md', variant = 'center' }) => {
    if (!isOpen) return null;
    const sizeClass = size === 'lg' ? 'max-w-lg' : 'max-w-md';
    const isRight = variant === 'right';
    const containerAlign = isRight
        ? 'justify-center items-center md:justify-end md:items-stretch'
        : 'justify-center items-center';
    const rightDesktopPanel = isRight
        ? 'md:h-full md:max-w-none md:w-[520px] md:rounded-none md:rounded-l-lg md:overflow-y-auto'
        : '';
    return (
        <div className={`fixed inset-0 bg-black bg-opacity-70 z-50 flex p-4 ${containerAlign}`} onClick={onClose}>
            <div className={`bg-gray-800 rounded-lg shadow-2xl p-6 w-full ${sizeClass} ${rightDesktopPanel} transform transition-all`} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};


// --- PAGE COMPONENTS (FOR ADMIN)---

const DashboardPage: FC<{ tasks: Task[], locations: Location[], users: User[], cards: NfcCard[] }> = ({ tasks, locations, users, cards }) => {
    const { t } = useTranslation();
    const taskStatusData = useMemo(() => { // t'yi bağımlılıklara ekle
        const now = new Date();
        const counts: Record<string, number> = {
            [t('status.overdue')]: 0,
            [t('status.inProgress')]: 0,
            [t('status.todo')]: 0,
            [t('status.completed')]: 0,
        };

        tasks.forEach(task => {
            if (task.status === TaskStatus.Completed) {
                counts[t('status.completed')]++;
            } else if (task.status === TaskStatus.InProgress) {
                counts[t('status.inProgress')]++;
            } else if (task.dueDate < now) {
                counts[t('status.overdue')]++;
            } else {
                counts[t('status.todo')]++;
            }
        });
        
        return Object.entries(counts).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
    }, [tasks, t]);

    const COLORS = {
        [t('status.overdue')]: '#F87171',
        [t('status.inProgress')]: '#60A5FA',
        [t('status.todo')]: '#FBBF24',
        [t('status.completed')]: '#4ADE80',
    };
    
    const recentTasks = useMemo(() => {
        const now = new Date();
        return tasks
            .sort((a, b) => {
                const getScore = (t: Task) => {
                    if (t.status === TaskStatus.InProgress) return 3;
                    if (t.status !== TaskStatus.Completed && t.dueDate < now) return 2;
                    if (t.status === TaskStatus.ToDo) return 1;
                    return 0;
                };
                const scoreA = getScore(a);
                const scoreB = getScore(b);
                if (scoreA !== scoreB) return scoreB - scoreA;
                return b.dueDate.getTime() - a.dueDate.getTime();
            })
            .slice(0, 5);
    }, [tasks]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6">{t('nav.dashboard')}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title={t('dashboard.totalTasks')} value={tasks.length} icon={<Icons.Tasks />} />
                <StatCard title={t('dashboard.definedLocations')} value={locations.length} icon={<Icons.Layouts />} />
                <StatCard title={t('dashboard.userCount')} value={users.length} icon={<Icons.Users />} />
                <StatCard title={t('dashboard.nfcCardCount')} value={cards.length} icon={<Icons.Cards />} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-semibold text-white mb-4">{t('dashboard.taskStatus')}</h2>
                    <div style={{ width: '100%', height: 300 }}>
                       <ResponsiveContainer>
                            <PieChart>
                                <Pie data={taskStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                                    {taskStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#374151',
                                        borderColor: '#4B5563',
                                    }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                 <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-semibold text-white mb-4">Öncelikli Görevler</h2>
                    <ul className="space-y-3">
                        {recentTasks.map(task => (
                             <li key={task.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-md">
                                <div>
                                    <p className="text-white font-medium">{task.title}</p>
                                    <p className="text-sm text-gray-400">{locations.find(l => l.id === task.locationId)?.name || 'Bilinmeyen Nokta'}</p>
                                </div>
                                <DynamicTaskStatusLabel task={task} />
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

const KanbanPage: FC<{
    tasks: Task[];
    users: User[];
    locations: Location[];
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    onEditTask: (task: Task) => void;
    onViewAttachments: (task: Task) => void;
}> = ({ tasks, users, locations, setTasks, onEditTask, onViewAttachments }) => {
    const { t } = useTranslation();
    const [recentlyMoved, setRecentlyMoved] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState('all');
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    const filteredTasks = useMemo(() => {
        if (selectedUserId === 'all') {
            return tasks;
        }
        return tasks.filter(task => task.userId === selectedUserId);
    }, [tasks, selectedUserId]);

    const handleTaskDrop = (taskId: string, newStatus: TaskStatus) => {
        setRecentlyMoved(taskId);
        setTimeout(() => {
            setRecentlyMoved(null);
        }, 500);
        setTasks(currentTasks => {
            const taskIndex = currentTasks.findIndex(t => t.id === taskId);
            if (taskIndex === -1) return currentTasks;

            const taskToUpdate = currentTasks[taskIndex];
            
            if (taskToUpdate.status === newStatus) return currentTasks;

            let updatedTask: Task = { ...taskToUpdate, status: newStatus };
            let tasksToReturn = [...currentTasks];

            if (newStatus === TaskStatus.Completed) {
                updatedTask.lastCompletedAt = new Date();
                
                if (taskToUpdate.repeat) {
                    const now = new Date();
                    let newDueDate = new Date();
                    if(taskToUpdate.repeat.unit === 'days') {
                        newDueDate.setDate(now.getDate() + taskToUpdate.repeat.frequency);
                    } else {
                        newDueDate.setHours(now.getHours() + taskToUpdate.repeat.frequency);
                    }

                    const repeatedTask: Task = {
                        ...taskToUpdate,
                        id: `t_${Date.now()}`,
                        status: TaskStatus.ToDo,
                        createdAt: now,
                        dueDate: newDueDate,
                        lastCompletedAt: undefined,
                    };
                    tasksToReturn.push(repeatedTask);
                }
            }
            
            tasksToReturn[taskIndex] = updatedTask;
            return tasksToReturn;
        });
    };

    const TaskCard: FC<{ task: Task }> = ({ task }) => {
        const user = users.find(u => u.id === task.userId);
        const location = locations.find(l => l.id === task.locationId);
        const isOverdue = task.status === TaskStatus.ToDo && task.dueDate < new Date();
        const timeFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

        return (
            <div
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedTaskId(task.id);
                }}
                onDragEnd={() => setDraggedTaskId(null)}
                onClick={() => onEditTask(task)}
                className={`bg-gray-800 p-3 rounded-lg shadow-md mb-3 cursor-pointer active:cursor-grabbing transition-all duration-300 ease-in-out 
                    ${isOverdue ? 'border-l-4 border-red-500' : ''} 
                    ${draggedTaskId === task.id ? 'transform scale-105 shadow-2xl bg-gray-700' : ''}
                    ${recentlyMoved === task.id ? 'animate-fade-in' : ''}`}
            >
                <p className="font-semibold text-white mb-2">{task.title}</p>
                 <div className="flex justify-between items-center text-xs text-gray-400">
                    <div className="flex items-center space-x-2">
                        {user && <img src={user.avatarUrl} alt={user.name} className="w-5 h-5 rounded-full" title={user.name} />}
                        <span>{location?.name.substring(0, 15) || 'Bilinmeyen'}</span>
                         {task.attachments.length > 0 && (
                            <button onClick={(e) => { e.stopPropagation(); onViewAttachments(task); }} className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300">
                                <Icons.Attachment />
                                <span>{task.attachments.length}</span>
                            </button>
                        )}
                    </div>
                    <span className="font-mono">{timeFormatter.format(task.dueDate)}</span>
                </div>
            </div>
        );
    };

    const KanbanColumn: FC<{ status: TaskStatus, title: string, color: string }> = ({ status, title, color }) => {
        const [isDragOver, setIsDragOver] = useState(false);
        const tasksInColumn = filteredTasks.filter(t => t.status === status).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

        const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            if (draggedTaskId) {
                handleTaskDrop(draggedTaskId, status);
            }
            setIsDragOver(false);
        };

        return (
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`flex-shrink-0 w-80 bg-gray-900/50 rounded-lg p-3 transition-colors ${isDragOver ? 'bg-gray-700/50' : ''}`}
            >
                <h3 className={`font-bold mb-4 flex justify-between items-center text-lg ${color}`}>
                    {title}
                    <span className="text-sm font-mono px-2 py-0.5 rounded-full bg-gray-700">{tasksInColumn.length}</span>
                </h3>
                <div className="space-y-3 h-[calc(100vh-200px)] overflow-y-auto pr-1">
                    {tasksInColumn.map(task => <TaskCard key={task.id} task={task} />)}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">{t('nav.board')}</h1>
                <div>
                    <select
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(e.target.value)}
                        className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
                    >
                        <option value="all">{t('kanban.allUsers')}</option>
                        {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                </div>
            </div>
            <div className="flex-1 flex space-x-4 overflow-x-auto pb-4">
                <KanbanColumn status={TaskStatus.ToDo} title={t('status.todo')} color="text-yellow-400" />
                <KanbanColumn status={TaskStatus.InProgress} title={t('status.inProgress')} color="text-blue-400" />
                <KanbanColumn status={TaskStatus.Completed} title={t('status.completed')} color="text-green-400" />
            </div>
        </div>
    );
};

const TasksPage: FC<{
    tasks: Task[];
    users: User[];
    locations: Location[];
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    currentUser: User;
    onNewTask: () => void;
    onEditTask: (task: Task) => void;
    onViewAttachments: (task: Task) => void;
}> = ({ tasks, users, locations, setTasks, currentUser, onNewTask, onEditTask, onViewAttachments }) => {
    const { t } = useTranslation();
    const now = new Date();
    const [viewMode, setViewMode] = useState<'list' | 'table'>('list');

    const inProgressTasks = tasks.filter(t => t.status === TaskStatus.InProgress);
    const overdueTasks = tasks.filter(t => t.status === TaskStatus.ToDo && t.dueDate < now);
    const todoTasks = tasks.filter(t => t.status === TaskStatus.ToDo && t.dueDate >= now).sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime());
    const completedTasks = tasks.filter(t => t.status === TaskStatus.Completed).sort((a, b) => (b.lastCompletedAt?.getTime() || 0) - (a.lastCompletedAt?.getTime() || 0));

    const handleCompleteTask = (taskId: string) => {
        setTasks(currentTasks => {
            const taskIndex = currentTasks.findIndex(t => t.id === taskId);
            if (taskIndex === -1) return currentTasks;

            const taskToUpdate = currentTasks[taskIndex];
            if (taskToUpdate.status === TaskStatus.Completed) return currentTasks;

            let updatedTask: Task = { ...taskToUpdate, status: TaskStatus.Completed, lastCompletedAt: new Date() };
            let tasksToReturn = [...currentTasks];

            if (taskToUpdate.repeat) {
                const now = new Date();
                let newDueDate = new Date();
                if(taskToUpdate.repeat.unit === 'days') {
                    newDueDate.setDate(now.getDate() + taskToUpdate.repeat.frequency);
                } else {
                    newDueDate.setHours(now.getHours() + taskToUpdate.repeat.frequency);
                }

                const repeatedTask: Task = {
                    ...taskToUpdate,
                    id: `t_${Date.now()}`,
                    status: TaskStatus.ToDo,
                    createdAt: now,
                    dueDate: newDueDate,
                    lastCompletedAt: undefined,
                };
                tasksToReturn.push(repeatedTask);
            }

            tasksToReturn[taskIndex] = updatedTask;
            return tasksToReturn;
        });
    };

    const handleDeleteTask = (taskId: string) => {
        if (window.confirm(t('tasks.actions.confirmDelete'))) {
            setTasks(currentTasks => currentTasks.filter(t => t.id !== taskId));
        }
    };

    const TaskItem: FC<{ task: Task }> = ({ task }) => {
        const user = users.find(u => u.id === task.userId);
        const location = locations.find(l => l.id === task.locationId);
        const timeFormatter = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

        let borderColor = 'border-gray-700';
        if (task.status === TaskStatus.Completed) {
            borderColor = 'border-green-500';
        } else if (task.status === TaskStatus.InProgress) {
            borderColor = 'border-blue-500';
        } else if (task.dueDate < now) {
            borderColor = 'border-red-500';
        } else {
            borderColor = 'border-yellow-500';
        }

        return (
            <li className={`bg-gray-800 p-3 rounded-lg shadow flex items-center justify-between space-x-4 hover:bg-gray-700/50 transition-colors cursor-pointer border-l-4 ${borderColor}`} onClick={() => onEditTask(task)}>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{task.title}</p>
                    <div className="text-sm text-gray-400 flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
                        <span className="inline-flex items-center gap-1.5"><Icons.Layouts /> {location?.name || 'Bilinmeyen'}</span>
                        {user && <span className="inline-flex items-center gap-1.5"><img src={user.avatarUrl} alt={user.name} className="w-4 h-4 rounded-full"/> {user.name}</span>}
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    {task.attachments.length > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onViewAttachments(task); }}
                            className="flex items-center space-x-1.5 text-cyan-400 hover:text-cyan-300"
                            title={`${task.attachments.length} ek dosya`}
                        >
                            <Icons.Attachment />
                            <span className="text-xs font-semibold">{task.attachments.length}</span>
                        </button>
                    )}
                    {task.repeat && (
                        <div title={`Bu görev her ${task.repeat.frequency} ${task.repeat.unit === 'days' ? 'günde' : 'saatte'} bir tekrarlanır.`}>
                            <Icons.Repeat />
                        </div>
                    )}
                    <div className="text-right flex-shrink-0 w-36">
                        <p className="text-sm text-gray-300 whitespace-nowrap">
                            {task.status === TaskStatus.Completed && task.lastCompletedAt
                                ? `Tamamlandı: ${timeFormatter.format(task.lastCompletedAt)}`
                                : `Bitiş: ${timeFormatter.format(task.dueDate)}`
                            }
                        </p>
                       <div className="mt-1"><DynamicTaskStatusLabel task={task}/></div>
                    </div>
                </div>
            </li>
        );
    };

    const TaskSection: FC<{ title: string; tasks: Task[]; badgeColor: string }> = ({ title, tasks, badgeColor }) => {
        if (tasks.length === 0) return null;
        return (
            <section className="mb-8">
                <h2 className="text-xl font-semibold text-white mb-3 flex items-center">
                    {title}
                    <span className={`ml-2 text-sm font-mono px-2 py-0.5 rounded-full ${badgeColor}`}>{tasks.length}</span>
                </h2>
                <ul className="space-y-3">
                    {tasks.map(task => <TaskItem key={task.id} task={task} />)}
                </ul>
            </section>
        );
    };

    const CompactTableView: FC = () => {
        const timeFormatter = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        const [sortColumn, setSortColumn] = useState<'status' | 'title' | 'description' | 'location' | 'user' | 'created' | 'due' | 'repeat' | 'attachments'>('status');
        const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
        const [selectedTask, setSelectedTask] = useState<Task | null>(null);

        const handleSort = (column: typeof sortColumn) => {
            if (sortColumn === column) {
                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
            } else {
                setSortColumn(column);
                setSortDirection('asc');
            }
        };

        const allTasksSorted = useMemo(() => {
            return [...tasks].sort((a, b) => {
                let compareResult = 0;

                switch (sortColumn) {
                    case 'status':
                        const statusPriority = { [TaskStatus.InProgress]: 0, [TaskStatus.ToDo]: 1, [TaskStatus.Completed]: 2 };
                        compareResult = statusPriority[a.status] - statusPriority[b.status];
                        break;
                    case 'title':
                        compareResult = a.title.localeCompare(b.title);
                        break;
                    case 'description':
                        compareResult = a.description.localeCompare(b.description);
                        break;
                    case 'location':
                        const locA = locations.find(l => l.id === a.locationId)?.name || '';
                        const locB = locations.find(l => l.id === b.locationId)?.name || '';
                        compareResult = locA.localeCompare(locB);
                        break;
                    case 'user':
                        const userA = users.find(u => u.id === a.userId)?.name || '';
                        const userB = users.find(u => u.id === b.userId)?.name || '';
                        compareResult = userA.localeCompare(userB);
                        break;
                    case 'created':
                        compareResult = a.createdAt.getTime() - b.createdAt.getTime();
                        break;
                    case 'due':
                        compareResult = a.dueDate.getTime() - b.dueDate.getTime();
                        break;
                    case 'repeat':
                        const repeatA = a.repeat ? 1 : 0;
                        const repeatB = b.repeat ? 1 : 0;
                        compareResult = repeatA - repeatB;
                        break;
                    case 'attachments':
                        compareResult = a.attachments.length - b.attachments.length;
                        break;
                }

                return sortDirection === 'asc' ? compareResult : -compareResult;
            });
        }, [tasks, sortColumn, sortDirection]);

        const getStatusColor = (task: Task) => {
            if (task.status === TaskStatus.Completed) return 'text-green-400';
            if (task.status === TaskStatus.InProgress) return 'text-blue-400';
            if (task.dueDate < now) return 'text-red-400';
            return 'text-yellow-400';
        };

        const SortableHeader: FC<{ column: typeof sortColumn; children: React.ReactNode; align?: 'left' | 'center' }> = ({ column, children, align = 'left' }) => (
            <th
                className={`px-2 py-1.5 ${align === 'center' ? 'text-center' : 'text-left'} font-semibold cursor-pointer hover:bg-gray-700/50 transition-colors select-none`}
                onClick={() => handleSort(column)}
            >
                <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : 'justify-start'}`}>
                    {children}
                    {sortColumn === column && (
                        <span className="text-cyan-400">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                    )}
                </div>
            </th>
        );

        return (
            <div className="flex gap-4">
                <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-800 text-gray-300 sticky top-0">
                            <tr className="border-b border-gray-700">
                                <SortableHeader column="status">{t('tasks.table.status')}</SortableHeader>
                                <SortableHeader column="title">{t('tasks.table.task')}</SortableHeader>
                                <SortableHeader column="description">{t('tasks.table.description')}</SortableHeader>
                                <SortableHeader column="location">{t('tasks.table.location')}</SortableHeader>
                                <SortableHeader column="user">{t('tasks.table.user')}</SortableHeader>
                                <SortableHeader column="created">{t('tasks.table.created')}</SortableHeader>
                                <SortableHeader column="due">{t('tasks.table.due')}</SortableHeader>
                                <SortableHeader column="repeat" align="center">{t('tasks.table.repeat')}</SortableHeader>
                                <SortableHeader column="attachments" align="center">{t('tasks.table.attachments')}</SortableHeader>
                                <th className="px-2 py-1.5 text-center font-semibold">{t('tasks.table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-300">
                            {allTasksSorted.map(task => {
                                const user = users.find(u => u.id === task.userId);
                                const location = locations.find(l => l.id === task.locationId);
                                const isSelected = selectedTask?.id === task.id;
                                return (
                                    <tr
                                        key={task.id}
                                        onClick={() => setSelectedTask(task)}
                                        className={`border-b border-gray-800 transition-colors h-8 cursor-pointer ${
                                            isSelected
                                                ? 'bg-blue-900/40 hover:bg-blue-900/50'
                                                : 'hover:bg-blue-900/20'
                                        }`}
                                    >
                                    <td className="px-2 py-0.5">
                                        <span className={`text-xs font-semibold ${getStatusColor(task)}`}>
                                            {task.status === TaskStatus.Completed ? '✓' : task.status === TaskStatus.InProgress ? '●' : task.dueDate < now ? '!' : '○'}
                                        </span>
                                    </td>
                                    <td className="px-2 py-0.5 font-medium text-white truncate max-w-xs">{task.title}</td>
                                    <td className="px-2 py-0.5 text-gray-400 truncate max-w-xs text-xs">{task.description}</td>
                                    <td className="px-2 py-0.5 text-xs">{location?.name || '-'}</td>
                                    <td className="px-2 py-0.5">
                                        {user && (
                                            <div className="flex items-center gap-1">
                                                <img src={user.avatarUrl} alt={user.name} className="w-4 h-4 rounded-full" />
                                                <span className="text-xs truncate max-w-[100px]">{user.name}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-2 py-0.5 text-xs font-mono">{timeFormatter.format(task.createdAt)}</td>
                                    <td className="px-2 py-0.5 text-xs font-mono">
                                        {task.status === TaskStatus.Completed && task.lastCompletedAt
                                            ? timeFormatter.format(task.lastCompletedAt)
                                            : timeFormatter.format(task.dueDate)
                                        }
                                    </td>
                                    <td className="px-2 py-0.5 text-center">
                                        {task.repeat && <span className="text-cyan-400 text-xs">↻</span>}
                                    </td>
                                    <td className="px-2 py-0.5 text-center">
                                        {task.attachments.length > 0 && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onViewAttachments(task); }}
                                                className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold"
                                            >
                                                {task.attachments.length}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-2 py-0.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {task.status !== TaskStatus.Completed && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCompleteTask(task.id);
                                                        if (selectedTask?.id === task.id) {
                                                            setSelectedTask(null);
                                                        }
                                                    }}
                                                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-0.5 rounded transition-colors"
                                                    title={t('tasks.actions.complete')}
                                                >
                                                    ✓
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                                className="text-blue-400 hover:text-blue-300 text-xs px-1"
                                                title="Düzenle"
                                            >
                                                ✏️
                                            </button>
                                            {currentUser.id === 'admin' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteTask(task.id);
                                                        if (selectedTask?.id === task.id) {
                                                            setSelectedTask(null);
                                                        }
                                                    }}
                                                    className="text-red-400 hover:text-red-300 text-xs px-1"
                                                    title={t('tasks.actions.delete')}
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {selectedTask && (
                <div className="w-96 bg-gray-800 rounded-lg p-4 shadow-lg sticky top-0 h-fit">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold text-white">{selectedTask.title}</h3>
                        <button
                            onClick={() => setSelectedTask(null)}
                            className="text-gray-400 hover:text-white text-xl"
                        >
                            ×
                        </button>
                    </div>

                    <div className="space-y-3 text-sm">
                        <div>
                            <label className="text-gray-400 text-xs">{t('tasks.form.description')}</label>
                            <p className="text-white mt-1">{selectedTask.description}</p>
                        </div>

                        <div>
                            <label className="text-gray-400 text-xs">Durum</label>
                            <div className="mt-1">
                                <DynamicTaskStatusLabel task={selectedTask} />
                            </div>
                        </div>

                        <div>
                            <label className="text-gray-400 text-xs">{t('tasks.form.location')}</label>
                            <p className="text-white mt-1">{locations.find(l => l.id === selectedTask.locationId)?.name || '-'}</p>
                        </div>

                        <div>
                            <label className="text-gray-400 text-xs">{t('tasks.form.assignee')}</label>
                            <div className="flex items-center gap-2 mt-1">
                                {users.find(u => u.id === selectedTask.userId) && (
                                    <>
                                        <img
                                            src={users.find(u => u.id === selectedTask.userId)?.avatarUrl}
                                            alt=""
                                            className="w-6 h-6 rounded-full"
                                        />
                                        <span className="text-white">{users.find(u => u.id === selectedTask.userId)?.name}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-gray-400 text-xs">{t('tasks.table.created')}</label>
                            <p className="text-white mt-1">{timeFormatter.format(selectedTask.createdAt)}</p>
                        </div>

                        <div>
                            <label className="text-gray-400 text-xs">{t('tasks.table.due')}</label>
                            <p className="text-white mt-1">{timeFormatter.format(selectedTask.dueDate)}</p>
                        </div>

                        {selectedTask.repeat && (
                            <div>
                                <label className="text-gray-400 text-xs">{t('tasks.table.repeat')}</label>
                                <p className="text-cyan-400 mt-1">
                                    {selectedTask.repeat.frequency} {selectedTask.repeat.unit === 'days' ? 'günde' : 'saatte'} bir
                                </p>
                            </div>
                        )}

                        {selectedTask.attachments.length > 0 && (
                            <div>
                                <label className="text-gray-400 text-xs">{t('tasks.table.attachments')}</label>
                                <p className="text-cyan-400 mt-1 cursor-pointer hover:text-cyan-300" onClick={() => onViewAttachments(selectedTask)}>
                                    {selectedTask.attachments.length} dosya
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 mt-6">
                        <div className="flex gap-2">
                            {selectedTask.status !== TaskStatus.Completed && (
                                <button
                                    onClick={() => { handleCompleteTask(selectedTask.id); setSelectedTask(null); }}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                                >
                                    {t('tasks.actions.complete')}
                                </button>
                            )}
                            <button
                                onClick={() => onEditTask(selectedTask)}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                Düzenle
                            </button>
                        </div>
                        {currentUser.id === 'admin' && (
                            <button
                                onClick={() => { handleDeleteTask(selectedTask.id); setSelectedTask(null); }}
                                className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                {t('tasks.actions.delete')}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
        );
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">{t('tasks.title')}</h1>
                <div className="flex items-center gap-4">
                    <label className="flex items-center cursor-pointer">
                        <span className="mr-3 text-white text-sm font-medium">{t('tasks.viewMode.list')}</span>
                        <div className="relative">
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={viewMode === 'table'}
                                onChange={() => setViewMode(viewMode === 'list' ? 'table' : 'list')}
                            />
                            <div className="block w-14 h-8 rounded-full bg-gray-600"></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${viewMode === 'table' ? 'transform translate-x-full bg-green-400' : ''}`}></div>
                        </div>
                        <span className="ml-3 text-white text-sm font-medium">{t('tasks.viewMode.table')}</span>
                    </label>
                    <button onClick={onNewTask} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center space-x-2 transition-colors">
                        <Icons.Plus />
                        <span>{t('btn.newTask')}</span>
                    </button>
                </div>
            </div>

            {tasks.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                    <h3 className="text-lg font-semibold">{t('tasks.noTasks.title')}</h3>
                    <p className="mt-2">{t('tasks.noTasks.description')}</p>
                </div>
            )}

            {tasks.length > 0 && viewMode === 'list' && (
                <>
                    <TaskSection title={t('tasks.inProgress')} tasks={inProgressTasks} badgeColor="bg-blue-500/30 text-blue-300" />
                    <TaskSection title={t('tasks.overdue')} tasks={overdueTasks} badgeColor="bg-red-500/30 text-red-300" />
                    <TaskSection title={t('tasks.todo')} tasks={todoTasks} badgeColor="bg-yellow-500/30 text-yellow-300" />
                    <TaskSection title={t('tasks.completed')} tasks={completedTasks} badgeColor="bg-green-500/30 text-green-300" />
                </>
            )}

            {tasks.length > 0 && viewMode === 'table' && <CompactTableView />}
        </div>
    );
};

const LayoutsPage: FC<{
    locations: Location[];
    cards: NfcCard[];
    layouts: Layout[];
    setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
    setNfcCards: React.Dispatch<React.SetStateAction<NfcCard[]>>;
    setLayouts: React.Dispatch<React.SetStateAction<Layout[]>>;
}> = ({ locations, cards, layouts, setLocations, setNfcCards, setLayouts }) => {
    const { t } = useTranslation();
    const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(layouts[0]?.id || null);
    const [isPlacementMode, setIsPlacementMode] = useState(false);
    
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [newPointCoords, setNewPointCoords] = useState<{ x: number, y: number } | null>(null);

    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [editingLayout, setEditingLayout] = useState<Layout | null>(null);

    const [draggingMarker, setDraggingMarker] = useState<Location | null>(null);

    const mapRef = useRef<HTMLDivElement>(null);

    // Form states
    const [locationName, setLocationName] = useState('');
    const [assignedCardId, setAssignedCardId] = useState<string | ''>('');
    const [layoutName, setLayoutName] = useState('');
    const [layoutImageUrl, setLayoutImageUrl] = useState('');

    const selectedLayout = useMemo(() => layouts.find(l => l.id === selectedLayoutId), [layouts, selectedLayoutId]);
    const filteredLocations = useMemo(() => locations.filter(loc => loc.layoutId === selectedLayoutId), [locations, selectedLayoutId]);
    const unassignedCards = useMemo(() => cards.filter(c => c.assignedLocationId === null), [cards]);

    const availableCardsForDropdown = useMemo(() => {
        if (selectedLocation && selectedLocation.nfcCardId) {
            const currentCard = cards.find(c => c.id === selectedLocation.nfcCardId);
            return currentCard ? [currentCard, ...unassignedCards] : unassignedCards;
        }
        return unassignedCards;
    }, [unassignedCards, selectedLocation, cards]);

    const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isPlacementMode || !mapRef.current || !selectedLayoutId) return;
        const rect = mapRef.current.getBoundingClientRect();
        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
        setNewPointCoords({ x, y });
        setSelectedLocation(null);
        setLocationName('');
        setAssignedCardId('');
        setIsLocationModalOpen(true);
    };

    const handleMarkerClick = (location: Location) => {
        setIsPlacementMode(false);
        setNewPointCoords(null);
        setSelectedLocation(location);
        setLocationName(location.name);
        setAssignedCardId(location.nfcCardId || '');
        setIsLocationModalOpen(true);
    };
    
    const closeLocationModal = () => {
        setIsLocationModalOpen(false);
        setSelectedLocation(null);
        setNewPointCoords(null);
    };

    const handleSaveLocation = () => {
        if(!selectedLayoutId) return;

        let updatedLocations = [...locations];
        let updatedCards = [...cards];

        const handleCardUpdates = (oldCardId: string | null, newCardId: string | null, locationId: string) => {
             if (oldCardId && oldCardId !== newCardId) {
                const oldCardIndex = updatedCards.findIndex(c => c.id === oldCardId);
                if (oldCardIndex > -1) updatedCards[oldCardIndex] = { ...updatedCards[oldCardIndex], assignedLocationId: null };
            }
             if (newCardId) {
                 const newCardIndex = updatedCards.findIndex(c => c.id === newCardId);
                 if (newCardIndex > -1) updatedCards[newCardIndex] = { ...updatedCards[newCardIndex], assignedLocationId: locationId };
            }
        }
        
        if (selectedLocation) {
            const locIndex = updatedLocations.findIndex(l => l.id === selectedLocation.id);
            if (locIndex > -1) {
                const originalLocation = updatedLocations[locIndex];
                handleCardUpdates(originalLocation.nfcCardId, assignedCardId || null, selectedLocation.id);
                updatedLocations[locIndex] = { ...originalLocation, name: locationName, nfcCardId: assignedCardId || null };
            }
        } else if (newPointCoords) {
            const newLocation: Location = {
                id: `loc_${Date.now()}`,
                name: locationName,
                layoutId: selectedLayoutId,
                nfcCardId: assignedCardId || null,
                ...newPointCoords
            };
            updatedLocations.push(newLocation);
            handleCardUpdates(null, assignedCardId || null, newLocation.id);
        }

        setLocations(updatedLocations);
        setNfcCards(updatedCards);
        closeLocationModal();
    };

    const handleDeleteLocation = () => {
        if (!selectedLocation) return;
        const updatedCards = cards.map(card => card.id === selectedLocation.nfcCardId ? { ...card, assignedLocationId: null } : card);
        const updatedLocations = locations.filter(loc => loc.id !== selectedLocation.id);
        setLocations(updatedLocations);
        setNfcCards(updatedCards);
        closeLocationModal();
    };

    const openNewLayoutModal = () => {
        setEditingLayout(null);
        setLayoutName('');
        setLayoutImageUrl('');
        setIsLayoutModalOpen(true);
    };

    const openEditLayoutModal = () => {
        if (!selectedLayout) return;
        setEditingLayout(selectedLayout);
        setLayoutName(selectedLayout.name);
        setLayoutImageUrl(selectedLayout.imageUrl);
        setIsLayoutModalOpen(true);
    };

    const handleSaveLayout = () => {
        if (editingLayout) {
            const updatedLayouts = layouts.map(l => l.id === editingLayout.id ? { ...l, name: layoutName, imageUrl: layoutImageUrl } : l);
            setLayouts(updatedLayouts);
        } else {
            const newLayout: Layout = {
                id: `layout_${Date.now()}`,
                name: layoutName,
                imageUrl: layoutImageUrl,
            };
            const updatedLayouts = [...layouts, newLayout];
            setLayouts(updatedLayouts);
            setSelectedLayoutId(newLayout.id);
        }
        setIsLayoutModalOpen(false);
    };

    const handleDeleteLayout = () => {
        if (!editingLayout || !window.confirm(`'${editingLayout.name}' yerleşimini silmek istediğinizden emin misiniz? Bu yerleşime ait tüm noktalar da silinecektir.`)) return;
        
        const locationsToDelete = locations.filter(l => l.layoutId === editingLayout.id);
        const locationIdsToDelete = locationsToDelete.map(l => l.id);
        const cardIdsToUnassign = locationsToDelete.map(l => l.nfcCardId).filter(Boolean);

        const updatedCards = cards.map(c => cardIdsToUnassign.includes(c.id) ? { ...c, assignedLocationId: null } : c);
        const updatedLocations = locations.filter(l => l.layoutId !== editingLayout.id);
        const updatedLayouts = layouts.filter(l => l.id !== editingLayout.id);

        setNfcCards(updatedCards);
        setLocations(updatedLocations);
        setLayouts(updatedLayouts);
        
        if(selectedLayoutId === editingLayout.id) {
            setSelectedLayoutId(updatedLayouts[0]?.id || null);
        }
        setIsLayoutModalOpen(false);
    };
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('Lütfen bir resim dosyası seçin.');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setLayoutImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleMarkerDragStart = (e: React.MouseEvent, location: Location) => {
        e.preventDefault();
        e.stopPropagation();
        setDraggingMarker(location);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!draggingMarker || !mapRef.current) return;
        const rect = mapRef.current.getBoundingClientRect();
        let x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        let y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));

        setLocations(currentLocations =>
            currentLocations.map(loc =>
                loc.id === draggingMarker.id ? { ...loc, x, y } : loc
            )
        );
    };

    const handleMouseUp = () => {
        setDraggingMarker(null);
    };

    useEffect(() => {
        if (draggingMarker) {
            document.addEventListener('mouseup', handleMouseUp as any);
            document.addEventListener('mousemove', handleMouseMove as any);
        }
        return () => {
            document.removeEventListener('mouseup', handleMouseUp as any);
            document.removeEventListener('mousemove', handleMouseMove as any);
        };
    }, [draggingMarker]);

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white">{t('layouts.title')}</h1>
                <div className="flex items-center gap-4">
                    <label htmlFor="placementToggle" className="flex items-center cursor-pointer">
                        <span className="mr-3 text-white text-sm font-medium">{t('layouts.placementMode.off')}</span>
                        <div className="relative">
                            <input type="checkbox" id="placementToggle" className="sr-only" checked={isPlacementMode} onChange={() => setIsPlacementMode(!isPlacementMode)} disabled={!selectedLayoutId} />
                            <div className={`block w-14 h-8 rounded-full ${!selectedLayoutId ? 'bg-gray-700' : 'bg-gray-600'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isPlacementMode ? 'transform translate-x-full bg-green-400' : ''}`}></div>
                        </div>
                        <span className="ml-3 text-white text-sm font-medium">{t('layouts.placementMode.on')}</span>
                    </label>
                </div>
            </div>

            <div className="flex flex-wrap items-center bg-gray-800/50 p-4 rounded-lg mb-6 gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label htmlFor="layout-select" className="text-sm font-medium text-gray-300 mr-2">{t('layouts.selectLabel')}:</label>
                    <select id="layout-select" value={selectedLayoutId || ''} onChange={e => setSelectedLayoutId(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5">
                        {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        {layouts.length === 0 && <option>Yerleşim planı yok</option>}
                    </select>
                </div>
                <div className="flex space-x-2">
                    <button onClick={openNewLayoutModal} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">{t('btn.newLayout')}</button>
                    <button onClick={openEditLayoutModal} disabled={!selectedLayout} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{t('btn.editLayout')}</button>
                </div>
            </div>

            <div
                ref={mapRef}
                onClick={handleMapClick}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`relative bg-gray-800 rounded-lg shadow-lg aspect-video bg-cover bg-center overflow-hidden transition-all ${isPlacementMode ? 'cursor-crosshair' : 'cursor-default'} ${!selectedLayout?.imageUrl ? 'flex items-center justify-center' : ''}`}
                style={{ backgroundImage: `url('${selectedLayout?.imageUrl || ''}')` }}
            >
                {!selectedLayout?.imageUrl && <p className="text-gray-400">{t('layouts.preview.empty')}</p>}
                {filteredLocations.map(loc => (
                    <div
                        key={loc.id}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                        style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                        onClick={(e) => { e.stopPropagation(); handleMarkerClick(loc); }}
                        onMouseDown={(e) => handleMarkerDragStart(e, loc)}
                    >
                        <div className={`w-6 h-6 bg-red-500 rounded-full border-2 border-white ring-4 ring-red-500/80 hover:ring-8 hover:ring-red-400/90 transition-all shadow-lg ${draggingMarker?.id === loc.id ? 'cursor-grabbing animate-pulse' : 'cursor-grab'}`}></div>
                         <div className="absolute bottom-full mb-2 w-max p-2 text-xs text-white bg-gray-900/80 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none transform -translate-x-1/2 left-1/2">
                            {loc.name}
                            <div className="text-gray-400">{loc.nfcCardId || "Kart Yok"}</div>
                        </div>
                    </div>
                ))}
            </div>
            
            <Modal isOpen={isLocationModalOpen} onClose={closeLocationModal} title={selectedLocation ? t('modals.location.editTitle') : t('modals.location.newTitle')}>
                 <div className="space-y-4">
                    <div>
                        <label htmlFor="locationName" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.location.name')}</label>
                        <input type="text" id="locationName" value={locationName} onChange={(e) => setLocationName(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="Örn: Giriş Kapısı" />
                    </div>
                     <div>
                        <label htmlFor="nfcCard" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.location.assignCard')}</label>
                        <select id="nfcCard" value={assignedCardId} onChange={(e) => setAssignedCardId(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                            <option value="">{t('forms.location.noCardAssigned')}</option>
                            {availableCardsForDropdown.map(card => (<option key={card.id} value={card.id}>{card.id}</option>))}
                        </select>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                        <div>{selectedLocation && (<button onClick={handleDeleteLocation} className="text-red-500 hover:text-red-400 font-medium transition-colors">{t('btn.delete')}</button>)}</div>
                        <div className="flex space-x-2">
                             <button onClick={closeLocationModal} className="text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button>
                             <button onClick={handleSaveLocation} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.save')}</button>
                        </div>
                    </div>
                 </div>
            </Modal>

            <Modal isOpen={isLayoutModalOpen} onClose={() => setIsLayoutModalOpen(false)} title={editingLayout ? t('modals.layout.editTitle') : t('modals.layout.newTitle')}>
                 <div className="space-y-4">
                    <div>
                        <label htmlFor="layoutName" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.layout.name')}</label>
                        <input type="text" id="layoutName" value={layoutName} onChange={(e) => setLayoutName(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="Örn: Zemin Kat" />
                    </div>
                     <div>
                        <label htmlFor="layoutImageUrl" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.layout.imageUrl')}</label>
                        <input type="text" id="layoutImageUrl" value={layoutImageUrl} onChange={(e) => setLayoutImageUrl(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="https://example.com/plan.png" />
                    </div>
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-600"></div>
                        <span className="flex-shrink mx-4 text-gray-400 text-xs">{t('forms.or')}</span>
                        <div className="flex-grow border-t border-gray-600"></div>
                    </div>
                    <div>
                        <label htmlFor="layoutImageFile" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.layout.upload')}</label>
                        <input 
                            type="file" 
                            id="layoutImageFile" 
                            accept="image/*" 
                            onChange={handleImageUpload} 
                            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-gray-200 hover:file:bg-gray-500 cursor-pointer"
                        />
                    </div>
                    {layoutImageUrl && (
                        <div>
                            <p className="text-sm font-medium text-gray-300 mb-2">{t('forms.preview')}:</p>
                            <div className="border border-gray-600 rounded-lg p-2 bg-gray-900/50">
                                <img src={layoutImageUrl} alt="Yerleşim planı önizlemesi" className="max-h-40 w-full object-contain rounded-md" />
                            </div>
                        </div>
                    )}
                    <div className="flex justify-between items-center pt-2">
                        <div>{editingLayout && (<button onClick={handleDeleteLayout} className="text-red-500 hover:text-red-400 font-medium transition-colors">{t('btn.delete')}</button>)}</div>
                        <div className="flex space-x-2">
                             <button onClick={() => setIsLayoutModalOpen(false)} className="text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button>
                             <button onClick={handleSaveLayout} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.save')}</button>
                        </div>
                    </div>
                 </div>
            </Modal>
        </div>
    );
};

const UsersPage: FC<{ users: User[], setUsers: React.Dispatch<React.SetStateAction<User[]>> }> = ({ users, setUsers }) => {
    const { t } = useTranslation();
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [password, setPassword] = useState('');

    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [resetUserId, setResetUserId] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

    const sortedUsers = useMemo(() => 
        [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users]);

    const openNewUserModal = () => {
        setName('');
        setUsername('');
        setEmail('');
        setAvatarUrl(`https://picsum.photos/seed/${Date.now()}/100/100`);
        setIsUserModalOpen(true);
    };

    const handleSaveUser = async () => {
        if (!name || !username) {
            alert('Ad Soyad ve Kullanıcı Adı zorunludur.');
            return;
        }
        try {
            const created = await api<User>('/api/users', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    username,
                    email: email || undefined,
                    avatarUrl,
                    password: password || undefined,
                })
            });
            setUsers(prevUsers => [...prevUsers, created]);
            setIsUserModalOpen(false);
            setPassword('');
        } catch (e: any) {
            console.error('User create failed', e);
            alert('Kullanıcı oluşturulamadı. ' + (e?.message || ''));
        }
    };

    const openResetModal = (userId: string) => {
        setResetUserId(userId);
        setNewPassword('');
        setGeneratedPassword(null);
        setIsResetModalOpen(true);
    };

    const handleResetPassword = async () => {
        if (!resetUserId) return;
        try {
            const res = await api<any>(`/api/users/${resetUserId}/password`, {
                method: 'POST',
                body: JSON.stringify(newPassword ? { newPassword } : {})
            });
            if (res.temporaryPassword) {
                setGeneratedPassword(res.temporaryPassword);
            } else {
                setIsResetModalOpen(false);
            }
            setNewPassword('');
        } catch (e) {
            console.error('Password reset failed', e);
            alert('Şifre sıfırlanamadı.');
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
        try {
            await api(`/api/users/${userId}`, { method: 'DELETE' });
            setUsers(prev => prev.filter(u => u.id !== userId));
        } catch (e: any) {
            console.error('Delete user failed', e);
            alert('Kullanıcı silinemedi. Kullanıcıya atanmış görevler olabilir.');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">{t('users.title')}</h1>
                 <button onClick={openNewUserModal} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center space-x-2 transition-colors">
                    <Icons.Plus />
                    <span>{t('btn.newUser')}</span>
                </button>
            </div>
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <ul className="divide-y divide-gray-700">
                    {sortedUsers.map(user => (
                         <li key={user.id} className="p-4 flex items-center space-x-4 hover:bg-gray-700/50">
                            <img className="h-12 w-12 rounded-full object-cover" src={user.avatarUrl} alt={user.name} />
                            <div className="flex-1">
                                <p className="text-md font-semibold text-white">{user.name}</p>
                                <p className="text-sm text-gray-400 font-mono">@{user.username}</p>
                                {user.email ? <p className="text-sm text-gray-400 mt-1">{user.email}</p> : <p className="text-sm text-gray-500 mt-1 italic">{t('users.table.emailEmpty')}</p>}
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => openResetModal(user.id)} className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded">{t('btn.resetPassword')}</button>
                                <button onClick={() => handleDeleteUser(user.id)} className="text-sm bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded">{t('btn.delete')}</button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={t('modals.user.newTitle')}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="userName" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.user.name')}</label>
                        <input type="text" id="userName" value={name} onChange={e => setName(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" required />
                    </div>
                     <div>
                        <label htmlFor="userUsername" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.user.username')}</label>
                        <input type="text" id="userUsername" value={username} onChange={e => setUsername(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" required />
                    </div>
                    <div>
                        <label htmlFor="userEmail" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.user.email')}</label>
                        <input type="email" id="userEmail" value={email} onChange={e => setEmail(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                    </div>
                    <div>
                        <label htmlFor="userAvatar" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.user.avatarUrl')}</label>
                        <input type="text" id="userAvatar" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                    </div>
                    <div>
                        <label htmlFor="userPassword" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.user.password')}</label>
                        <input type="password" id="userPassword" value={password} onChange={e => setPassword(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="En az 6 karakter" />
                    </div>
                    <div className="flex justify-end items-center pt-2 space-x-2">
                        <button onClick={() => setIsUserModalOpen(false)} className="text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button>
                        <button onClick={handleSaveUser} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.createUser')}</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title={t('modals.resetPassword.title')}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="resetPassword" className="block mb-2 text-sm font-medium text-gray-300">{t('users.reset.inputLabel')}</label>
                        <input type="password" id="resetPassword" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                    </div>
                    {generatedPassword && (
                        <div className="bg-gray-700 p-3 rounded">
                            <p className="text-gray-300 text-sm">{t('users.reset.temporaryPassword')}:</p>
                            <p className="text-white font-mono text-lg">{generatedPassword}</p>
                            <p className="text-gray-400 text-xs mt-1">{t('users.reset.generatedPasswordNote')}</p>
                        </div>
                    )}
                    <div className="flex justify-end items-center pt-2 space-x-2">
                        <button onClick={() => setIsResetModalOpen(false)} className="text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.close')}</button>
                        <button onClick={handleResetPassword} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.save')}</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const CardsPage: FC<{ cards: NfcCard[], locations: Location[], setNfcCards: React.Dispatch<React.SetStateAction<NfcCard[]>> }> = ({ cards, locations, setNfcCards }) => {
    const { t } = useTranslation();
    // State for manual card entry modal
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [cardId, setCardId] = useState('');
    const [secretCode, setSecretCode] = useState('');

    // State for NFC scan and add modal
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'scanned' | 'error' | 'unsupported'>('idle');
    const [scanError, setScanError] = useState('');
    const [scanLog, setScanLog] = useState<string[]>([]);
    const [scannedSecretCode, setScannedSecretCode] = useState<string | null>(null);
    const [scannedUid, setScannedUid] = useState<string | null>(null);
    const [scannedCardId, setScannedCardId] = useState('');
    const scanAbortController = useRef<AbortController | null>(null);

    const isInIframe = useMemo(() => {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    }, []);

    const handleOpenInNewTab = () => {
        window.open(window.location.href, '_blank', 'noopener,noreferrer');
    };

    const openNewCardModal = () => {
        setCardId('');
        setSecretCode('');
        setIsCardModalOpen(true);
    };

    const handleSaveCard = () => {
        if (!cardId || !secretCode) {
            alert('Kart ID ve Özel Kod alanları zorunludur.');
            return;
        }
        if (cards.some(c => c.id === cardId)) {
            alert('Bu Kart ID zaten mevcut.');
            return;
        }
        const newCard: NfcCard = {
            id: cardId,
            secretCode,
            assignedLocationId: null,
        };
        setNfcCards(prevCards => [...prevCards, newCard]);
        setIsCardModalOpen(false);
    };

    const findLocationName = (locationId: string | null) => {
        if (!locationId) return <span className="text-gray-500">Atanmamış</span>;
        return locations.find(l => l.id === locationId)?.name || <span className="text-red-400">Bilinmeyen Nokta</span>;
    };
    
    const closeScanModal = useCallback(() => {
        if (scanAbortController.current) {
            scanAbortController.current.abort();
            scanAbortController.current = null;
        }
        setIsScanModalOpen(false);
        setScanStatus('idle');
        setScanLog([]);
    }, []);

    const openScanModal = async () => {
        setScannedCardId('');
        setScannedSecretCode(null);
        setScannedUid(null);
        setScanError('');
        setScanLog([]);
        setIsScanModalOpen(true);

        if (isInIframe) {
            setScanStatus('unsupported');
            setScanError('NFC tarama bu önizleme penceresinde çalışmaz. Lütfen uygulamayı yeni bir sekmede açın.');
            return;
        }

        if (!('NDEFReader' in window)) {
            setScanStatus('unsupported');
            setScanError('Web NFC bu cihazda veya tarayıcıda desteklenmiyor. Lütfen Android ve Chrome kullandığınızdan emin olun.');
            return;
        }
        
        setScanStatus('scanning');

        try {
            scanAbortController.current = new AbortController();
            // @ts-ignore
            const reader = new NDEFReader();

            const scanTimeout = setTimeout(() => {
                scanAbortController.current?.abort();
                setScanStatus('error');
                setScanError('Tarama zaman aşımına uğradı. Lütfen tekrar deneyin ve kartı cihaza yakın tuttuğunuzdan emin olun.');
            }, 30000);

            reader.onreading = (event: any) => {
                clearTimeout(scanTimeout);
                const { message, serialNumber } = event;
                
                if (cards.some(c => c.uid && c.uid === serialNumber)) {
                    setScanStatus('error');
                    setScanError('Bu kart (UID ile) zaten sisteme kayıtlı.');
                    return;
                }

                let foundSecretCode: string | null = null;
                const decoder = new TextDecoder();
                const logs: string[] = [`- Kart UID: ${serialNumber}`];

                if (!message.records || message.records.length === 0) {
                    setScanStatus('error');
                    setScanError('NFC kartı okundu ancak içinde okunabilir bir veri bulunamadı. Kart boş olabilir.');
                    return;
                }
                
                for (const record of message.records) {
                     let dataPreview = '[Veri yok]';
                     if (record.data) {
                        try {
                           const decodedData = decoder.decode(record.data);
                           dataPreview = `"${decodedData}"`;
                           // Sadece 'text' tipindeki kayıtları özel kod olarak kabul et
                           if (record.recordType === 'text' && !foundSecretCode) {
                               foundSecretCode = decodedData;
                           }
                        } catch(e) { 
                            dataPreview = '[Okunamayan Binary Veri]';
                        }
                    }
                    logs.push(`- Tip: ${record.recordType} | Medya Tipi: ${record.mediaType || 'yok'} | Veri: ${dataPreview}`);
                }
                setScanLog(logs);

                if (!foundSecretCode) {
                     setScanStatus('error');
                     setScanError('Kartta okunabilir bir "text" (metin) verisi bulunamadı. Lütfen kartın sisteme uygun olduğundan emin olun.');
                     return;
                }
                
                const secretCode = foundSecretCode.trim();

                if (cards.some(c => c.secretCode === secretCode)) {
                    setScanStatus('error');
                    setScanError('Bu özel koda sahip bir kart zaten sisteme kayıtlı.');
                    return;
                }
                
                setScannedUid(serialNumber);
                setScannedSecretCode(secretCode);
                setScanStatus('scanned');
                setScannedCardId(`NFC${String(cards.length + 1).padStart(3, '0')}`);
                scanAbortController.current?.abort();
            };
            
            reader.onreadingerror = () => {
                clearTimeout(scanTimeout);
                setScanStatus('error');
                setScanError('Kart okunurken bir hata oluştu. Lütfen tekrar deneyin.');
            };
            
            await reader.scan({ signal: scanAbortController.current.signal });

        } catch (error: any) {
            let errorMessage = `Tarama başlatılamadı: ${error.message}`;
            if (error.name === 'NotAllowedError') {
                errorMessage = 'NFC taraması için izin verilmedi. Lütfen tarayıcı ayarlarından bu site için NFC iznini kontrol edin.';
            } else if (error.name === 'NotSupportedError') {
                 errorMessage = 'Web NFC bu cihazda veya tarayıcıda desteklenmiyor.';
            } else if (error.name === 'AbortError') {
                return; // User cancelled, do nothing.
            }
            setScanStatus('error');
            setScanError(errorMessage);
        }
    };

    const handleSaveScannedCard = () => {
        if (!scannedCardId || !scannedSecretCode) {
            alert('Kart ID ve taranan kod olmadan kaydedilemez.');
            return;
        }
        if (cards.some(c => c.id === scannedCardId)) {
            alert('Bu Kart ID zaten mevcut.');
            return;
        }
        const newCard: NfcCard = {
            id: scannedCardId,
            secretCode: scannedSecretCode,
            uid: scannedUid || undefined,
            assignedLocationId: null,
        };
        setNfcCards(prevCards => [...prevCards, newCard]);
        closeScanModal();
    };

    const ScanLogDisplay = () => (
        scanLog.length > 0 ? (
            <div className="mt-4 p-3 bg-gray-900/70 border border-gray-600 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Tarama Detayları:</h4>
                <div className="text-xs text-gray-400 font-mono space-y-1">
                    {scanLog.map((log, index) => <p key={index}>{log}</p>)}
                </div>
            </div>
        ) : null
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">{t('cards.title')}</h1>
                <div className="flex space-x-2">
                    <button onClick={openScanModal} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center space-x-2 transition-colors">
                        <Icons.Nfc />
                        <span>{t('btn.scanAndAdd')}</span>
                    </button>
                    <button onClick={openNewCardModal} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center space-x-2 transition-colors">
                        <Icons.Plus />
                        <span>{t('btn.addCard')}</span>
                    </button>
                </div>
            </div>
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-300">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-3">{t('cards.table.cardId')}</th>
                            <th scope="col" className="px-6 py-3">{t('cards.table.uid')}</th>
                            <th scope="col" className="px-6 py-3">{t('cards.table.secret')}</th>
                            <th scope="col" className="px-6 py-3">{t('cards.table.assignedLocation')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cards.map(card => (
                            <tr key={card.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50">
                                <td className="px-6 py-4 font-mono text-white">{card.id}</td>
                                <td className="px-6 py-4 font-mono text-gray-400">{card.uid || t('cards.table.notAvailable')}</td>
                                <td className="px-6 py-4 font-mono text-cyan-400">{card.secretCode}</td>
                                <td className="px-6 py-4">{findLocationName(card.assignedLocationId)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={isCardModalOpen} onClose={() => setIsCardModalOpen(false)} title={t('modals.card.manualTitle')}>
                 <div className="space-y-4">
                    <div>
                        <label htmlFor="cardId" className="block mb-2 text-sm font-medium text-gray-300">Kart ID</label>
                        <input type="text" id="cardId" value={cardId} onChange={e => setCardId(e.target.value.toUpperCase())} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="NFC006" required />
                    </div>
                    <div>
                        <label htmlFor="secretCode" className="block mb-2 text-sm font-medium text-gray-300">Özel Kod</label>
                        <input type="text" id="secretCode" value={secretCode} onChange={e => setSecretCode(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="a1b2c3d4" required />
                    </div>
                     <div className="flex justify-end items-center pt-2 space-x-2">
                        <button onClick={() => setIsCardModalOpen(false)} className="text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button>
                        <button onClick={handleSaveCard} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.saveCard')}</button>
                    </div>
                </div>
            </Modal>
            <Modal isOpen={isScanModalOpen} onClose={closeScanModal} title={t('modals.card.scanTitle')}>
                {scanStatus === 'scanning' && (
                    <div className="text-center p-4">
                         <div className="flex justify-center items-center mb-4">
                            <div className="relative flex h-20 w-20">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-20 w-20 bg-blue-500 items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                </span>
                            </div>
                        </div>
                        <p className="text-lg text-white">{t('cards.scan.instructions')}</p>
                        <p className="text-sm text-gray-400 mt-2">{t('cards.scan.autoStart')}</p>
                        <button onClick={closeScanModal} className="mt-6 text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button>
                    </div>
                )}
                {(scanStatus === 'error' || scanStatus === 'unsupported') && (
                     <div className="p-4">
                        <div className="text-center bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg">
                             <p className="font-semibold mb-2">{t('cards.scan.errorTitle')}</p>
                             <p className="text-sm">{scanError}</p>
                        </div>
                        <ScanLogDisplay />
                        {isInIframe && (
                            <button 
                                onClick={handleOpenInNewTab} 
                                className="mt-4 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-3 rounded-md transition-colors"
                            >
                                {t('cards.scan.openNewTab')}
                            </button>
                        )}
                         <button onClick={closeScanModal} className="mt-4 w-full text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.close')}</button>
                    </div>
                )}
                {scanStatus === 'scanned' && (
                    <div className="space-y-4">
                        <div className="text-center bg-green-900/50 border border-green-700 text-green-300 p-3 rounded-lg">
                            <p className="font-semibold">{t('cards.scan.success')}</p>
                        </div>
                        <ScanLogDisplay />
                        <div>
                            <label htmlFor="scannedUid" className="block mb-2 text-sm font-medium text-gray-300">{t('cards.scan.uidLabel')}</label>
                            <input type="text" id="scannedUid" value={scannedUid || ''} className="bg-gray-900 border border-gray-600 text-gray-400 font-mono text-sm rounded-lg block w-full p-2.5" readOnly />
                        </div>
                        <div>
                            <label htmlFor="scannedSecretCode" className="block mb-2 text-sm font-medium text-gray-300">{t('cards.scan.secretLabel')}</label>
                            <input type="text" id="scannedSecretCode" value={scannedSecretCode || ''} className="bg-gray-900 border border-gray-600 text-cyan-400 font-mono text-sm rounded-lg block w-full p-2.5" readOnly />
                        </div>
                        <div>
                            <label htmlFor="scannedCardId" className="block mb-2 text-sm font-medium text-gray-300">{t('cards.scan.newIdLabel')}</label>
                            <input type="text" id="scannedCardId" value={scannedCardId} onChange={e => setScannedCardId(e.target.value.toUpperCase())} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="Örn: NFC007" required />
                        </div>
                        <div className="flex justify-end items-center pt-2 space-x-2">
                            <button onClick={closeScanModal} className="text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button>
                            <button onClick={handleSaveScannedCard} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.saveScannedCard')}</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};


// --- LOGIN COMPONENT ---
type LoggedInUser = User | { id: 'admin'; name: 'Admin'; avatarUrl: string };

const LoginPage: FC<{ onLoginSuccess: (user: LoggedInUser) => void, users: User[] }> = ({ onLoginSuccess, users }) => {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (username === 'admin' && password === '123456') {
            onLoginSuccess({ id: 'admin', name: 'Admin', avatarUrl: 'https://i.imgur.com/k73bB6w.png' });
            return;
        }

        const foundUser = users.find(u => u.username === username);
        if (foundUser && password === '123456') {
            onLoginSuccess(foundUser);
            return;
        }

        setError('Kullanıcı adı veya şifre hatalı.');
    };

    const handleQuickLogin = (userType: 'admin' | 'ahmet') => {
        if (userType === 'admin') {
            onLoginSuccess({ id: 'admin', name: 'Admin', avatarUrl: 'https://i.imgur.com/k73bB6w.png' });
        } else {
            const ahmetUser = users.find(u => u.username === 'ahmet');
            if (ahmetUser) {
                onLoginSuccess(ahmetUser);
            } else {
                setError('Test kullanıcısı "ahmet" bulunamadı.');
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md">
                <form onSubmit={handleLogin} className="bg-gray-800 shadow-2xl rounded-lg px-8 pt-6 pb-8 mb-4">
                    <div className="mb-6 text-center">
                         <div className="inline-flex items-center justify-center space-x-3 mb-4">
                            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                            <h1 className="text-white text-2xl font-bold">{t('app.title')}</h1>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="username">
                            {t('login.username')}
                        </label>
                        <input className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" id="username" type="text" placeholder={t('login.usernamePlaceholder')} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="password">
                            {t('login.password')}
                        </label>
                        <input className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" id="password" type="password" placeholder="******************" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    {error && <p className="text-red-500 text-xs italic mb-4 text-center">{error}</p>}
                    <div className="flex items-center justify-between">
                        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors" type="submit">
                            {t('login.submit')}
                        </button>
                    </div>
                    <div className="relative flex pt-8 pb-4 items-center">
                        <div className="flex-grow border-t border-gray-700"></div>
                        <span className="flex-shrink mx-4 text-gray-500 text-xs">{t('login.quickLogin')}</span>
                        <div className="flex-grow border-t border-gray-700"></div>
                    </div>
                     <div className="flex items-center justify-center space-x-2">
                         <button
                            type="button"
                            onClick={() => handleQuickLogin('ahmet')}
                            className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors text-sm"
                        >
                            {t('login.asAhmet')}
                        </button>
                         <button
                            type="button"
                            onClick={() => handleQuickLogin('admin')}
                            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors text-sm"
                        >
                            {t('login.asAdmin')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- MOBILE USER VIEW ---

const MobileUserView: FC<{
    currentUser: User;
    tasks: Task[];
    locations: Location[];
    nfcCards: NfcCard[];
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    onLogout: () => void;
    onViewAttachments: (task: Task) => void;
}> = ({ currentUser, tasks, locations, nfcCards, setTasks, onLogout, onViewAttachments }) => {
    const { t } = useTranslation();
    const myActiveTasks = useMemo(() => {
        return tasks.filter(t => t.userId === currentUser.id && t.status !== TaskStatus.Completed)
            .sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime());
    }, [tasks, currentUser.id]);

    const myCompletedTasks = useMemo(() => {
        return tasks.filter(t => t.userId === currentUser.id && t.status === TaskStatus.Completed)
            .sort((a, b) => (b.lastCompletedAt?.getTime() || 0) - (a.lastCompletedAt?.getTime() || 0))
            .slice(0, 10); // Son 10 tamamlanan görevi göster
    }, [tasks, currentUser.id]);

    const [isNfcModalOpen, setIsNfcModalOpen] = useState(false);
    const [scannedLocation, setScannedLocation] = useState<Location | null>(null);
    const [tasksForLocation, setTasksForLocation] = useState<Task[]>([]);
    const [nfcStatus, setNfcStatus] = useState<'idle' | 'scanning' | 'error' | 'unsupported'>('idle');
    const [nfcError, setNfcError] = useState('');
    const [completionNotes, setCompletionNotes] = useState<{ [key: string]: string }>({});
    const nfcAbortController = useRef<AbortController | null>(null);

    const isInIframe = useMemo(() => {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true; // Assume iframe if check fails due to security
        }
    }, []);

    const handleOpenInNewTab = () => {
        window.open(window.location.href, '_blank', 'noopener,noreferrer');
    };

    const handleCompleteTask = async (taskId: string, notes: string) => {
        try {
            await api(`/api/tasks/${taskId}/complete`, {
                method: 'POST',
                body: JSON.stringify({ notes })
            });
            // Refresh tasks to capture any repeated task created by backend
            const tks = await api<any[]>('/api/tasks');
            setTasks(tks.map(parseTask));
            setCompletionNotes(prev => ({ ...prev, [taskId]: '' }));
        } catch (e) {
            console.error('Complete failed', e);
            alert('Görev tamamlanamadı.');
        } finally {
            closeNfcModal();
        }
    };
    
    const closeNfcModal = () => {
        if (nfcAbortController.current) {
            nfcAbortController.current.abort();
            nfcAbortController.current = null;
        }
        setIsNfcModalOpen(false);
        setNfcStatus('idle');
    };

    const startNfcScan = async () => {
        if (isInIframe) {
            setNfcStatus('unsupported');
            setNfcError('NFC tarama bu önizleme penceresinde çalışmaz. Lütfen bu pencereyi kapatıp "Yeni Sekmede Aç" butonunu kullanın.');
            setIsNfcModalOpen(true);
            return;
        }
        
        if (!('NDEFReader' in window)) {
            setNfcStatus('unsupported');
            setNfcError('Web NFC bu cihazda veya tarayıcıda desteklenmiyor. Lütfen Android ve Chrome kullandığınızdan emin olun.');
            setIsNfcModalOpen(true);
            return;
        }

        setNfcStatus('scanning');
        setScannedLocation(null);
        setTasksForLocation([]);
        setCompletionNotes({});
        setIsNfcModalOpen(true);

        try {
            nfcAbortController.current = new AbortController();
            // @ts-ignore
            const reader = new NDEFReader();
            
            reader.onreading = (event: any) => {
                const decoder = new TextDecoder();
                const scannedUid = event.serialNumber;
                let foundMatch = false;

                for (const record of event.message.records) {
                    if (record.data) {
                        try {
                            const secretCode = decoder.decode(record.data).trim();
                            const foundCard = nfcCards.find(c => c.secretCode === secretCode && c.uid === scannedUid);

                            if (foundCard && foundCard.assignedLocationId) {
                                const location = locations.find(l => l.id === foundCard.assignedLocationId);
                                if (location) {
                                    const userTasksAtLocation = tasks.filter(t => 
                                        t.locationId === location.id &&
                                        t.userId === currentUser.id &&
                                        t.status !== TaskStatus.Completed
                                    );
                                    setScannedLocation(location);
                                    setTasksForLocation(userTasksAtLocation);
                                    setNfcStatus('idle');
                                    foundMatch = true;
                                    nfcAbortController.current?.abort();
                                    return;
                                }
                            }
                        } catch (e) {
                            console.error("Kullanıcı görünümünde veri okuma hatası:", e);
                        }
                    }
                }

                if (!foundMatch) {
                     setNfcStatus('error');
                     setNfcError('Geçerli bir NFC kartı okutulmadı. Kartın UID ve Özel Kodu sistemdekiyle eşleşmiyor veya kart bir noktaya atanmamış.');
                }
            };
            
            await reader.scan({ signal: nfcAbortController.current.signal });

        } catch (error: any) {
            if (error.name === 'AbortError') return;
            setNfcStatus('error');
            setNfcError(`Tarama sırasında bir hata oluştu: ${error.message}`);
        }
    };
    
    const timeFormatter = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
            <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full" />
                    <div>
                        <p className="text-sm text-gray-400">{t('userView.welcome')}</p>
                        <h1 className="text-lg font-bold text-white">{currentUser.name}</h1>
                    </div>
                </div>
                <button onClick={onLogout} title={t('btn.logout')}>
                    <Icons.Logout />
                </button>
            </header>
            
            <main className="flex-1 p-4 pb-32">
                <h2 className="text-xl font-semibold text-white mb-4">Aktif Görevlerin ({myActiveTasks.length})</h2>
                {myActiveTasks.length > 0 ? (
                    <ul className="space-y-3">
                        {myActiveTasks.map(task => (
                            <li key={task.id} className="bg-gray-800 p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white break-words">{task.title}</p>
                                        <p className="text-sm text-gray-400 mt-1">{locations.find(l => l.id === task.locationId)?.name}</p>
                                    </div>
                                    <div className="flex-shrink-0 ml-2">
                                        <DynamicTaskStatusLabel task={task} />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                     <p className="text-xs text-yellow-400">Bitiş: {timeFormatter.format(task.dueDate)}</p>
                                      {task.attachments.length > 0 && (
                                        <button onClick={() => onViewAttachments(task)} className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300">
                                            <Icons.Attachment />
                                            <span className="text-xs">{task.attachments.length}</span>
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center text-gray-500 mt-10">
                        <p>{t('userView.noActiveTasks')}</p>
                        <p className="text-sm mt-2">{t('userView.wellDone')}</p>
                    </div>
                )}

                <div className="mt-8 pt-6 border-t border-gray-700/50">
                    <h2 className="text-xl font-semibold text-white mb-4">{t('userView.recentCompleted')}</h2>
                    {myCompletedTasks.length > 0 ? (
                        <ul className="space-y-3">
                            {myCompletedTasks.map(task => (
                                <li key={task.id} className="bg-gray-800/70 p-4 rounded-lg shadow-sm border-l-4 border-green-500 opacity-80">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-gray-300 line-through">{task.title}</p>
                                            <p className="text-sm text-gray-500 mt-1">{locations.find(l => l.id === task.locationId)?.name}</p>
                                        </div>
                                        <DynamicTaskStatusLabel task={task} />
                                    </div>
                                    {task.lastCompletedAt && (
                                        <p className="text-xs text-gray-400 mt-2">Tamamlandı: {timeFormatter.format(task.lastCompletedAt)}</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center text-gray-500 mt-10">
                            <p>{t('userView.noCompletedTasks')}</p>
                        </div>
                    )}
                </div>
            </main>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700">
                 {isInIframe && (
                    <div className="mb-3 text-center bg-yellow-900/50 border border-yellow-700 text-yellow-300 p-3 rounded-lg text-sm">
                        <p className="font-semibold">{t('userView.iframeError.title')}</p>
                        <p className="text-xs mt-1 mb-2 text-yellow-400">{t('userView.iframeError.description')}</p>
                        <button 
                            onClick={handleOpenInNewTab} 
                            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-3 rounded-md transition-colors"
                        >
                            {t('cards.scan.openNewTab')}
                        </button>
                    </div>
                )}
                <button onClick={startNfcScan} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-lg inline-flex items-center justify-center space-x-3 transition-colors text-lg shadow-lg">
                    <Icons.Nfc />
                    <span>{t('userView.scanNfc')}</span>
                </button>
            </div>

            <Modal isOpen={isNfcModalOpen} onClose={closeNfcModal} title="NFC Tarama">
                {nfcStatus === 'scanning' && (
                    <div className="text-center p-4">
                        <div className="flex justify-center items-center mb-4">
                            <div className="relative flex h-20 w-20">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-20 w-20 bg-blue-500 items-center justify-center">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                </span>
                            </div>
                        </div>
                        <p className="text-lg text-white">{t('cards.scan.instructions')}</p>
                        <button onClick={closeNfcModal} className="mt-6 text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button>
                    </div>
                )}
                {(nfcStatus === 'error' || nfcStatus === 'unsupported') && (
                     <div className="text-center p-4">
                        <p className="text-lg text-red-400 mb-2">{t('cards.scan.errorTitle')}</p>
                        <p className="text-gray-300">{nfcError}</p>
                         <button onClick={closeNfcModal} className="mt-4 text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.close')}</button>
                    </div>
                )}
                {scannedLocation && (
                    <div>
                        <h3 className="text-lg font-bold text-blue-400 mb-3">{scannedLocation.name}</h3>
                        {tasksForLocation.length > 0 ? (
                            <ul className="space-y-3">
                                {tasksForLocation.map(task => (
                                    <li key={task.id} className="bg-gray-700 p-3 rounded-lg">
                                        <p className="font-semibold text-white">{task.title}</p>
                                        <p className="text-sm text-gray-300 my-2">{task.description}</p>
                                        <div className="mt-3">
                                            <label htmlFor={`notes-${task.id}`} className="block mb-1 text-xs font-medium text-gray-400">{t('tasks.form.completionNotes')}</label>
                                            <textarea
                                                id={`notes-${task.id}`}
                                                rows={2}
                                                value={completionNotes[task.id] || ''}
                                                onChange={(e) => setCompletionNotes(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                                                placeholder="Örn: Cihazda sızıntı tespit edildi."
                                            />
                                        </div>
                                        <button 
                                            onClick={() => handleCompleteTask(task.id, completionNotes[task.id] || '')}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-md transition-colors mt-3"
                                        >
                                            {t('btn.completeTask')}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-400 text-center py-4">{t('userView.noTasksAtLocation')}</p>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};


// --- Main App Component ---

const AppWithContext: FC = () => {
    const [locale, setLocale] = useState<Locale>(() => {
        const saved = localStorage.getItem('locale');
        return (saved === 'tr' || saved === 'en') ? saved : 'en';
    });

    useEffect(() => {
        localStorage.setItem('locale', locale);
    }, [locale]);

    const i18nValue = useMemo(() => ({ locale, setLocale, t: (key: string) => translations[locale]?.[key] ?? key }), [locale]);

    return <LocaleContext.Provider value={i18nValue}><App /></LocaleContext.Provider>
}

const App: FC = () => {
    const { t, locale, setLocale } = useTranslation();
    const navItems: { id: Page; icon: React.ReactNode }[] = [
        { id: 'dashboard', icon: <Icons.Dashboard /> },
        { id: 'board', icon: <Icons.Board /> },
        { id: 'tasks', icon: <Icons.Tasks /> },
        { id: 'layouts', icon: <Icons.Layouts /> },
        { id: 'users', icon: <Icons.Users /> },
        { id: 'cards', icon: <Icons.Cards /> },
    ];
    const getInitialPage = (): Page => {
        const hash = window.location.hash.substring(1);
        // Ensure the hash corresponds to a valid page to prevent unexpected states.
        if (navItems.some(item => item.id === hash)) {
            return hash as Page;
        }
        return 'dashboard';
    };

    const [page, setPage] = useState<Page>(getInitialPage);
    const [users, setUsers] = useState<User[]>([]);
    const [nfcCards, setNfcCards] = useState<NfcCard[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [layouts, setLayouts] = useState<Layout[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<LoggedInUser | null>(null);

    const [activeModalTask, setActiveModalTask] = useState<Task | 'new' | null>(null);
    const [viewingAttachmentsTask, setViewingAttachmentsTask] = useState<Task | null>(null);

    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskLocationId, setTaskLocationId] = useState('');
    const [taskUserId, setTaskUserId] = useState('');
    const [taskDueDate, setTaskDueDate] = useState('');
    const [taskRepeatUnit, setTaskRepeatUnit] = useState<'none' | 'hours' | 'days'>('none');
    const [taskRepeatFrequency, setTaskRepeatFrequency] = useState<number>(1);
    const [taskAttachments, setTaskAttachments] = useState<Attachment[]>([]);
    
    const attachmentInputRef = useRef<HTMLInputElement>(null);

    // Load initial data from backend
    useEffect(() => {
        const load = async () => {
            try {
                const [u, lcs, cds, tks, lys] = await Promise.all([
                    api<User[]>('/api/users'),
                    api<Location[]>('/api/locations'),
                    api<NfcCard[]>('/api/cards'),
                    api<any[]>('/api/tasks'),
                    api<Layout[]>('/api/layouts').catch(() => [] as Layout[]),
                ]);
                setUsers(u);
                setLocations(lcs);
                setNfcCards(cds);
                setTasks(tks.map(parseTask));
                const mappedLayouts = lys.map(l => {
                    if (l.id === 'layout1') return { ...l, imageUrl: layout1Img };
                    if (l.id === 'layout2') return { ...l, imageUrl: layout2Img };
                    return l;
                });
                setLayouts(mappedLayouts);
            } catch (e) {
                console.error('Initial data load failed:', e);
            }
        };
        load();
    }, []);

    // Effect for handling browser back/forward navigation
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            const pageFromState = event.state?.page;
            if (pageFromState && navItems.some(item => item.id === pageFromState)) {
                setPage(pageFromState);
            } else {
                // Fallback to hash or default if state is null (e.g., initial load)
                setPage(getInitialPage());
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);


    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const newAttachments: Attachment[] = [];
        for (const file of Array.from(files)) {
            const fileUrl = await fileToBase64(file);
            newAttachments.push({
                id: `att_${Date.now()}_${Math.random()}`,
                name: file.name,
                type: file.type,
                size: file.size,
                url: fileUrl,
            });
        }
        setTaskAttachments(prev => [...prev, ...newAttachments]);
    };

    const removeAttachment = (id: string) => {
        setTaskAttachments(prev => prev.filter(att => att.id !== id));
    };

    const resetTaskModal = () => {
        setTaskTitle('');
        setTaskDescription('');
        setTaskLocationId(locations[0]?.id || '');
        setTaskUserId(users[0]?.id || '');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        setTaskDueDate(tomorrow.toISOString().slice(0, 16));
        setTaskRepeatUnit('none');
        setTaskRepeatFrequency(1);
        setTaskAttachments([]);
    };

    const openNewTaskModal = () => {
        resetTaskModal();
        setActiveModalTask('new');
    };

    const openEditTaskModal = (task: Task) => {
        setTaskTitle(task.title);
        setTaskDescription(task.description);
        setTaskLocationId(task.locationId);
        setTaskUserId(task.userId);
        setTaskDueDate(new Date(task.dueDate.getTime() - (task.dueDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16));
        setTaskRepeatUnit(task.repeat?.unit || 'none');
        setTaskRepeatFrequency(task.repeat?.frequency || 1);
        setTaskAttachments(task.attachments || []);
        setActiveModalTask(task);
    };

    const handleSaveTask = async () => {
        if (!taskTitle || !taskLocationId || !taskUserId || !taskDueDate) {
            alert('Lütfen başlık, nokta, kullanıcı ve bitiş tarihi alanlarını doldurun.');
            return;
        }

        const taskData = {
            title: taskTitle,
            description: taskDescription,
            locationId: taskLocationId,
            userId: taskUserId,
            dueDate: new Date(taskDueDate),
            // attachments local only for now
            repeat: taskRepeatUnit !== 'none' 
                ? { unit: taskRepeatUnit, frequency: taskRepeatFrequency } 
                : null,
        };

        try {
            if (activeModalTask === 'new') {
                const created = await api<any>('/api/tasks', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...taskData,
                        status: TaskStatus.ToDo,
                        // send ISO string for dueDate
                        dueDate: new Date(taskData.dueDate).toISOString(),
                    })
                });
                const parsed = parseTask(created);
                // keep any locally added attachments in UI
                parsed.attachments = taskAttachments;
                setTasks(prev => [parsed, ...prev]);
            } else if (activeModalTask) {
                const updated = await api<any>(`/api/tasks/${activeModalTask.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        ...taskData,
                        status: activeModalTask.status,
                        dueDate: new Date(taskData.dueDate).toISOString(),
                    })
                });
                const parsed = parseTask(updated);
                parsed.attachments = taskAttachments;
                setTasks(prev => prev.map(t => t.id === parsed.id ? parsed : t));
            }
        } catch (e) {
            console.error('Task save failed', e);
            alert('Görev kaydedilemedi.');
        }

        setActiveModalTask(null);
    };
    
    const handleNavClick = (selectedPage: Page) => {
        if (page !== selectedPage) {
            setPage(selectedPage);
            window.history.pushState({ page: selectedPage }, '', `#${selectedPage}`);
        }
        setIsSidebarOpen(false);
    }
    
    const renderAdminPage = () => {
        switch (page) {
            case 'dashboard':
                return <DashboardPage tasks={tasks} locations={locations} users={users} cards={nfcCards} />;
            case 'board':
                return <KanbanPage tasks={tasks} users={users} locations={locations} setTasks={setTasks} onEditTask={openEditTaskModal} onViewAttachments={setViewingAttachmentsTask} />;
            case 'tasks':
                return <TasksPage tasks={tasks} users={users} locations={locations} setTasks={setTasks} currentUser={currentUser as User} onNewTask={openNewTaskModal} onEditTask={openEditTaskModal} onViewAttachments={setViewingAttachmentsTask} />;
            case 'layouts':
                return <LayoutsPage 
                    locations={locations} 
                    cards={nfcCards} 
                    layouts={layouts}
                    setLocations={setLocations} 
                    setNfcCards={setNfcCards} 
                    setLayouts={setLayouts}
                />;
            case 'users':
                return <UsersPage users={users} setUsers={setUsers} />;
            case 'cards':
                return <CardsPage cards={nfcCards} locations={locations} setNfcCards={setNfcCards} />;
            default:
                return <DashboardPage tasks={tasks} locations={locations} users={users} cards={nfcCards} />;
        }
    };
    
    const AdminSidebar = () => (
         <aside className={`bg-gray-800 text-gray-200 w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out z-20 shadow-lg flex flex-col`}>
             <div>
                <div className="px-4 flex items-center space-x-2 mb-8">
                    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                    <span className="text-white text-xl font-bold">{t('app.title')}</span>
                </div>
                <nav>
                    {navItems.map(item => (
                        <a
                            key={item.id}
                            href={`#${item.id}`}
                            onClick={(e) => { e.preventDefault(); handleNavClick(item.id); }}
                            className={`flex items-center space-x-3 py-2.5 px-4 rounded transition duration-200 hover:bg-blue-600 hover:text-white ${page === item.id ? 'bg-blue-600 text-white' : ''}`}
                        >
                            {item.icon}
                            <span>{t(`nav.${item.id}`)}</span>
                        </a>
                    ))}
                </nav>
            </div>
            <div className="mt-auto">
                <div className="px-4 py-3 border-t border-gray-700">
                    <label htmlFor="language-select" className="block mb-2 text-sm font-medium text-gray-400">{t('lang.label')}</label>
                    <select
                        id="language-select"
                        value={locale}
                        onChange={e => setLocale(e.target.value as Locale)}
                        className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                        <option value="tr">{t('lang.tr')}</option>
                        <option value="en">{t('lang.en')}</option>
                    </select>
                </div>
                <div className="px-4 py-3 border-t border-gray-700">
                     {currentUser && (
                        <div className="flex items-center space-x-3">
                            <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full"/>
                            <div>
                                <p className="font-semibold text-white">{currentUser.name}</p>
                            </div>
                        </div>
                     )}
                </div>
                <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); setCurrentUser(null); }}
                    className="flex items-center space-x-3 py-2.5 px-4 rounded transition duration-200 hover:bg-red-600/50 hover:text-white"
                >
                    <Icons.Logout /> 
                    <span>{t('btn.logout')}</span>
                </a>
            </div>
        </aside>
    );
    
    if (!currentUser) {
        return <LoginPage onLoginSuccess={setCurrentUser} users={users} />;
    }
    
    if (currentUser.id !== 'admin') {
        return <>
            <MobileUserView 
                currentUser={currentUser as User}
                tasks={tasks}
                locations={locations}
                nfcCards={nfcCards}
                setTasks={setTasks}
                onLogout={() => setCurrentUser(null)}
                onViewAttachments={setViewingAttachmentsTask}
            />
            {viewingAttachmentsTask && (
                <Modal isOpen={!!viewingAttachmentsTask} onClose={() => setViewingAttachmentsTask(null)} title={`Ekler: ${viewingAttachmentsTask.title}`}>
                    <div className="space-y-3">
                        {viewingAttachmentsTask.attachments.length > 0 ? (
                            viewingAttachmentsTask.attachments.map(att => (
                                <div key={att.id} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="text-white font-medium">{att.name}</p>
                                        <p className="text-xs text-gray-400">{(att.size / 1024).toFixed(2)} KB - {att.type}</p>
                                    </div>
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-semibold">Görüntüle</a>
                                </div>
                            ))
                        ) : <p className="text-gray-400">Bu görev için ek dosya bulunmuyor.</p>}
                    </div>
                </Modal>
            )}
        </>
    }

    return (
        <div className="relative min-h-screen md:flex bg-gray-900 text-gray-100">
            <div className="md:hidden flex justify-between items-center p-4 bg-gray-800">
                <span className="text-white text-xl font-bold">{t('app.title')}</span>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
                </button>
            </div>
            <AdminSidebar />
            <main className="flex-1 p-6 md:p-10 overflow-y-auto">
                {renderAdminPage()}
            </main>
            
            <Modal isOpen={!!activeModalTask} onClose={() => setActiveModalTask(null)} title={activeModalTask === 'new' ? t('modals.task.newTitle') : t('modals.task.editTitle')} size="lg" variant="right">
                 <div className="space-y-4">
                    <div>
                        <label htmlFor="taskTitle" className="block mb-2 text-sm font-medium text-gray-300">{t('tasks.form.title')}</label>
                        <input type="text" id="taskTitle" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="Örn: Makine kontrolü" required />
                    </div>
                    <div>
                        <label htmlFor="taskDescription" className="block mb-2 text-sm font-medium text-gray-300">{t('tasks.form.description')}</label>
                        <textarea id="taskDescription" rows={3} value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="Görevin detayları..."></textarea>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="taskLocation" className="block mb-2 text-sm font-medium text-gray-300">{t('tasks.form.location')}</label>
                            <select id="taskLocation" value={taskLocationId} onChange={(e) => setTaskLocationId(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                               {locations.length > 0 ? locations.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>)) : <option disabled>Önce bir nokta oluşturun</option>}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="taskUser" className="block mb-2 text-sm font-medium text-gray-300">{t('tasks.form.assignee')}</label>
                            <select id="taskUser" value={taskUserId} onChange={(e) => setTaskUserId(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                {users.length > 0 ? users.map(user => (<option key={user.id} value={user.id}>{user.name}</option>)) : <option disabled>Önce bir kullanıcı oluşturun</option>}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="taskDueDate" className="block mb-2 text-sm font-medium text-gray-300">{t('tasks.form.dueDate')}</label>
                        <input type="datetime-local" id="taskDueDate" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-300">{t('tasks.form.repeat')}</label>
                        <div className="flex items-center space-x-2">
                             <select 
                                id="taskRepeatUnit" 
                                value={taskRepeatUnit} 
                                onChange={(e) => setTaskRepeatUnit(e.target.value as 'none' | 'hours' | 'days')} 
                                className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-1/3 p-2.5"
                            >
                                <option value="none">{t('tasks.form.repeatOption.none')}</option>
                                <option value="hours">{t('tasks.form.repeatOption.hours')}</option>
                                <option value="days">{t('tasks.form.repeatOption.days')}</option>
                            </select>
                            {taskRepeatUnit !== 'none' && (
                                <div className="flex items-center space-x-2 flex-1">
                                    <span className="text-gray-400">{t('tasks.form.repeatEvery')}</span>
                                    <input 
                                        type="number" 
                                        id="taskRepeatFrequency"
                                        value={taskRepeatFrequency}
                                        onChange={(e) => setTaskRepeatFrequency(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                        min="1"
                                        className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                    />
                                    <span className="text-gray-400">{t(`tasks.form.repeatInterval.${taskRepeatUnit}`)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    {activeModalTask && activeModalTask !== 'new' && activeModalTask.status === TaskStatus.Completed && activeModalTask.completionNotes && (
                        <div>
                            <label htmlFor="completionNotes" className="block mb-2 text-sm font-medium text-gray-300">{t('tasks.form.completionNotes')}</label>
                            <textarea 
                                id="completionNotes" 
                                rows={3} 
                                value={activeModalTask.completionNotes} 
                                className="bg-gray-900 border border-gray-600 text-gray-400 text-sm rounded-lg block w-full p-2.5 cursor-not-allowed" 
                                readOnly 
                            />
                        </div>
                    )}
                    <div>
                         <label className="block mb-2 text-sm font-medium text-gray-300">Dosya Ekleri</label>
                         <div className="bg-gray-700/50 border-2 border-dashed border-gray-600 rounded-lg p-4 text-center">
                            <input type="file" multiple ref={attachmentInputRef} onChange={handleFileChange} className="hidden" id="file-upload"/>
                             <button onClick={() => attachmentInputRef.current?.click()} className="bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                                {t('tasks.form.addAttachment')}
                            </button>
                         </div>
                         {taskAttachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {taskAttachments.map(att => (
                                    <div key={att.id} className="bg-gray-700 p-2 rounded-lg flex justify-between items-center text-sm">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white truncate" title={att.name}>{att.name}</p>
                                            <p className="text-xs text-gray-400">{(att.size / 1024).toFixed(2)} KB</p>
                                        </div>
                                        <button onClick={() => removeAttachment(att.id)} className="text-red-500 hover:text-red-400 ml-2 p-1">
                                            <Icons.Trash/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                         )}
                    </div>
                    <div className="flex justify-end items-center pt-2 space-x-2">
                        <button onClick={() => setActiveModalTask(null)} className="text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button>
                        <button onClick={handleSaveTask} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">{activeModalTask === 'new' ? t('btn.createTask') : t('btn.saveChanges')}</button>
                    </div>
                 </div>
            </Modal>
            
            {viewingAttachmentsTask && (
                <Modal isOpen={!!viewingAttachmentsTask} onClose={() => setViewingAttachmentsTask(null)} title={`Ekler: ${viewingAttachmentsTask.title}`}>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {viewingAttachmentsTask.attachments.length > 0 ? (
                            viewingAttachmentsTask.attachments.map(att => (
                                <div key={att.id} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-medium truncate" title={att.name}>{att.name}</p>
                                        <p className="text-xs text-gray-400">{(att.size / 1024).toFixed(2)} KB - {att.type}</p>
                                    </div>
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="ml-4 text-blue-400 hover:text-blue-300 font-semibold flex-shrink-0">{t('btn.view')}</a>
                                </div>
                            ))
                        ) : <p className="text-gray-400 text-center py-4">{t('tasks.info.noAttachments')}</p>}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default AppWithContext;
