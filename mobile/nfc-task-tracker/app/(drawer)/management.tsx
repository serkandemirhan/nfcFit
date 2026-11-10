import { canonicalRole, isClubAdmin, isClubOperator, isClubTrainer } from "@/lib/club-roles";
import { StaffArea } from "@/components/staff-area";
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, TextInput, View } from 'react-native';

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
import {
  ManagementButton as Button, ManagementCard as Card, ManagementFormSheet as FormSheet,
  ManagementMessage as Message, ManagementPicker as Select, ManagementField, ManagementForm,
  errorMessage, roleLabels, statusLabels, ui, unitLabels,
  ManagementDetailsSheet,
} from '@/components/management-ui';
import { ManagementTagList } from '@/components/management-tag-list';
import { NfcLinkWriter } from '@/components/nfc-link-writer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTenantIdentity } from '@/hooks/use-tenant-identity';
import { applyConfirmedMemberSave, applyConfirmedStaffSave, applyConfirmedTagDeletion, applyConfirmedManagementSave } from '@/lib/management-cache';
import {
  ConsoleRole, ManagedExercise, ManagedTag, ManagedTenant, fetchClubManagement,
  coachingRequest, fetchClubSubscription, fetchClubAudit, fetchConsoleIdentity, fetchPlatformOverview, saveConsoleResource, tenantConsoleConfigured,
} from '@/lib/tenant-console';

const nameField = (initial = ''): ManagementField => ({ key: 'name', label: 'Ad', initial, minLength: 2, maxLength: 120 });
const activeOptions = [{ label: 'Aktif', value: 'true' }, { label: 'Pasif', value: 'false' }];
const stateOptions = [{ label: 'Aktif', value: 'active' }, { label: 'Askıda', value: 'suspended' }];
const amountField = (key: string, label: string, initial: number, min: number, max: number, integer = false): ManagementField =>
  ({ key, label, initial: String(initial), type: 'number', min, max, integer });

export default function ManagementScreen() {
  return <StaffArea management><ManagementScreenContent /></StaffArea>;
}
function ManagementScreenContent() {
  const palette = getSurfaceColors(useColorScheme());
  const identity = useTenantIdentity();
  const { user } = useAuth();
  const identityClient = useQueryClient();
  const [selected, setSelected] = useState('');
  useFocusEffect(useCallback(() => { if (tenantConsoleConfigured && user?.id) void identityClient.fetchQuery({ queryKey: ['console-identity', user.id], queryFn: fetchConsoleIdentity, staleTime: 30_000 }).catch(() => undefined); }, [identityClient, user?.id]));
  const staff = identity.data?.staff.filter(item => item.status === 'active' && (item.tenant_status == null || item.tenant_status === 'active') && isClubOperator(item.role)) ?? [];
  const options = [
    ...(identity.data?.account.is_platform_admin ? [{ label: 'Platform yönetimi', value: 'platform' }] : []),
    ...staff.map(item => ({ label: `${item.tenant_name} · ${roleLabels[item.role]}`, value: item.tenant_id })),
  ];
  const selection = options.some(item => item.value === selected) ? selected : options[0]?.value ?? '';
  const selectedStaff = staff.find(item => item.tenant_id === selection);

  return <ThemedView style={{ flex: 1, backgroundColor: palette.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content, { paddingBottom: bottomNavHeight + 24 }]}
      refreshControl={<RefreshControl refreshing={identity.isRefetching} onRefresh={() => void identity.refetch()} />}>
      <View style={ui.row}><Ionicons name="business-outline" size={28} color={palette.green} /><ThemedText style={ui.title}>Yönetim</ThemedText></View>
      <ThemedText style={[ui.hint, { color: palette.mutedText }]}>Salon, kart ve üye işlemlerini buradan yönetin.</ThemedText>
      {selectedStaff && <View style={ui.row}><Button title="Ekipman eşleştirmeleri" secondary onPress={()=>router.push('/equipment-manager' as never)}/></View>}
      {!tenantConsoleConfigured ? <Message error message="Salon yönetimi bağlantısı bu uygulama sürümünde yapılandırılmamış. Güncel uygulama sürümünü yükleyin." /> :
        identity.isPending ? <ActivityIndicator color={palette.green} /> : identity.error ?
          <Card title="Yönetim bilgileri alınamadı"><Message error message={errorMessage(identity.error)} /><Button title="Yeniden dene" onPress={() => void identity.refetch()} /></Card> :
          !options.length ? <Card title="Yönetim yetkiniz bulunmuyor" hint="Bu ekrana erişmek için hesabınızın salona yönetici veya antrenör olarak eklenmesi gerekir." /> : <>
            <Select label="Yönetilecek alan" value={selection} options={options} onChange={setSelected} />
            {selection === 'platform' && identity.data?.account.is_platform_admin ? <PlatformManagement key={`platform-${user?.id}`} /> :
              selectedStaff && <ClubManagement key={`${user?.id}-${selection}-${selectedStaff.role}`} tenantId={selection} role={selectedStaff.role} accountId={identity.data!.account.id} />}
          </>}
    </ScrollView>
    <AppBottomNav />
  </ThemedView>;
}

