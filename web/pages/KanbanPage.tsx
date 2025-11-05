import React, { FC, useState, useMemo } from 'react';
import { useTranslation } from '../i18n/context';
import { Task, User, Location, TaskStatus } from '../types';
import { Icons } from '../components/Icons';

export const KanbanPage: FC<{
    tasks: Task[];
    users: User[];
    locations: Location[];
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    onEditTask: (task: Task) => void;
    onViewAttachments: (task: Task) => void;
}> = ({ tasks, users, locations, setTasks, onEditTask, onViewAttachments }) => {
    const { t } = useTranslation();
    const [selectedUserId, setSelectedUserId] = useState('all');
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    const filteredTasks = useMemo(() => {
        if (selectedUserId === 'all') {
            return tasks;
        }
        return tasks.filter(task => task.userId === selectedUserId);
    }, [tasks, selectedUserId]);

    const handleTaskDrop = (taskId: string, newStatus: TaskStatus) => {
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
                    const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
                    ghost.style.opacity = '0';
                    document.body.appendChild(ghost);
                    e.dataTransfer.setDragImage(ghost, 0, 0);
                    setTimeout(() => document.body.removeChild(ghost), 0);
                    setDraggedTaskId(task.id);
                }}
                onDragEnd={() => setDraggedTaskId(null)}
                onClick={() => onEditTask(task)}
                className={`bg-gray-800 p-3 rounded-lg shadow-md mb-3 cursor-pointer active:cursor-grabbing transition-all duration-300 ease-in-out 
                    ${isOverdue ? 'border-l-4 border-red-500' : ''} 
                    ${draggedTaskId === task.id ? 'transform scale-105 -rotate-3 shadow-2xl bg-gray-700' : ''}`}
            >
                <p className="font-semibold text-white mb-2">{task.title}</p>
                 <div className="flex justify-between items-center text-xs text-gray-400">
                    <div className="flex items-center space-x-2">
                        {user && <img src={user.avatarUrl} alt={user.name} className="w-5 h-5 rounded-full" title={user.name} />}
                        <span>{location?.name.substring(0, 15) || 'Bilinmeyen'}</span>
                         {task.attachments && task.attachments.length > 0 && (
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
                    {tasksInColumn.map(task => <div key={task.id} className={draggedTaskId === task.id ? 'opacity-20' : ''}><TaskCard task={task} /></div>)}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">{t('nav.board')}</h1>
                <div>
                    <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5">
                        <option value="all">{t('kanban.allUsers')}</option>
                        {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                </div>
            </div>
            <div className="flex-1 flex space-x-4 overflow-x-auto pb-4 -mb-4">
                <KanbanColumn status={TaskStatus.ToDo} title={t('status.todo')} color="text-yellow-400" />
                <KanbanColumn status={TaskStatus.InProgress} title={t('status.inProgress')} color="text-blue-400" />
                <KanbanColumn status={TaskStatus.Completed} title={t('status.completed')} color="text-green-400" />
            </div>
        </div>
    );
};