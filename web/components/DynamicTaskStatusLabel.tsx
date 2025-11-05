import React, { FC } from 'react';
import { useTranslation } from '../i18n/context';
import { Task, TaskStatus } from '../types';

export const DynamicTaskStatusLabel: FC<{ task: Task }> = ({ task }) => {
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