function ClubAdministration({tenantId, name}: {tenantId:string; name:string}) {
  const {user} = useAuth();
  const key = ['club-administration', user?.id, tenantId] as const;
  const query = useQuery({queryKey:key, queryFn:async () => ({subscription:await fetchClubSubscription(tenantId), audit:await fetchClubAudit(tenantId)})});
  const {mutation, notice, error} = useManagementMutation(key);
  const [form,setForm] = useState<ManagementForm|null>(null);
  const base = `/tenants/${encodeURIComponent(tenantId)}`;
  if(query.isPending) return <ActivityIndicator />;
  if(query.error) return <Card title="Yönetim bilgisi alınamadı"><Message error message={errorMessage(query.error)}/><Button title="Yeniden dene" onPress={()=>void query.refetch()}/></Card>;
  const subscription=query.data!.subscription;
  return <>
    <Card title="Kulüp aboneliği" hint="Abonelik ve faturalama platform tarafından yönetilir. Değişiklik talebi onaylanana kadar limitler değişmez.">
      <ThemedText>{subscription.tenant.plan}</ThemedText>
      <ThemedText>Üye: {subscription.tenant.active_members}/{subscription.tenant.member_limit} · Kart: {subscription.tenant.cards}/{subscription.tenant.card_limit}</ThemedText>
      <Button title="Plan değişikliği talep et" disabled={mutation.isPending} onPress={()=>setForm({title:'Plan değişikliği',fields:[{key:'requested_plan',label:'İstenen kulüp planı',minLength:2,maxLength:80}],save:async values=>{await mutation.mutateAsync({path:`${base}/subscription/requests`,payload:values});}})}/>
      {subscription.requests.map(r=><ThemedText key={r.id}>{r.requested_plan} · {r.status === 'pending' ? 'İnceleme bekliyor' : r.status}</ThemedText>)}
      <Button title="Fatura bilgilerini düzenle" secondary onPress={()=>setForm({title:'Fatura bilgileri',fields:[{key:'legal_name',label:'Fatura unvanı',initial:subscription.billing_profile.legal_name,minLength:2,maxLength:200},{key:'billing_email',label:'Fatura e-postası',type:'email',initial:subscription.billing_profile.billing_email},{key:'tax_id',label:'Vergi numarası',required:false,maxLength:80,initial:subscription.billing_profile.tax_id},{key:'address',label:'Fatura adresi',required:false,maxLength:1000,initial:subscription.billing_profile.address}],save:async values=>{await mutation.mutateAsync({path:`${base}/billing-profile`,method:'PATCH',payload:values});}})}/>
      <Button title="Kulüp ayarları" secondary onPress={()=>setForm({title:'Kulüp ayarları',fields:[nameField(name)],save:async values=>{await mutation.mutateAsync({path:`${base}/settings`,method:'PATCH',payload:values});}})}/>
    </Card>
    {notice !== '' && <Message message={notice}/>}{error !== '' && <Message error message={error}/>}
    <Card title="Denetim kayıtları" hint="En son 200 işlem. Üye sağlık verileri bu listede gösterilmez.">{query.data!.audit.map(r=><ThemedText key={r.id}>{new Date(r.created_at).toLocaleString()} · {r.action}</ThemedText>)}</Card>
    {form && <FormSheet form={form} onClose={()=>setForm(null)}/>}
  </>;
}

