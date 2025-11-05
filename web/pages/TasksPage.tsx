import React, { FC, useMemo, useState } from 'react';
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
    const [viewMode, setViewMode] = useState<'list' | 'table'>('list');

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
                            {task.status === TaskStatus.Completed 
                                ? (task.lastCompletedAt && !isNaN(new Date(task.lastCompletedAt).getTime()) ? `Tamamlandı: ${timeFormatter.format(new Date(task.lastCompletedAt))}` : 'Tamamlandı')
                                : (task.dueDate && !isNaN(new Date(task.dueDate).getTime()) ? `Bitiş: ${timeFormatter.format(new Date(task.dueDate))}` : 'Bitiş tarihi yok')
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
                    case 'title': compareResult = a.title.localeCompare(b.title); break;
                    case 'description': compareResult = (a.description || '').localeCompare(b.description || ''); break;
                    case 'location':
                        const locA = locations.find(l => l.id === a.locationId)?.name || '';
                        const locB = locations.find(l => l.id === b.locationId)?.name || '';
                        compareResult = locA.localeCompare(locB);
                        break;
                    case 'user':
                        const userA = users.find(u => u.id === a.userId)?.name;
                        const userB = users.find(u => u.id === b.userId)?.name;
                        if (!userA) return 1;
                        if (!userB) return -1;
                        compareResult = userA.localeCompare(userB);
                        break;
                    case 'created': compareResult = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
                    case 'due': compareResult = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); break;
                    case 'repeat': compareResult = (a.repeat ? 1 : 0) - (b.repeat ? 1 : 0); break;
                    case 'attachments': compareResult = (a.attachments?.length || 0) - (b.attachments?.length || 0); break;
                }

                return sortDirection === 'asc' ? compareResult : -compareResult;
            });
        }, [tasks, sortColumn, sortDirection]);

        const getStatusColor = (task: Task) => {
            if (task.status === TaskStatus.Completed) return 'text-green-400';
            if (task.status === TaskStatus.InProgress) return 'text-blue-400';
            if (new Date(task.dueDate) < now) return 'text-red-400';
            return 'text-yellow-400';
        };

        const SortableHeader: FC<{ column: typeof sortColumn; children: React.ReactNode; align?: 'left' | 'center' }> = ({ column, children, align = 'left' }) => (
            <th className={`px-2 py-1.5 ${align === 'center' ? 'text-center' : 'text-left'} font-semibold cursor-pointer hover:bg-gray-700/50 transition-colors select-none`} onClick={() => handleSort(column)}>
                <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : 'justify-start'}`}>
                    {children}
                    {sortColumn === column && (<span className="text-cyan-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>)}
                </div>
            </th>
        );

        return (
            <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-lg"><table className="w-full text-sm">
                <thead className="bg-gray-700/50 text-gray-300 sticky top-0">
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
                    </tr>
                </thead>
                <tbody className="text-gray-300">
                    {allTasksSorted.map(task => {
                        const user = users.find(u => u.id === task.userId);
                        const location = locations.find(l => l.id === task.locationId);
                        return (
                            <tr key={task.id} onClick={() => onEditTask(task)} className="border-b border-gray-700/50 hover:bg-gray-700/50 cursor-pointer transition-colors h-8">
                                <td className="px-2 py-0.5"><span className={`text-xs font-semibold ${getStatusColor(task)}`}>{task.status === TaskStatus.Completed ? '✓' : task.status === TaskStatus.InProgress ? '●' : new Date(task.dueDate) < now ? '!' : '○'}</span></td>
                                <td className="px-2 py-0.5 font-medium text-white truncate max-w-xs">{task.title}</td>
                                <td className="px-2 py-0.5 text-gray-400 truncate max-w-xs text-xs">{task.description}</td>
                                <td className="px-2 py-0.5 text-xs">{location?.name || '-'}</td>
                                <td className="px-2 py-0.5">{user && (<div className="flex items-center gap-1"><img src={user.avatarUrl} alt={user.name} className="w-4 h-4 rounded-full" /><span className="text-xs truncate max-w-[100px]">{user.name}</span></div>)}</td>
                                <td className="px-2 py-0.5 text-xs font-mono">
                                    {task.createdAt && !isNaN(new Date(task.createdAt).getTime()) ? timeFormatter.format(new Date(task.createdAt)) : '-'}
                                </td>
                                <td className="px-2 py-0.5 text-xs font-mono">
                                    {task.status === TaskStatus.Completed
                                        ? (task.lastCompletedAt && !isNaN(new Date(task.lastCompletedAt).getTime()) ? timeFormatter.format(new Date(task.lastCompletedAt)) : '-')
                                        : (task.dueDate && !isNaN(new Date(task.dueDate).getTime()) ? timeFormatter.format(new Date(task.dueDate)) : '-')
                                    }
                                </td>
                                <td className="px-2 py-0.5 text-center">{task.repeat && <span className="text-cyan-400 text-xs">↻</span>}</td>
                                <td className="px-2 py-0.5 text-center">{task.attachments && task.attachments.length > 0 && (<button onClick={(e) => { e.stopPropagation(); onViewAttachments(task); }} className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold">{task.attachments.length}</button>)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table></div>
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
                            <input type="checkbox" className="sr-only" checked={viewMode === 'table'} onChange={() => setViewMode(viewMode === 'list' ? 'table' : 'list')} />
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