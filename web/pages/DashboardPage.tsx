import React, { FC, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useTranslation } from '../i18n/context';
import { Task, Location, User, NfcCard, TaskStatus } from '../types';
import { Icons } from '../components/Icons';
import { StatCard } from '../components/StatCard';
import { DynamicTaskStatusLabel } from '../components/DynamicTaskStatusLabel';

export const DashboardPage: FC<{ tasks: Task[], locations: Location[], users: User[], cards: NfcCard[] }> = ({ tasks, locations, users, cards }) => {
    const { t } = useTranslation();
    const taskStatusData = useMemo(() => {
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
                                <Tooltip contentStyle={{ backgroundColor: '#374151', borderColor: '#4B5563' }} />
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