function useManagementMutation(queryKey: readonly unknown[]) {
  const client = useQueryClient();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: ({ path, payload, method = 'POST' }: { path: string; payload: object; method?: 'POST' | 'PATCH' | 'DELETE'; deletedTagId?: string }) => saveConsoleResource(path, payload, method),
    onMutate: async () => {
      setNotice(''); setError('');
      await client.cancelQueries({ queryKey, exact: true });
    },
    onSuccess: async (saved, variables) => {
      await client.cancelQueries({ queryKey, exact: true });
      if (variables.method === 'DELETE' && variables.deletedTagId) {
        applyConfirmedTagDeletion(client, queryKey, variables.deletedTagId);
        setNotice('Kart silindi. Geçmiş aktiviteler korundu.');
        return;
      }
      const resource = variables.path.match(/^\/tenants\/[^/]+\/(tags|exercises)(?:\/[^/]+)?$/)?.[1];
      if ((resource === 'tags' || resource === 'exercises') && saved && typeof saved === 'object' && 'id' in saved) {
        applyConfirmedManagementSave(client, queryKey, resource, saved as ManagedTag | ManagedExercise);
        setNotice('Değişiklik kaydedildi.');
        return;
      }
      const memberPath = /^\/tenants\/[^/]+\/(?:members(?:\/[^/]+)?|join-requests\/[^/]+\/review)$/.test(variables.path);
      if (memberPath && saved && typeof saved === 'object' && 'id' in saved && 'status' in saved) {
        applyConfirmedMemberSave(client, queryKey, saved as Parameters<typeof applyConfirmedMemberSave>[2]);
        setNotice('Üyelik güncellendi.'); return;
      }
      if (/^\/tenants\/[^/]+\/staff(?:\/[^/]+)?$/.test(variables.path) && saved && typeof saved === 'object' && 'id' in saved) {
        applyConfirmedStaffSave(client, queryKey, saved as {id:string});
        setNotice('Personel erişimi güncellendi.');
        void client.invalidateQueries({queryKey:['console-identity']}); return;
      }
      const scopedTenant = variables.path.match(/^\/tenants\/([^/]+)/)?.[1];
      if (scopedTenant) void client.invalidateQueries({queryKey:['club-management'],predicate:q=>q.queryKey[2]===scopedTenant});
      setNotice('Değişiklik kaydedildi.');
      void Promise.all([
        client.invalidateQueries({ queryKey }),
        client.invalidateQueries({ queryKey: ['console-identity'] }),
      ]);
    },
  });
  const perform = async (path: string, payload: object, method: 'POST' | 'PATCH' = 'POST') => {
    try { await mutation.mutateAsync({ path, payload, method }); }
    catch (err) { setError(errorMessage(err)); }
  };
  return { mutation, perform, notice, error };
}

