import React, { FC, useState, useMemo } from 'react';
import { useTranslation } from '../i18n/context';
import { User } from '../types';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';
import { supabase } from '../supabaseClient';

export const UsersPage: FC<{ users: User[], setUsers: React.Dispatch<React.SetStateAction<User[]>> }> = ({ users, setUsers }) => {
    const { t } = useTranslation();
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [password, setPassword] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);

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
        setAvatarFile(null);
        setIsUserModalOpen(true);
    };

    const handleSaveUser = async () => {
        if (!name || !username) {
            alert('Ad Soyad ve Kullanıcı Adı zorunludur.');
            return;
        }
        try {
            // Bu kısım idealde bir Supabase Edge Function içinde yapılmalıdır.
            // 1. Kullanıcıyı oluştur (henüz avatar URL'i olmadan)
            const newUserId = `user_${Date.now()}`;
            const { data: createdUser, error: createError } = await supabase.from('users').insert({
                id: newUserId,
                name,
                username,
                email: email || undefined,
                avatarurl: `https://picsum.photos/seed/${newUserId}/100/100`, // Geçici avatar
            }).select().single();

            if (createError) throw createError;

            let finalUser = createdUser as User;

            // 2. Eğer yeni bir avatar dosyası seçildiyse, onu yükle
            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const filePath = `${newUserId}/avatar.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('avatar')
                    .upload(filePath, avatarFile, { upsert: true });

                if (uploadError) throw uploadError;

                // 3. Yüklenen dosyanın URL'ini al ve kullanıcıyı güncelle
                const { data: { publicUrl } } = supabase.storage.from('avatar').getPublicUrl(filePath);
                const { data: updatedUser, error: updateError } = await supabase.from('users').update({ avatarurl: publicUrl }).eq('id', newUserId).select().single();
                if (updateError) throw updateError;
                finalUser = updatedUser as User;
            }

            setUsers(prevUsers => [...prevUsers, finalUser]);
            setIsUserModalOpen(false);
            setPassword('');
        } catch (e: any) {
            console.error('User create failed', e);
            alert('Kullanıcı oluşturulamadı. ' + (e?.message || ''));
        }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setAvatarUrl(reader.result as string);
            reader.readAsDataURL(file);
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
        // In a real app, this would call a Supabase edge function
        alert("Şifre sıfırlama bu demo'da aktif değil.");
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
        try {
            const { error } = await supabase.from('users').delete().eq('id', userId);
            if (error) throw error;
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
                    <div><label htmlFor="userName" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.user.name')}</label><input type="text" id="userName" value={name} onChange={e => setName(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" required /></div>
                     <div><label htmlFor="userUsername" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.user.username')}</label><input type="text" id="userUsername" value={username} onChange={e => setUsername(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" required /></div>
                    <div><label htmlFor="userEmail" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.user.email')}</label><input type="email" id="userEmail" value={email} onChange={e => setEmail(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" /></div>
                    <div><label htmlFor="userAvatar" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.user.avatarUrl')}</label><input type="text" id="userAvatar" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" /></div>
                    <div><label htmlFor="userPassword" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.user.password')}</label><input type="password" id="userPassword" value={password} onChange={e => setPassword(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="En az 6 karakter" /></div>
                    <div className="flex justify-end items-center pt-2 space-x-2">
                        <button onClick={() => setIsUserModalOpen(false)} className="text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button>
                        <button onClick={handleSaveUser} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.createUser')}</button>
                    </div>
                </div>
            </Modal>
            <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title={t('modals.resetPassword.title')}>
                <div className="space-y-4">
                    <div><label htmlFor="resetPassword" className="block mb-2 text-sm font-medium text-gray-300">{t('users.reset.inputLabel')}</label><input type="password" id="resetPassword" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" /></div>
                    {generatedPassword && (
                        <div className="bg-gray-700 p-3 rounded">
                            <p className="text-gray-300 text-sm">{t('users.reset.temporaryPassword')}:</p><p className="text-white font-mono text-lg">{generatedPassword}</p><p className="text-gray-400 text-xs mt-1">{t('users.reset.generatedPasswordNote')}</p>
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