import React, { FC } from 'react';
import { useTranslation } from '../i18n/context';
import { Task, User, Location, TaskStatus } from '../types';
import { Icons } from '../components/Icons';
import { DynamicTaskStatusLabel } from '../components/DynamicTaskStatusLabel';

export const TasksPage: FC<{
    tasks: Task[];
    users: User[];
    locations: Location[];
    onNewTask: () => void;
    onEditTask: (task: Task) => void;
    onViewAttachments: (task: Task) => void;
}> = ({ tasks, users, locations, onNewTask, onEditTask, onViewAttachments }) => {
    const { t } = useTranslation();
    const now = new Date();

    const inProgressTasks = tasks.filter(t => t.status === TaskStatus.InProgress);
    const overdueTasks = tasks.filter(t => t.status === TaskStatus.ToDo && t.dueDate < now);
    const todoTasks = tasks.filter(t => t.status === TaskStatus.ToDo && t.dueDate >= now).sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime());
    const completedTasks = tasks.filter(t => t.status === TaskStatus.Completed).sort((a, b) => (b.lastCompletedAt?.getTime() || 0) - (a.lastCompletedAt?.getTime() || 0));

    const TaskItem: FC<{ task: Task }> = ({ task }) => {
        const user = users.find(u => u.id === task.userId);
        const location = locations.find(l => l.id === task.locationId);
        const timeFormatter = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

        let borderColor = 'border-gray-700';
        if (task.status === TaskStatus.Completed) borderColor = 'border-green-500';
        else if (task.status === TaskStatus.InProgress) borderColor = 'border-blue-500';
        else if (task.dueDate < now) borderColor = 'border-red-500';
        else borderColor = 'border-yellow-500';

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
                    {task.attachments && task.attachments.length > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); onViewAttachments(task); }} className="flex items-center space-x-1.5 text-cyan-400 hover:text-cyan-300" title={`${task.attachments.length} ek dosya`}>
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

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">{t('tasks.title')}</h1>
                <button onClick={onNewTask} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center space-x-2 transition-colors">
                    <Icons.Plus />
                    <span>{t('btn.newTask')}</span>
                </button>
            </div>
            
            <TaskSection title={t('tasks.inProgress')} tasks={inProgressTasks} badgeColor="bg-blue-500/30 text-blue-300" />
            <TaskSection title={t('tasks.overdue')} tasks={overdueTasks} badgeColor="bg-red-500/30 text-red-300" />
            <TaskSection title={t('tasks.todo')} tasks={todoTasks} badgeColor="bg-yellow-500/30 text-yellow-300" />
            <TaskSection title={t('tasks.completed')} tasks={completedTasks} badgeColor="bg-green-500/30 text-green-300" />

            {tasks.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                    <h3 className="text-lg font-semibold">{t('tasks.noTasks.title')}</h3>
                    <p className="mt-2">{t('tasks.noTasks.description')}</p>
                </div>
            )}
        </div>
    );
};