function ClubManagement({ tenantId, role, accountId }: { tenantId: string; role: ConsoleRole; accountId: string }) {
  const palette = getSurfaceColors(useColorScheme());
  const { user } = useAuth();
  const canManage = isClubOperator(role);
  const key = useMemo(() => ['club-management', user?.id, tenantId, role] as const, [user?.id, tenantId, role]);
  const query = useQuery({ queryKey: key, queryFn: () => fetchClubManagement(tenantId, canManage), retry: 1, staleTime: 30_000 });
  const client = useQueryClient();
  const { mutation, perform, notice, error } = useManagementMutation(key);
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<ManagementForm | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [writingTag, setWritingTag] = useState<ManagedTag | null>(null);
  const base = `/tenants/${encodeURIComponent(tenantId)}`;
  const save = async (path: string, payload: object, method: 'POST' | 'PATCH' = 'POST') => { await mutation.mutateAsync({ path, payload, method }); };
  useFocusEffect(useCallback(() => { void client.fetchQuery({ queryKey: key, queryFn: () => fetchClubManagement(tenantId, canManage), staleTime: 30_000 }).catch(() => undefined); }, [client, key, tenantId, canManage]));
  if (query.isPending) return <ActivityIndicator color={palette.green} />;
  if (query.error || !query.data) return <Card title="Salon bilgileri alınamadı"><Message error message={errorMessage(query.error)} /><Button title="Yeniden dene" onPress={() => void query.refetch()} /></Card>;
  const data = query.data;
  const selectedTag = data.tags.find(tag => tag.id === selectedTagId);
  const tenant = data.dashboard.tenant;
  const disabled = mutation.isPending;
  const tabs = [
    { value: 'overview', label: 'Özet' }, { value: 'tags', label: 'NFC kartları' }, { value: 'members', label: 'Üyeler' },
    { value: 'exercises', label: 'Egzersizler' }, ...(canManage ? [{ value: 'staff', label: 'Personel' }] : []), ...(isClubAdmin(role) ? [{value:'administration',label:'Abonelik ve ayarlar'}] : []), { value: 'activity', label: 'Aktiviteler' },
  ];
  const pending = data.members.filter(member => member.status === 'pending');
  const review = (id: string, decision: 'approve' | 'reject') => void perform(`${base}/join-requests/${id}/review`, { decision });

  const editTag = (tag?: ManagedTag) => {
    const exercises = data.exercises.filter(exercise => exercise.active);
    const options = exercises.map(exercise => ({ value: exercise.id, label: `${exercise.name} · ${exercise.default_quantity} ${unitLabels[exercise.unit]}` }));
    if (tag?.exercise && !options.some(item => item.value === tag.exercise_id)) options.push({ value: tag.exercise.id, label: `${tag.exercise.name} (pasif)` });
    setForm({
      title: tag ? 'Kartı düzenle' : 'Salona kart ekle', scanUid: !tag,
      hint: tag ? `UID: ${tag.uid}` : 'Kartı okutun veya UID girin. Egzersiz seçmeden kaydedebilir, daha sonra bağlayabilirsiniz.',
      fields: [nameField(tag?.name), ...(!tag ? [{ key: 'uid', label: 'Kart UID', minLength: 4, maxLength: 160, placeholder: 'F4C5D94F' }] : []),
        { key: 'exercise_id', label: 'Egzersiz (isteğe bağlı)', required: false, initial: tag?.exercise_id ?? '', options: [{ value: '', label: 'Şimdi bağlama' }, ...options] },
        { key: 'active', label: 'Durum', initial: String(tag?.active ?? true), options: activeOptions }],
      save: values => save(tag ? `${base}/tags/${tag.id}` : `${base}/tags`, {
        name: values.name, ...(!tag ? { uid: normalizeUid(values.uid) } : {}),
        ...(!tag || (values.exercise_id || null) !== tag.exercise_id ? { exercise_id: values.exercise_id || null } : {}), active: values.active === 'true',
      }, tag ? 'PATCH' : 'POST'),
    });
  };

  const editExercise = (exercise?: ManagedExercise) => setForm({
    title: exercise ? 'Egzersizi düzenle' : 'Egzersiz ekle',
    fields: [nameField(exercise?.name),
      { key: 'category', label: 'Kategori', initial: exercise?.category ?? 'strength', options: [
        { label: 'Kuvvet', value: 'strength' }, { label: 'Core', value: 'core' }, { label: 'Kardiyo', value: 'cardio' },
        { label: 'Mobilite', value: 'mobility' }, { label: 'Rehabilitasyon', value: 'rehab' }, { label: 'Diğer', value: 'other' },
      ] },
      { key: 'unit', label: 'Birim', initial: exercise?.unit ?? 'seconds', options: Object.entries(unitLabels).map(([value, label]) => ({ value, label })) },
      amountField('default_quantity', 'Varsayılan miktar', exercise?.default_quantity ?? 30, 0.1, 100000),
      amountField('default_calories', 'Varsayılan kalori', exercise?.default_calories ?? 0, 0, 100000),
      { key: 'active', label: 'Durum', initial: String(exercise?.active ?? true), options: activeOptions }],
    save: values => save(exercise ? `${base}/exercises/${exercise.id}` : `${base}/exercises`, {
      ...values, default_quantity: Number(values.default_quantity), default_calories: Number(values.default_calories), active: values.active === 'true',
    }, exercise ? 'PATCH' : 'POST'),
  });

  const addStaff = () => setForm({
    title: 'Personel ekle', hint: 'Personel bu e-posta adresine ait doğrulanmış hesabıyla giriş yapar.',
    fields: [nameField(), { key: 'email', label: 'E-posta', type: 'email' },
      { key: 'role', label: 'Yetki', options: [{ label: 'Antrenör', value: 'TRAINER' }, ...(isClubAdmin(role) ? [{ label: 'Yönetici', value: 'CLUB_MANAGER' }] : [])] }],
    save: values => save(`${base}/staff`, values),
  });

  return <View style={{ gap: 14 }}>
    <Card title={tenant.name} hint={`${roleLabels[role]} · ${tenant.plan}`}>
      <View style={ui.row}><Button title={query.isRefetching ? 'Yenileniyor…' : 'Yenile'} secondary disabled={query.isRefetching || disabled} onPress={() => void query.refetch()} /></View>
    </Card>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {tabs.map(item => <Button key={item.value} title={item.label} secondary={tab !== item.value} disabled={disabled} onPress={() => { setTab(item.value); setSearch(''); }} />)}
    </ScrollView>
    {notice !== '' && <Message message={notice} />}
    {error !== '' && <Message error message={error} />}
    {tab === 'overview' && <>
      <Card title="Salon özeti">
        <ThemedText>Aktif üye: {tenant.active_members} / {tenant.member_limit}</ThemedText>
        <ThemedText>NFC kartı: {tenant.cards} / {tenant.card_limit}</ThemedText>
        <ThemedText>Bugünkü aktivite: {data.dashboard.activities_today}</ThemedText>
        <ThemedText>Onay bekleyen: {pending.length}</ThemedText>
        {canManage && <Button title="Kart okut ve tanımla" disabled={disabled || tenant.cards >= tenant.card_limit} onPress={() => editTag()} />}
      </Card>
      <Card title="Bekleyen başvurular" hint={!pending.length ? 'Bekleyen başvuru yok.' : undefined}>
        {pending.map(member => <View key={member.id} style={{ gap: 8 }}><ThemedText style={ui.label}>{member.name}</ThemedText><ThemedText style={ui.hint}>{member.email}</ThemedText>
          {canManage && <View style={ui.row}><Button title="Onayla" disabled={disabled} onPress={() => review(member.id, 'approve')} /><Button title="Reddet" secondary danger disabled={disabled} onPress={() => confirmAction('Başvuruyu reddet', `${member.name} adlı kişinin başvurusu reddedilsin mi?`, () => review(member.id, 'reject'))} /></View>}
        </View>)}
      </Card>
    </>}
    {tab === 'tags' && <>
      <Card title="Salon NFC kartları" hint="Üyeler aynı kartı okutabilir; her aktivite okutan üyeye kaydedilir.">
        {canManage && <Button title="Yeni kart tanımla" disabled={disabled || tenant.cards >= tenant.card_limit} onPress={() => editTag()} />}
        {tenant.cards >= tenant.card_limit && <ThemedText style={ui.hint}>Kart limitine ulaşıldı. Platform yöneticisinden limit artışı isteyin.</ThemedText>}
        <ThemedText style={ui.hint}>Egzersiz bağlantısı isteğe bağlıdır. İşlemler için listedeki karta dokunun.</ThemedText>
        <Search value={search} onChange={setSearch} label="Kart adı veya UID ara" />
      </Card>
      <ManagementTagList tags={data.tags} search={search} onSelect={tag => setSelectedTagId(tag.id)} disabled={disabled} />
    </>}
    {tab === 'members' && <>
      <Button title="Üye ekle" onPress={() => setForm({title:'Üye ekle',hint:'Doğrulanmış e-posta ile giriş yaptıktan sonra üyelik onaylanır.', fields:[nameField(),{key:'email',label:'E-posta',type:'email'}], save:values => save(`${base}/members`,values)})} />
      <Search value={search} onChange={setSearch} label="Üye adı veya e-posta ara" />
      {!data.members.length && <Card hint="Henüz üye veya katılım isteği yok." />}
      {data.members.filter(member => `${member.name} ${member.email}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))).map(member => <Card key={member.id} title={member.name} hint={`${member.email} · ${statusLabels[member.status]}`}>
        {canManage && (member.status === 'pending' ? <View style={ui.row}>
          <Button title="Onayla" disabled={disabled} onPress={() => review(member.id, 'approve')} />
          <Button title="Reddet" secondary danger disabled={disabled} onPress={() => confirmAction('Başvuruyu reddet', `${member.name} adlı kişinin başvurusu reddedilsin mi?`, () => review(member.id, 'reject'))} />
        </View> : (member.status === 'active' || member.status === 'suspended' || member.status === 'removed') && <Button title={member.status === 'active' ? 'Üyeliği askıya al' : 'Üyeliği etkinleştir'} secondary disabled={disabled}
          onPress={() => confirmAction('Üyelik durumunu değiştir', `${member.name}: ${member.status === 'active' ? 'aktivite kaydı durdurulacak' : 'üyelik yeniden açılacak'}. Devam edilsin mi?`, () => void perform(`${base}/members/${member.id}`, { status: member.status === 'active' ? 'suspended' : 'active' }, 'PATCH'))} />)}
        <Button title="Üyeliği kaldır" danger secondary disabled={disabled || member.status === 'removed'} onPress={() => confirmAction('Üyeliği kaldır', 'Erişim kaldırılacak, aktivite geçmişi korunur.', () => void perform(`${base}/members/${member.id}`, {status:'removed'}, 'PATCH'))} />
      </Card>)}
    </>}
    {tab === 'exercises' && <>
      {canManage && <Button title="Egzersiz ekle" disabled={disabled} onPress={() => editExercise()} />}
      {!data.exercises.length && <Card hint="Henüz egzersiz eklenmedi." />}
      {data.exercises.map(exercise => <Card key={exercise.id} title={exercise.name} hint={`${exercise.default_quantity} ${unitLabels[exercise.unit]} · ${exercise.default_calories} kcal · ${statusLabels[exercise.active ? 'active' : 'inactive']}`}>
        {canManage && <View style={ui.row}><Button title="Düzenle" secondary disabled={disabled} onPress={() => editExercise(exercise)} />
          <Button title={exercise.active ? 'Pasife al' : 'Etkinleştir'} secondary disabled={disabled} onPress={() => void perform(`${base}/exercises/${exercise.id}`, {
            name: exercise.name, category: exercise.category, unit: exercise.unit, default_quantity: exercise.default_quantity, default_calories: exercise.default_calories, active: !exercise.active,
          }, 'PATCH')} /></View>}
      </Card>)}
    </>}
    {tab === 'staff' && canManage && <>
      <Button title="Antrenör ve üye eşleştir" disabled={disabled} onPress={() => setForm({title:'Antrenör ataması',fields:[{key:'trainer_id',label:'Antrenör',options:data.staff.filter(s=>s.status==='active' && isClubTrainer(s.role)).map(s=>({value:s.account_id,label:s.name}))},{key:'athlete_id',label:'Üye',options:data.members.filter(m=>m.status==='active').map(m=>({value:m.account_id,label:m.name}))}],save:async values=>{await coachingRequest(user!.id,`/tenants/${tenantId}/assignments`,{...values,active:true});}})} />
      <Button title="Personel ekle" disabled={disabled} onPress={addStaff} />
      {data.staff.map(person => <Card key={person.id} title={person.name} hint={`${person.email} · ${roleLabels[person.role]} · ${statusLabels[person.status] ?? person.status}`}>
        {person.account_id !== accountId && (isClubAdmin(role) || canonicalRole(person.role) === 'TRAINER') && <View style={ui.row}>
          <Button title={person.status === 'active' ? 'Erişimi durdur' : 'Erişimi aç'} secondary disabled={disabled} onPress={() => confirmAction('Personel erişimini değiştir', `${person.name} adlı kişinin erişimi ${person.status === 'active' ? 'durdurulacak' : 'açılacak'}.`, () => void perform(`${base}/staff/${person.id}`, { status: person.status === 'active' ? 'suspended' : 'active' }, 'PATCH'))} />
          {isClubAdmin(role) && <Select label="Yetki" value={canonicalRole(person.role)} options={[{value:'TRAINER',label:'Antrenör'},{value:'CLUB_MANAGER',label:'Operasyon yöneticisi'},{value:'CLUB_ADMIN',label:'Kulüp yöneticisi'}]} onChange={value => confirmAction('Personel yetkisini değiştir', `${person.name}: ${roleLabels[value]}. Son aktif kulüp yöneticisi korunur.`, () => void perform(`${base}/staff/${person.id}`, {role:value}, 'PATCH'))} />}
          <Button title="Personeli kaldır" danger secondary disabled={disabled} onPress={() => confirmAction('Personeli kaldır', `${person.name} için erişim kaldırılacak. Kayıt geçmişi korunur.`, () => void perform(`${base}/staff/${person.id}`, {status:'removed'}, 'PATCH'))} />
        </View>}
      </Card>)}
    </>}
    {tab === 'administration' && isClubAdmin(role) && <ClubAdministration tenantId={tenantId} name={tenant.name} />}
    {tab === 'activity' && <>
      <Card title="Aktivite geçmişi" hint="En son 100 kayıt. Daha yeni kayıtlar için Yenile’ye dokunun." />
      {!data.activities.length && <Card hint="Henüz aktivite kaydı yok." />}
      {data.activities.map(activity => <Card key={activity.id} title={`${activity.member} · ${activity.exercise}`} hint={activity.email}>
        <ThemedText>{activity.quantity} {unitLabels[activity.unit] ?? activity.unit}{activity.tag ? ` · ${activity.tag}` : ''}</ThemedText>
        <ThemedText style={ui.hint}>{new Date(activity.created_at).toLocaleString('tr-TR')} · {activity.source}</ThemedText>
      </Card>)}
    </>}
    {selectedTag && <ManagementDetailsSheet title={selectedTag.name} onClose={() => setSelectedTagId(null)} busy={disabled}>
      <ThemedText style={ui.hint}>{selectedTag.uid} · {statusLabels[selectedTag.active ? 'active' : 'inactive']}</ThemedText>
      <ThemedText>{selectedTag.exercise ? `${selectedTag.exercise.name} · ${selectedTag.exercise.default_quantity} ${unitLabels[selectedTag.exercise.unit]}` : 'Egzersiz atanmamış'}</ThemedText>
      <ThemedText style={ui.hint}>{selectedTag.read_count} aktivite</ThemedText>
      {canManage && <>
        <Button title="Uygulama bağlantısını karta yaz" disabled={disabled} onPress={() => { setSelectedTagId(null); setWritingTag(selectedTag); }} />
        <Button title="Düzenle / Egzersiz bağla" disabled={disabled} onPress={() => { setSelectedTagId(null); editTag(selectedTag); }} />
        <Button title={selectedTag.active ? 'Pasife al' : 'Etkinleştir'} secondary disabled={disabled} onPress={() => void perform(`${base}/tags/${selectedTag.id}`, { active: !selectedTag.active }, 'PATCH')} />
        <Button title={disabled && mutation.variables?.method === 'DELETE' ? 'Siliniyor…' : 'Kartı sil'} danger secondary disabled={disabled} onPress={() => confirmAction('Kartı sil', 'Kartın salon kaydı silinecek. Geçmiş aktiviteler korunur; kartın belleği değişmez. Devam edilsin mi?', () => {
          void mutation.mutateAsync({ path: `${base}/tags/${selectedTag.id}`, payload: {}, method: 'DELETE', deletedTagId: selectedTag.id }).then(() => setSelectedTagId(null)).catch(err => Alert.alert('Kart silinemedi', errorMessage(err)));
        })} />
      </>}
    </ManagementDetailsSheet>}
    {writingTag && <NfcLinkWriter tag={writingTag} tenantId={tenantId} onClose={() => setWritingTag(null)} />}
    {form && <FormSheet form={form} onClose={() => setForm(null)} />}
  </View>;
}

function PlatformManagement() {
  const { user } = useAuth();
  const palette = getSurfaceColors(useColorScheme());
  const key = ['platform-management', user?.id] as const;
  const query = useQuery({ queryKey: key, queryFn: fetchPlatformOverview, retry: 1 });
  const { mutation, notice, error } = useManagementMutation(key);
  const [form, setForm] = useState<ManagementForm | null>(null);
  const [search, setSearch] = useState('');
  const {refetch} = query;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  if (query.isPending) return <ActivityIndicator color={palette.green} />;
  if (query.error || !query.data) return <Card title="Platform bilgileri alınamadı"><Message error message={errorMessage(query.error)} /><Button title="Yeniden dene" onPress={() => void query.refetch()} /></Card>;
  const editTenant = (tenant?: ManagedTenant) => setForm({
    title: tenant ? `${tenant.name} · Plan ve limitler` : 'Yeni salon oluştur',
    fields: [
      ...(!tenant ? [nameField(), { key: 'slug', label: 'Salon kısa adı', placeholder: 'ornek-spor-salonu', minLength: 2, maxLength: 100, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
        { key: 'owner_name', label: 'Salon sahibinin adı', minLength: 2, maxLength: 160 }, { key: 'owner_email', label: 'Salon sahibinin e-postası', type: 'email' as const }] : []),
      { key: 'plan', label: 'Plan', initial: tenant?.plan ?? 'Sports Center Basic', minLength: 2, maxLength: 80 },
      amountField('member_limit', 'Üye limiti', tenant?.member_limit ?? 50, 1, 100000, true),
      amountField('card_limit', 'Kart limiti', tenant?.card_limit ?? 200, 0, 1000000, true),
      ...(tenant ? [{ key: 'status', label: 'Durum', initial: tenant.status, options: stateOptions }] : []),
    ],
    save: async values => { await mutation.mutateAsync({ path: tenant ? `/platform/tenants/${tenant.id}` : '/platform/tenants', method: tenant ? 'PATCH' : 'POST', payload: { ...values, member_limit: Number(values.member_limit), card_limit: Number(values.card_limit) } }); },
  });
  return <View style={{ gap: 14 }}>
    <Card title="Platform özeti">
      <ThemedText>{query.data.active_tenants} aktif / {query.data.tenant_count} salon</ThemedText>
      <ThemedText>{query.data.member_count} aktif üye · {query.data.pending_joins} bekleyen başvuru</ThemedText>
      <Button title="Yeni salon oluştur" disabled={mutation.isPending} onPress={() => editTenant()} />
      <Button title={query.isRefetching ? 'Yenileniyor…' : 'Yenile'} secondary disabled={query.isRefetching || mutation.isPending} onPress={() => void query.refetch()} />
    </Card>
    {notice !== '' && <Message message={notice} />}{error !== '' && <Message error message={error} />}
    <Search value={search} onChange={setSearch} label="Salon ara" />
    {query.data.tenants.filter(tenant => `${tenant.name} ${tenant.slug}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))).map(tenant => <Card key={tenant.id} title={tenant.name} hint={`${tenant.plan} · ${statusLabels[tenant.status]}`}>
      <ThemedText>{tenant.active_members}/{tenant.member_limit} üye · {tenant.cards}/{tenant.card_limit} kart</ThemedText>
      <Button title="Plan, limit ve durum" secondary disabled={mutation.isPending} onPress={() => editTenant(tenant)} />
    </Card>)}
    {!query.data.tenants.length && <Card hint="Henüz salon oluşturulmadı." />}
    {form && <FormSheet form={form} onClose={() => setForm(null)} />}
  </View>;
}

function Search({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const palette = getSurfaceColors(useColorScheme());
  return <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={label} placeholderTextColor={palette.mutedText} autoCorrect={false}
    style={[ui.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]} />;
}

function confirmAction(title: string, message: string, action: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) action();
    return;
  }
  Alert.alert(title, message, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Onayla', onPress: action }]);
}

function normalizeUid(value: string) {
  const compact = value.replace(/[:\s-]/g, '');
  return compact.length >= 4 && compact.length % 2 === 0 && /^[a-f\d]+$/i.test(compact) ? compact.toUpperCase() : value.trim();
}
