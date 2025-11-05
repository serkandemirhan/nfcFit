import React, { useState, useMemo, FC, useCallback, useRef, useEffect } from 'react';
import { translations } from './i18n';
import { Locale, LocaleContext, useTranslation } from './i18n/context';
import { supabase } from './supabaseClient';
import layout1Img from './layout1.jpg';
import layout2Img from './layout2.jpg';
import { Page, TaskStatus, User, NfcCard, Location, Task, Layout, Attachment } from './types';
import { Icons } from './components/Icons';
import { Modal } from './components/Modal';
import { DashboardPage } from './pages/DashboardPage';
import { KanbanPage } from './pages/KanbanPage';
import { TasksPage } from './pages/TasksPage';
import { LayoutsPage } from './pages/LayoutsPage';
import { UsersPage } from './pages/UsersPage';
import { CardsPage } from './pages/CardsPage';
import { LoginPage } from './pages/LoginPage';
import { MobileUserView } from './pages/MobileUserView';

const parseTask = (raw: any): Task => ({
  ...raw,
  createdAt: new Date(raw.createdat),
  dueDate: new Date(raw.duedate),
  lastCompletedAt: raw.lastcompletedat ? new Date(raw.lastcompletedat) : undefined,
  locationId: raw.locationid,
  userId: raw.userid,
});

type LoggedInUser = User | { id: 'admin'; name: 'Admin'; avatarUrl: string };


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
    const [taskAttachmentFiles, setTaskAttachmentFiles] = useState<File[]>([]);
    const [taskAttachments, setTaskAttachments] = useState<Attachment[]>([]);
    
    const attachmentInputRef = useRef<HTMLInputElement>(null);

    // Load initial data from backend
    useEffect(() => {
        const load = async () => {
            try {
                const fetchWith = async (tableName: string) => {
                    const { data, error } = await supabase.from(tableName).select('*');
                    if (error) throw error;
                    return data;
                };

                const [usersData, locationsData, cardsData, tasksData, layoutsData, attachmentsData] = await Promise.all([
                    fetchWith('users'),
                    fetchWith('locations'),
                    fetchWith('cards'),
                    fetchWith('tasks'),
                    fetchWith('layouts'),
                    fetchWith('attachments'),
                ]);

                const tasksWithAttachments = (tasksData as any[]).map(task => {
                    const attachments = (attachmentsData as any[]).filter(att => att.taskId === task.id);
                    return { ...task, attachments };
                });

                setUsers(usersData as User[]);
                setLocations(locationsData as Location[]);
                setNfcCards(cardsData as NfcCard[]);
                setTasks(tasksWithAttachments.map(parseTask));

                const mappedLayouts = (layoutsData as Layout[]).map(l => {
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

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;
        setTaskAttachmentFiles(prev => [...prev, ...Array.from(files)]);
    };

    const removeAttachment = async (attachmentToRemove: Attachment) => {
        if (activeModalTask && activeModalTask !== 'new') {
            const { error } = await supabase.storage.from('task-attachments').remove([`${activeModalTask.id}/${attachmentToRemove.name}`]);
            if (error) {
                console.error("Error deleting file from storage", error);
            }
        }
        setTaskAttachments(prev => prev.filter(att => att.id !== attachmentToRemove.id));
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
        setTaskAttachmentFiles([]);
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
        if (!task.dueDate || isNaN(task.dueDate.getTime())) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            setTaskDueDate(tomorrow.toISOString().slice(0, 16));
        } else {
            setTaskDueDate(new Date(task.dueDate.getTime() - (task.dueDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16));
        }
        setTaskRepeatUnit(task.repeat?.unit || 'none');
        setTaskRepeatFrequency(task.repeat?.frequency || 1);
        setTaskAttachments(task.attachments || []);
        setTaskAttachmentFiles([]);
        setActiveModalTask(task);
    };

    const handleSaveTask = async () => {
        if (!taskTitle || !taskLocationId || !taskUserId || !taskDueDate) {
            alert('Lütfen başlık, nokta, kullanıcı ve bitiş tarihi alanlarını doldurun.');
            return;
        }

        try {
            let savedTask: Task;

            if (activeModalTask === 'new') {
                const { data, error } = await supabase.from('tasks').insert({
                    id: `task_${Date.now()}`,
                    title: taskTitle,
                    description: taskDescription,
                    locationid: taskLocationId,
                    userid: taskUserId,
                    duedate: new Date(taskDueDate).toISOString(),
                    status: TaskStatus.ToDo,
                    repeat_unit: taskRepeatUnit !== 'none' ? taskRepeatUnit : null,
                    repeat_frequency: taskRepeatUnit !== 'none' ? taskRepeatFrequency : null,
                    createdat: new Date().toISOString(),
                }).select().single();
                if (error) throw error;
                savedTask = parseTask(data);
                setTasks(prev => [savedTask, ...prev]);
            } else if (activeModalTask) {
                const { data, error } = await supabase.from('tasks').update({
                    title: taskTitle,
                    description: taskDescription,
                    locationid: taskLocationId,
                    userid: taskUserId,
                    duedate: new Date(taskDueDate).toISOString(),
                    repeat_unit: taskRepeatUnit !== 'none' ? taskRepeatUnit : null,
                    repeat_frequency: taskRepeatUnit !== 'none' ? taskRepeatFrequency : null,
                }).eq('id', activeModalTask.id).select().single();
                if (error) throw error;
                savedTask = parseTask(data);
                setTasks(prev => prev.map(t => t.id === savedTask.id ? savedTask : t));
            } else {
                throw new Error("Task modal is in an invalid state.");
            }

            // Upload new files
            let newlyAddedAttachments: Attachment[] = [];
            for (const file of taskAttachmentFiles) {
                const filePath = `${savedTask.id}/${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('task-attachments') // Your bucket name
                    .upload(filePath, file, { upsert: true });

                if (uploadError) {
                    console.error('File upload error:', uploadError);
                    continue;
                }

                const { data: { publicUrl } } = supabase.storage.from('task-attachments').getPublicUrl(filePath);

                const { data: metaData, error: metaError } = await supabase.from('attachments').insert({
                    taskId: savedTask.id,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    url: publicUrl,
                }).select().single();

                if (metaError) console.error('Attachment metadata save error:', metaError);
                else if (metaData) {
                    newlyAddedAttachments.push(metaData as Attachment);
                }
            }

            if (newlyAddedAttachments.length > 0) {
                 setTasks(prev => prev.map(t => t.id === savedTask.id ? { 
                    ...savedTask, 
                    attachments: [...(t.attachments || []), ...newlyAddedAttachments] 
                } : t));
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
                return <TasksPage tasks={tasks} users={users} locations={locations} onNewTask={openNewTaskModal} onEditTask={openEditTaskModal} onViewAttachments={setViewingAttachmentsTask} />;
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
                                {[...taskAttachments, ...taskAttachmentFiles.map(f => ({id: f.name, name: f.name, size: f.size, type: f.type, url: ''}))].map(att => (
                                    <div key={att.id} className="bg-gray-700 p-2 rounded-lg flex justify-between items-center text-sm">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white truncate" title={att.name}>{att.name}</p>
                                            <p className="text-xs text-gray-400">{(att.size / 1024).toFixed(2)} KB</p>
                                        </div>
                                        <button onClick={() => 'url' in att ? removeAttachment(att) : setTaskAttachmentFiles(f => f.filter(file => file.name !== att.name))} className="text-red-500 hover:text-red-400 ml-2 p-1">
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
