import MemberProgramSchedule from "./MemberProgramSchedule";
import type { WorkspaceAction } from "./FacilityAdminLayout";
import { createActivityWorkflow, type PendingActivity, type ActivityIntent } from "../mobile/nfc-task-tracker/lib/activity-workflow";
import { consoleTransport } from "../mobile/nfc-task-tracker/lib/console-transport";
import { canonicalRole, isClubAdmin, isClubOperator, isClubTrainer } from "./club-roles";
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
const CoachingConsole = React.lazy(() => import('./CoachingConsole'));
const FacilityAdminLayout = React.lazy(() => import('./FacilityAdminLayout'));
import { supabase } from './supabaseClient';

type Account = { id: string; email: string; name: string; is_platform_admin: boolean };
type Tenant = { id: string; name: string; slug: string; status: string; plan: string; member_limit: number; card_limit: number; active_members: number; pending_joins: number; cards: number };
type Member = { id: string; account_id: string; name: string; email: string; status: string; source: string; requested_at: string };
type Exercise = { id: string; name: string; category: string; unit: string; default_quantity: number; default_calories: number; active: boolean };
type Tag = { id: string; uid: string; name: string; exercise_id: string | null; active: boolean; read_count: number; last_scanned_at: string | null; exercise: Exercise | null };
type Staff = { id: string; account_id: string; name: string; email: string; role: string; status: string };
type Activity = { id: string; member: string; email: string; exercise: string; quantity: number; unit: string; source: string; tag: string | null; created_at: string };
type PersonalActivity = { id: string; tenant_id: string; tenant_name: string; exercise: string; quantity: number; unit: string; source: string; tag: string | null; created_at: string };

const roleName = (role: string) => ({CLUB_ADMIN:'Kulüp yöneticisi',CLUB_MANAGER:'Operasyon yöneticisi',TRAINER:'Antrenör',CLUB_MEMBER:'Üye',PLATFORM_ADMIN:'Platform yöneticisi'}[canonicalRole(role)] ?? 'Yetki tanınmadı');

const API_ORIGIN = (import.meta.env.VITE_CONSOLE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
const API = `${API_ORIGIN}/api/console`;
const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500';
const buttonClass = 'rounded-xl bg-[#16803C] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#126b32] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClass = 'rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800';

async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  return consoleTransport(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }, async response => {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw Object.assign(new Error(typeof body?.detail === "string" ? body.detail : `İşlem tamamlanamadı (${response.status}). Alanları kontrol edin.`),{status:response.status});
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
  });
}

export default function TenantConsoleApp() {
  const [token, setToken] = useState('');
  const [workspace,setWorkspace]=useState<'facility'|'coaching'|'platform'>('facility');
  const [account, setAccount] = useState<Account | null>(null);
  const [staffTenants, setStaffTenants] = useState<Array<{ tenant_id: string; tenant_name: string; tenant_slug: string; role: string; status: string; tenant_status?: string }>>([]);
  const [memberTenants, setMemberTenants] = useState<Array<{ tenant_id: string; tenant_name: string; status: string }>>([]);
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [registerMode, setRegisterMode] = useState(false);
  const [formBusy, setFormBusy] = useState(false);

  useEffect(() => {
    const auth = supabase.auth;
    if (!auth?.getSession || !auth?.onAuthStateChange) {
      setError('Supabase authentication is not configured for this web application.');
      setLoading(false);
      return;
    }
    let active = true;
    let sessionToken = '';
    const applyToken = (next: string) => {
      if (next !== sessionToken) { sessionToken = next; setLoading(Boolean(next)); }
      setToken(next);
    };
    const { data: { subscription } } = auth.onAuthStateChange((_event: string, session: { access_token: string } | null) => {
      if (!active) return;
      applyToken(session?.access_token ?? '');
      if (!session) {
        setAccount(null);
        setStaffTenants([]);
        setMemberTenants([]);
        setTenantId('');
        setLoading(false);
      }
    });
    void auth.getSession().then(({ data, error: sessionError }: { data: { session: { access_token: string } | null }; error: Error | null }) => {
      if (!active) return;
      if (sessionError) throw sessionError;
      applyToken(data.session?.access_token ?? '');
    }).catch((sessionError: unknown) => {
      if (active) {
        setError(sessionError instanceof Error ? sessionError.message : 'Unable to load your Supabase session.');
        setLoading(false);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void request<{ account: Account; memberships: Array<{ tenant_id: string; tenant_name: string; status: string }>; staff: typeof staffTenants }>('/auth/me', token)
      .then(me => {
        if (active) {
          setAccount(me.account);
          setStaffTenants(me.staff.filter(item => item.status === 'active' && (item.tenant_status == null || item.tenant_status === 'active')));
          setMemberTenants(me.memberships);
          const activeStaff = me.staff.filter(item => item.status === 'active' && (item.tenant_status == null || item.tenant_status === 'active'));
          setTenantId(current => current && activeStaff.some(item => item.tenant_id === current) ? current : activeStaff[0]?.tenant_id ?? '');
        }
      })
      .catch((identityError: unknown) => {
        if (active) {
          setError(identityError instanceof Error ? identityError.message : 'Unable to load your account.');
          setAccount(null);
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  const signOut = async () => {
    const { error: authError } = await supabase.auth.signOut();
    if (authError) {
      setError(authError.message);
      return;
    }
    setAccount(null);
    setStaffTenants([]);
    setMemberTenants([]);
    setTenantId('');
    setError('');
    setNotice('');
  };

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFormBusy(true);
    setError('');
    try {
      if (!supabase.auth?.signInWithPassword || !supabase.auth?.signUp) {
        throw new Error('Supabase authentication is not configured for this web application.');
      }
      const email = String(form.get('email')).trim().toLowerCase();
      const password = String(form.get('password'));
      if (registerMode) {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: String(form.get('name')).trim() } },
        });
        if (authError) throw authError;
        if (!data.session) {
          setNotice('Hesabın oluşturuldu. E-postanı doğruladıktan sonra giriş yapabilirsin.');
          return;
        }
        setToken(data.session.access_token);
        setNotice('Hesabın oluşturuldu. Kulüp kartını okutarak üyelik isteği gönder.');
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        if (!data.session) throw new Error('Sign-in did not return an active session.');
        setToken(data.session.access_token);
        setNotice('');
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.');
    } finally {
      setFormBusy(false);
    }
  };

  if (loading) return <ConsoleShell><div className="p-10 text-center text-slate-300">Çalışma alanın yükleniyor…</div></ConsoleShell>;
  if (!account) {
    return (
      <ConsoleShell>
        <div className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-7 shadow-2xl">
          <div className="mb-7">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">NFCFit Yönetim</p>
            <h1 className="mt-3 text-3xl font-black text-white">{registerMode ? 'Hesabını oluştur' : 'Tekrar hoş geldin'}</h1>
            <p className="mt-2 text-sm text-slate-400">Kulüp işlemleri, üyelikler ve NFC egzersiz kayıtları.</p>
          </div>
          <form className="space-y-4" onSubmit={submitAuth}>
            {registerMode && <Field label="Ad soyad"><input className={inputClass} name="name" required minLength={2} maxLength={160} /></Field>}
            <Field label="E-posta"><input className={inputClass} name="email" type="email" required autoComplete="email" /></Field>
            <Field label="Şifre"><input className={inputClass} name="password" type="password" required minLength={12} maxLength={72} autoComplete={registerMode ? 'new-password' : 'current-password'} /><span className="mt-1 block text-xs text-slate-500">En az 12 karakter kullan.</span></Field>
            {error && <Notice kind="error">{error}</Notice>}
            <button className={`${buttonClass} w-full`} disabled={formBusy}>{formBusy ? 'Bekleyin…' : registerMode ? 'Hesap oluştur' : 'Giriş yap'}</button>
          </form>
          <button className="mt-5 w-full text-sm font-semibold text-emerald-400 hover:text-emerald-300" onClick={() => { setRegisterMode(value => !value); setError(''); }}>
            {registerMode ? 'Hesabın var mı? Giriş yap' : 'Yeni üye misin? Kulüp hesabı oluştur'}
          </button>
          {!registerMode && <p className="mt-6 border-t border-slate-800 pt-4 text-xs leading-5 text-slate-500">İlk platform yöneticisi güvenli sunucu yapılandırmasıyla tanımlanır.</p>}
        </div>
      </ConsoleShell>
    );
  }

  const staff = staffTenants.find(item => item.tenant_id === tenantId);
  const isPlatformAdmin = account.is_platform_admin;
  const isStaff = Boolean(staff);
  const isOperator = Boolean(staff && isClubOperator(staff.role));
  const isTrainer = Boolean(staff && isClubTrainer(staff.role));
  const platformWorkspace = isPlatformAdmin && (workspace === 'platform' || !isStaff);
  const facilityWorkspace = !platformWorkspace && isOperator && (workspace === 'facility' || !isTrainer);
  const workspaceActions: WorkspaceAction[] = (isPlatformAdmin || (isOperator && isTrainer)) ? [
    ...(isPlatformAdmin ? [{ id: 'platform' as const, label: 'Platform', active: workspace === 'platform', onSelect: () => setWorkspace('platform') }] : []),
    ...(isOperator ? [{ id: 'facility' as const, label: 'Tesis yönetimi', active: workspace === 'facility', onSelect: () => setWorkspace('facility') }] : []),
    ...(isTrainer ? [{ id: 'coaching' as const, label: 'Antrenör alanı', active: workspace === 'coaching', onSelect: () => setWorkspace('coaching') }] : []),
  ] : [];
  const accountControls = <div className="flex items-center gap-3">
    {isStaff && staffTenants.length > 1 && <select className={inputClass} value={tenantId} onChange={event => setTenantId(event.target.value)} aria-label="Select sports center">{staffTenants.map(item => <option key={item.tenant_id} value={item.tenant_id}>{item.tenant_name}</option>)}</select>}
    <div className="hidden text-right sm:block"><p className="text-sm font-bold text-white">{account.name}</p><p className="text-xs capitalize text-slate-400">{platformWorkspace ? 'Platform yöneticisi' : staff ? roleName(staff.role) : 'Üye'}</p></div>
    <button className={secondaryButtonClass} onClick={signOut}>Çıkış yap</button>
  </div>;
  const messages = <>{error && <Notice kind="error">{error}</Notice>}{notice && <Notice kind="success">{notice}</Notice>}</>;
  return (
    <ConsoleShell trainer={isTrainer && !platformWorkspace} facility={facilityWorkspace}>
      {!facilityWorkspace && <><header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">NFCFit · {platformWorkspace ? 'Platform' : isStaff ? 'Kulüp' : 'Üye'}</p>
          <h1 className="mt-1 text-2xl font-black text-white">{platformWorkspace ? 'Platform yönetimi' : isTrainer && !isOperator ? 'Antrenör paneli' : isStaff ? 'Kulüp yönetimi' : 'Kulüplerim'}</h1>
        </div>
        {accountControls}
      </header>
      {messages}
      {!!workspaceActions.length && <nav className="mb-5 flex flex-wrap gap-3" aria-label="Çalışma alanı">
        {workspaceActions.map(action => <button key={action.id} className={action.active ? buttonClass : secondaryButtonClass} onClick={action.onSelect}>{action.label}</button>)}
      </nav>}</>}
      {isPlatformAdmin && (workspace==='platform' || !isStaff) ? <PlatformConsole token={token}/> :
        isOperator && (workspace==='facility' || !isTrainer) ? <React.Suspense fallback={<p role="status">Tesis yönetimi yükleniyor…</p>}><ClubConsole key={`${account.id}-${tenantId}-${staff?.role}`} token={token} tenantId={tenantId} role={staff!.role} onError={setError} onNotice={setNotice} accountControls={accountControls} workspaces={workspaceActions} messages={messages}/></React.Suspense> :
        isTrainer ? <React.Suspense fallback={<p role="status">Antrenör alanı yükleniyor…</p>}><CoachingConsole key={`${account.id}-${tenantId}`} token={token} tenantId={tenantId}/></React.Suspense> :
        <MemberConsole key={account.id} accountId={account.id} token={token} memberships={memberTenants} onError={setError} onNotice={setNotice}/>}

    </ConsoleShell>
  );
}

function ConsoleShell({ children, trainer = false, facility = false }: { children: React.ReactNode; trainer?: boolean; facility?: boolean }) {
  return <main className={facility ? "facility-shell-root" : "min-h-screen bg-[#030B16] px-4 py-6 text-slate-100 sm:px-7 lg:px-10"}><div className={facility ? "facility-shell" : trainer ? "trainer-shell mx-auto" : "mx-auto max-w-7xl"}>{children}</div></main>;
}

function PlatformConsole({ token }: { token: string }) {
  const [overview, setOverview] = useState<{ tenant_count: number; active_tenants: number; member_count: number; pending_joins: number; tenants: Tenant[]; subscription_requests:{id:string;tenant_id:string;requested_plan:string}[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const refresh = useCallback(() => request<typeof overview>('/platform/overview', token).then(setOverview).catch(err => setError(err.message)), [token]);
  useEffect(() => { void refresh(); }, [refresh]);

  const createTenant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError('');
    try {
      await request('/platform/tenants', token, { method: 'POST', body: JSON.stringify({
        name: form.get('name'), slug: form.get('slug'), plan: form.get('plan'),
        member_limit: Number(form.get('member_limit')), card_limit: Number(form.get('card_limit')),
        owner_name: form.get('owner_name'), owner_email: form.get('owner_email'),
      }) });
      formElement.reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create sports center.');
    } finally { setBusy(false); }
  };

  const updateTenant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTenant) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await request(`/platform/tenants/${editingTenant.id}`, token, { method: 'PATCH', body: JSON.stringify({
        plan: form.get('plan'),
        member_limit: Number(form.get('member_limit')),
        card_limit: Number(form.get('card_limit')),
        status: form.get('status'),
      }) });
      setEditingTenant(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update sports center.');
    } finally { setBusy(false); }
  };

  return <div className="space-y-6">
    {error && <Notice kind="error">{error}</Notice>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Kulüpler" value={overview?.tenant_count ?? '—'} hint="Tüm kulüpler" />
      <Metric label="Aktif kulüpler" value={overview?.active_tenants ?? '—'} hint="Etkin kulüpler" />
      <Metric label="Aktif üyeler" value={overview?.member_count ?? '—'} hint="Tüm kulüplerde" />
      <Metric label="Bekleyen başvurular" value={overview?.pending_joins ?? '—'} hint="Kulüp onayı bekliyor" />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
      <Panel title="Kulüpler" subtitle="Kulüp durumu, planı ve kullanım limitleri">
        {!overview?.tenants.length ? <Empty>Henüz kulüp oluşturulmadı.</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[690px] text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs uppercase text-slate-500"><th className="p-3">Center</th><th className="p-3">Plan</th><th className="p-3">Üyeler</th><th className="p-3">NFC kartları</th><th className="p-3">Durum</th><th className="p-3"></th></tr></thead><tbody>{overview.tenants.map(tenant => <tr key={tenant.id} className="border-b border-slate-800/70"><td className="p-3"><strong className="block text-white">{tenant.name}</strong><span className="text-xs text-slate-500">{tenant.slug}</span></td><td className="p-3">{tenant.plan}</td><td className="p-3">{tenant.active_members}/{tenant.member_limit}</td><td className="p-3">{tenant.cards}/{tenant.card_limit}</td><td className="p-3"><Status value={tenant.status} /></td><td className="p-3"><button className={secondaryButtonClass} onClick={() => setEditingTenant(tenant)}>Yönet</button></td></tr>)}</tbody></table></div>}
      </Panel>
      <Panel title="Kulüp oluştur" subtitle="Kulüp ve ilk kulüp yöneticisi birlikte oluşturulur">
        <form className="space-y-3" onSubmit={createTenant}>
          <Field label="Kulüp adı"><input className={inputClass} name="name" required minLength={2} /></Field>
          <Field label="Kulüp kısa adı"><input className={inputClass} name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="northside-fitness" /></Field>
          <Field label="Plan"><input className={inputClass} name="plan" defaultValue="Sports Center Basic" required /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Üye limiti"><input className={inputClass} name="member_limit" type="number" defaultValue="50" min="1" /></Field><Field label="NFC kart limiti"><input className={inputClass} name="card_limit" type="number" defaultValue="200" min="0" /></Field></div>
          <Field label="Kulüp yöneticisinin adı"><input className={inputClass} name="owner_name" required /></Field>
          <Field label="Kulüp yöneticisinin e-postası"><input className={inputClass} name="owner_email" type="email" required /></Field>
          <p className="text-xs leading-5 text-slate-400">Kulüp yöneticisi bu e-postaya ait doğrulanmış hesabıyla giriş yapar. Hesabını kulüp oluşturulmadan önce veya sonra açabilir.</p>
          <button className={buttonClass} disabled={busy}>{busy ? 'Oluşturuluyor…' : 'Kulübü oluştur'}</button>
        </form>
      </Panel>
    </div>
    <Panel title="Abonelik talepleri" subtitle="Bu işlem ödeme tahsil etmez. Plan ve limitleri platform politikasına göre onaylayın.">{overview?.subscription_requests?.map(r=><form key={r.id} className="mb-4 flex flex-wrap items-end gap-3" onSubmit={async e=>{e.preventDefault();const values=new FormData(e.currentTarget);setBusy(true);setError('');try{await request(`/platform/subscription-requests/${r.id}/review`,token,{method:'POST',body:JSON.stringify({decision:'approve',member_limit:Number(values.get('member_limit')),card_limit:Number(values.get('card_limit'))})});await refresh();}catch(err){setError(err instanceof Error?err.message:'İşlem tamamlanamadı.');}finally{setBusy(false);}}}>
      <strong>{overview.tenants.find(t=>t.id===r.tenant_id)?.name} · {r.requested_plan}</strong>
      <Field label="Üye limiti"><input className={inputClass} type="number" name="member_limit" min={1} defaultValue={overview.tenants.find(t=>t.id===r.tenant_id)?.member_limit} required/></Field>
      <Field label="Kart limiti"><input className={inputClass} type="number" name="card_limit" min={0} defaultValue={overview.tenants.find(t=>t.id===r.tenant_id)?.card_limit} required/></Field>
      <button className={buttonClass} disabled={busy}>Onayla</button><button type="button" className={secondaryButtonClass} disabled={busy} onClick={async()=>{setBusy(true);try{await request(`/platform/subscription-requests/${r.id}/review`,token,{method:'POST',body:JSON.stringify({decision:'reject'})});await refresh();}catch(err){setError(err instanceof Error?err.message:'İşlem tamamlanamadı.');}finally{setBusy(false);}}}>Reddet</button>
    </form>)}</Panel>
    {editingTenant && <Panel title={`Manage ${editingTenant.name}`} subtitle="Update plan capacity and operational status">
      <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={updateTenant}>
        <Field label="Plan"><input className={inputClass} name="plan" defaultValue={editingTenant.plan} required /></Field>
        <Field label="Üye limiti"><input className={inputClass} name="member_limit" type="number" defaultValue={editingTenant.member_limit} min="1" required /></Field>
        <Field label="NFC kart limiti"><input className={inputClass} name="card_limit" type="number" defaultValue={editingTenant.card_limit} min="0" required /></Field>
        <Field label="Durum"><select className={inputClass} name="status" defaultValue={editingTenant.status}><option value="active">Aktif</option><option value="suspended">Askıda</option></select></Field>
        <div className="flex gap-2 sm:col-span-2 xl:col-span-4"><button className={buttonClass} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}</button><button type="button" className={secondaryButtonClass} onClick={() => setEditingTenant(null)}>Vazgeç</button></div>
      </form>
    </Panel>}
  </div>;
}

type ClubTab = 'equipment' | 'administration' | 'overview' | 'members' | 'tags' | 'exercises' | 'staff' | 'activity';

function ClubConsole({ token, tenantId, role, onError, onNotice, accountControls, workspaces, messages }: { token: string; tenantId: string; role: string; onError: (value: string) => void; onNotice: (value: string) => void; accountControls: React.ReactNode; workspaces: WorkspaceAction[]; messages: React.ReactNode }) {
  const [tab, setTab] = useState<ClubTab>('overview');
  const [dashboard, setDashboard] = useState<{ tenant: Tenant; activities_today: number; inactive_members: number } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [busy, setBusy] = useState(false);
  const [tagUid, setTagUid] = useState('');
  const canManage = isClubOperator(role);
  const [loading,setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const refreshAll = useCallback(async () => {
    setLoading(true);
    onError('');
    try {
      const [dash, memberRows, tagRows, exerciseRows, staffRows, activityRows] = await Promise.all([
        request<typeof dashboard>(`/tenants/${tenantId}/dashboard`, token),
        request<Member[]>(`/tenants/${tenantId}/members`, token),
        request<Tag[]>(`/tenants/${tenantId}/tags`, token),
        request<Exercise[]>(`/tenants/${tenantId}/exercises`, token),
        canManage ? request<Staff[]>(`/tenants/${tenantId}/staff`, token) : Promise.resolve([]),
        request<Activity[]>(`/tenants/${tenantId}/activities?limit=100`, token),
      ]);
      setDashboard(dash);
      setMembers(memberRows);
      setTags(tagRows);
      setExercises(exerciseRows);
      setStaff(staffRows);
      setActivities(activityRows);
    } catch (err) { onError(err instanceof Error ? err.message : 'Kulüp bilgileri alınamadı. Yeniden deneyin.'); } finally { setLoading(false); }
  }, [canManage, onError, tenantId, token]);

  useEffect(() => { void refreshAll(); }, [refreshAll]);

  const submit = async (event: FormEvent<HTMLFormElement>, endpoint: string, after?: () => void, method: 'POST' | 'PATCH' = 'POST') => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload: Record<string, FormDataEntryValue | number | boolean | null> = Object.fromEntries(form.entries());
    for (const key of ['default_quantity', 'default_calories']) if (key in payload) payload[key] = Number(payload[key]);
    if ('active' in payload) payload.active = payload.active === 'true';
    if ('exercise_id' in payload && payload.exercise_id === '') payload.exercise_id = null;
    if (method === 'PATCH' && editingTag && payload.exercise_id === editingTag.exercise_id) delete payload.exercise_id;
    setBusy(true);
    onError('');
    onNotice('');
    try {
      await request(endpoint, token, { method, body: JSON.stringify(payload) });
      formElement.reset();
      after?.();
      onNotice('Değişiklik kaydedildi.');
      await refreshAll();
    } catch (err) { onError(err instanceof Error ? err.message : 'İşlem kaydedilemedi.'); }
    finally { setBusy(false); }
  };

  const actionFlight = useRef(false);
  const runAction = async (action:()=>Promise<unknown>, notice:string) => {
    if(actionFlight.current)return;
    actionFlight.current=true;setBusy(true);onError('');onNotice('');
    try{await action();onNotice(notice);await refreshAll();}
    catch(error){onError(error instanceof Error?error.message:'İşlem tamamlanamadı.');}
    finally{actionFlight.current=false;setBusy(false);}
  };
  const review = async (member: Member, decision:'approve'|'reject') => {
    if(decision==='reject'&&!window.confirm(`${member.name} için üyelik isteği reddedilsin mi?`))return;
    await runAction(()=>request(`/tenants/${tenantId}/join-requests/${member.id}/review`,token,{method:'POST',body:JSON.stringify({decision})}),decision==='approve'?'Üyelik onaylandı.':'Üyelik isteği reddedildi.');
  };
  const setMemberStatus = async (member:Member)=>{
    const status=member.status==='active'?'suspended':'active';
    if(status==='suspended'&&!window.confirm(`${member.name} için üyelik askıya alınsın mı? Geçmiş kayıtlar korunur.`))return;
    await runAction(()=>request(`/tenants/${tenantId}/members/${member.id}`,token,{method:'PATCH',body:JSON.stringify({status})}),'Üyelik güncellendi.');
  };
  const toggleTag = async (tag:Tag)=>{
    if(tag.active&&!window.confirm(`${tag.name} pasife alınsın mı? Bu karttan yeni kayıt yapılamayacak.`))return;
    await runAction(()=>request(`/tenants/${tenantId}/tags/${tag.id}`,token,{method:'PATCH',body:JSON.stringify({active:!tag.active})}),'Kart durumu güncellendi.');
  };
  const updateStaff = async(person:Staff,changes:{role?:string;status?:string})=>{
    if(changes.status==='suspended'&&!window.confirm(`${person.name} adlı personelin erişimi durdurulsun mu?`))return;
    await runAction(()=>request(`/tenants/${tenantId}/staff/${person.id}`,token,{method:'PATCH',body:JSON.stringify(changes)}),'Personel erişimi güncellendi.');
  };

  const tabs: Array<{ id: ClubTab; label: string }> = [
    { id: 'overview', label: 'Özet' }, { id: 'members', label: 'Üyeler' },
    { id: 'tags', label: 'NFC kartları' }, {id:'equipment',label:'Ekipman'}, { id: 'exercises', label: 'Egzersizler' },
    ...(canManage ? [{ id: 'staff' as const, label: 'Personel' }] : []), { id: 'activity', label: 'Aktiviteler' }, ...(isClubAdmin(role) ? [{id:'administration' as const,label:'Abonelik ve ayarlar'}] : []),
  ];

  const filteredMembers = useMemo(() => members.filter(member => `${member.name} ${member.email}`.toLowerCase().includes(filter.toLowerCase())), [filter, members]);
  const pending = members.filter(member => member.status === 'pending');
  if(!dashboard) return <FacilityAdminLayout sections={tabs} selected={tab} navigate={id => { setTab(id as ClubTab); void refreshAll(); }} tenantName="Tesis yönetimi" summary={loading ? 'Bilgiler yükleniyor…' : 'Bilgiler alınamadı'} accountControls={accountControls} workspaces={workspaces} messages={messages}>
    <Panel title="Tesis bilgileri"><p role="status">{loading ? 'Yükleniyor…' : 'Bilgiler alınamadı.'}</p><button className={buttonClass} disabled={loading} onClick={()=>void refreshAll()}>Yeniden dene</button></Panel>
  </FacilityAdminLayout>;

  return <FacilityAdminLayout sections={tabs} selected={tab} navigate={id => { setTab(id as ClubTab); onError(''); void refreshAll(); }} tenantName={dashboard.tenant.name}
    summary={`${dashboard.tenant.plan} · ${dashboard.tenant.active_members}/${dashboard.tenant.member_limit} üye · ${dashboard.tenant.cards}/${dashboard.tenant.card_limit} NFC kartı`}
    accountControls={accountControls} workspaces={workspaces} messages={messages}>

    {tab === 'overview' && <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Üyeler" value={dashboard?.tenant.active_members ?? '—'} hint={`Capacity ${dashboard?.tenant.member_limit ?? '—'}`} />
        <Metric label="Bekleyen başvurular" value={dashboard?.tenant.pending_joins ?? '—'} hint="İnceleme bekliyor" />
        <Metric label="NFC kartları" value={dashboard?.tenant.cards ?? '—'} hint={`Capacity ${dashboard?.tenant.card_limit ?? '—'}`} />
        <Metric label="Activities today" value={dashboard?.activities_today ?? '—'} hint="Kaydedilen aktiviteler" />
      </div>
      <Panel title="Üyelik başvuruları" subtitle="Üyelerin aktivite kaydedebilmesi için başvurularını onaylayın">
        {pending.length ? <MemberTable members={pending} canManage={canManage} onReview={review} /> : <Empty>Bekleyen üyelik başvurusu yok.</Empty>}
      </Panel>
      <Panel title="Son aktiviteler"><ActivityTable activities={activities.slice(0, 6)} /></Panel>
    </div>}

    {tab === 'members' && <Panel title="Üyeler" subtitle="Üyeleri arayın ve katılım başvurularını değerlendirin">
      <input className={`${inputClass} mb-4 max-w-sm`} aria-label="Üye ara" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Ad veya e-posta ara" />
      <form className="mb-4 grid gap-3 sm:grid-cols-3" onSubmit={event=>void submit(event,`/tenants/${tenantId}/members`)}><input className={inputClass} name="name" placeholder="Üye adı" aria-label="Üye adı" required/><input className={inputClass} type="email" name="email" placeholder="E-posta" aria-label="Üye e-postası" required/><button className={buttonClass} disabled={busy}>Üye ekle</button></form>
      <MemberTable members={filteredMembers} canManage={canManage} onReview={review} onStatus={setMemberStatus} onRemove={member=>{if(window.confirm('Üyelik kaldırılsın mı? Geçmiş kayıtlar korunur.')) void request(`/tenants/${tenantId}/members/${member.id}`,token,{method:'DELETE'}).then(refreshAll).catch(e=>onError(e.message));}} />
    </Panel>}

    {tab === 'tags' && <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
      <Panel title="NFC tag inventory" subtitle="Tags are shared by the center; activity belongs to the scanning member">
        {!tags.length ? <Empty>No NFC tags registered.</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs uppercase text-slate-500"><th className="p-3">Tag</th><th className="p-3">Exercise defaults</th><th className="p-3">Scans</th><th className="p-3">Durum</th>{canManage && <th className="p-3"></th>}</tr></thead><tbody>{tags.map(tag => <tr key={tag.id} className="border-b border-slate-800/70"><td className="p-3"><strong className="block text-white">{tag.name}</strong><span className="font-mono text-xs text-slate-500">{tag.uid}</span></td><td className="p-3">{tag.exercise?.name ?? 'Unassigned'}<span className="block text-xs text-slate-400">{tag.exercise?.default_quantity} {tag.exercise?.unit}</span></td><td className="p-3">{tag.read_count}</td><td className="p-3"><Status value={tag.active ? 'active' : 'inactive'} /></td>{canManage && <td className="p-3"><div className="flex gap-2"><button className={secondaryButtonClass} onClick={() => setEditingTag(tag)}>Düzenle</button><button className={secondaryButtonClass} onClick={() => void toggleTag(tag)}>{tag.active ? 'Pasife al' : 'Etkinleştir'}</button></div></td>}</tr>)}</tbody></table></div>}
      </Panel>
      {canManage && <Panel title={editingTag ? `Edit ${editingTag.name}` : 'Register NFC tag'} subtitle="Register the UID now; assign an exercise whenever you are ready">
        {!editingTag && <p className="mb-3 text-xs leading-5 text-slate-400">Read the card UID with the mobile NFC test screen, then enter it here. No reader integration is required in this web console.</p>}
        <form key={editingTag?.id ?? 'new-tag'} className="space-y-3" onSubmit={event => void submit(event, editingTag ? `/tenants/${tenantId}/tags/${editingTag.id}` : `/tenants/${tenantId}/tags`, () => { setEditingTag(null); setTagUid(''); }, editingTag ? 'PATCH' : 'POST')}>
          <Field label="Tag name"><input className={inputClass} name="name" required minLength={2} placeholder="Plank zone" defaultValue={editingTag?.name ?? ''} /></Field>
          {!editingTag && <Field label="NFC UID"><input className={inputClass} name="uid" value={tagUid} onChange={event => setTagUid(event.target.value)} required minLength={4} placeholder="Example: 04A1B2C3" autoCapitalize="characters" /></Field>}
          <Field label="Exercise (optional)"><select className={inputClass} name="exercise_id" defaultValue={editingTag?.exercise_id ?? ''}><option value="">Assign later</option>{exercises.filter(exercise => exercise.active || exercise.id === editingTag?.exercise_id).map(exercise => <option key={exercise.id} value={exercise.id}>{exercise.name} · {exercise.default_quantity} {exercise.unit}</option>)}</select></Field>
          <input type="hidden" name="active" value={editingTag ? String(editingTag.active) : 'true'} />
          <div className="flex gap-2"><button className={buttonClass} disabled={busy}>{busy ? 'Kaydediliyor…' : editingTag ? 'Save tag' : 'Add tag'}</button>{editingTag && <button type="button" className={secondaryButtonClass} onClick={() => setEditingTag(null)}>Vazgeç</button>}</div>
        </form>
      </Panel>}
    </div>}

    {tab === 'exercises' && <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel title="Egzersiz kataloğu" subtitle="Set the default shown after an NFC tag is scanned">
        {exercises.length ? <div className="divide-y divide-slate-800">{exercises.map(exercise => <div key={exercise.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong className="text-white">{exercise.name}</strong><p className="text-xs text-slate-400">{exercise.category} · {exercise.default_quantity} {exercise.unit} · {exercise.default_calories} kcal</p></div><div className="flex items-center gap-2"><Status value={exercise.active ? 'active' : 'inactive'} />{canManage && <button className={secondaryButtonClass} onClick={() => setEditingExercise(exercise)}>Düzenle</button>}</div></div>)}</div> : <Empty>No exercises configured.</Empty>}
      </Panel>
      {canManage && <Panel title={editingExercise ? `Edit ${editingExercise.name}` : 'Egzersiz ekle'}><form key={editingExercise?.id ?? 'new-exercise'} className="space-y-3" onSubmit={event => void submit(event, editingExercise ? `/tenants/${tenantId}/exercises/${editingExercise.id}` : `/tenants/${tenantId}/exercises`, () => setEditingExercise(null), editingExercise ? 'PATCH' : 'POST')}>
        <Field label="Ad"><input className={inputClass} name="name" required minLength={2} placeholder="Plank" defaultValue={editingExercise?.name ?? ''} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Kategori"><select className={inputClass} name="category" defaultValue={editingExercise?.category ?? 'strength'}><option value="strength">Kuvvet</option><option value="core">Core</option><option value="cardio">Kardiyo</option><option value="mobility">Hareketlilik</option><option value="rehab">Rehabilitasyon</option><option value="other">Diğer</option></select></Field><Field label="Birim"><select className={inputClass} name="unit" defaultValue={editingExercise?.unit ?? 'seconds'}><option value="seconds">Saniye</option><option value="repetition">Tekrar</option><option value="minutes">Dakika</option><option value="meters">Metre</option></select></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Varsayılan miktar"><input className={inputClass} name="default_quantity" type="number" min="0.1" step="any" defaultValue={editingExercise?.default_quantity ?? 30} required /></Field><Field label="Kalori (isteğe bağlı)"><input className={inputClass} name="default_calories" type="number" min="0" step="any" defaultValue={editingExercise?.default_calories ?? 0} /></Field></div>
        <Field label="Durum"><select className={inputClass} name="active" defaultValue={String(editingExercise?.active ?? true)}><option value="true">Aktif</option><option value="false">Pasif</option></select></Field>
        <div className="flex gap-2"><button className={buttonClass} disabled={busy}>{busy ? 'Kaydediliyor…' : editingExercise ? 'Egzersizi kaydet' : 'Egzersiz ekle'}</button>{editingExercise && <button type="button" className={secondaryButtonClass} onClick={() => setEditingExercise(null)}>Vazgeç</button>}</div>
      </form></Panel>}
    </div>}

    {tab === 'staff' && canManage && <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel title="Kulüp personeli" subtitle={isClubAdmin(role) ? "Kulüp yöneticileri, operasyon yöneticileri ve antrenörler" : "Antrenör erişimlerini yönetin"}>
        {staff.length ? <div className="divide-y divide-slate-800">{staff.map(person => <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong className="text-white">{person.name}</strong><p className="text-sm text-slate-400">{person.email}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold capitalize">{roleName(person.role)} · {person.status}</span>{(isClubAdmin(role) || canonicalRole(person.role) === 'TRAINER') && <><button className={secondaryButtonClass} onClick={() => void updateStaff(person, { status: person.status === 'active' ? 'suspended' : 'active' })}>{person.status === 'active' ? 'Askıya al' : 'Yeniden etkinleştir'}</button>{isClubAdmin(role) && <select className={inputClass} aria-label={`${person.name} yetkisi`} value={canonicalRole(person.role)} onChange={e=>{if(window.confirm('Personel yetkisi değiştirilsin mi? Son aktif Club Admin korunur.')) void updateStaff(person,{role:e.target.value});}}><option value="TRAINER">Antrenör</option><option value="CLUB_MANAGER">Operasyon yöneticisi</option><option value="CLUB_ADMIN">Kulüp yöneticisi</option></select>}<button className={secondaryButtonClass} onClick={()=>{if(window.confirm('Personel erişimi kaldırılsın mı? Geçmiş korunur.')) void updateStaff(person,{status:'removed'});}}>Kaldır</button></>}</div></div>)}</div> : <Empty>Henüz personel eklenmedi.</Empty>}
      </Panel>
      <Panel title="Antrenör ve üye eşleştir" subtitle="Atama, yalnızca seçilen üyenin antrenman performansına yetki verir. Sağlık verileri ayrıca izin gerektirir."><form className="space-y-3" onSubmit={event=>void submit(event,`/coaching/tenants/${tenantId}/assignments`)}>
        <Field label="Antrenör"><select className={inputClass} name="trainer_id" required>{staff.filter(s=>s.status==='active'&&isClubTrainer(s.role)).map(s=><option key={s.id} value={s.account_id}>{s.name}</option>)}</select></Field>
        <Field label="Üye"><select className={inputClass} name="athlete_id" required>{members.filter(m=>m.status==='active').map(m=><option key={m.id} value={m.account_id}>{m.name}</option>)}</select></Field>
        <input type="hidden" name="active" value="true"/><button className={buttonClass} disabled={busy}>Atamayı kaydet</button>
      </form></Panel>
      <Panel title="Personel ekle" subtitle="Personel, bu e-postayla açılmış doğrulanmış hesabıyla giriş yapar. Otomatik davet e-postası gönderilmez.">
        <form className="space-y-3" onSubmit={event => void submit(event, `/tenants/${tenantId}/staff`)}>
          <Field label="Ad"><input className={inputClass} name="name" required /></Field>
          <Field label="E-posta"><input className={inputClass} name="email" type="email" required /></Field>
          <Field label="Yetki"><select className={inputClass} name="role"><option value="TRAINER">Antrenör</option>{isClubAdmin(role) && <option value="CLUB_MANAGER">Operasyon yöneticisi</option>}</select></Field>
          <button className={buttonClass} disabled={busy}>{busy ? 'Ekleniyor…' : 'Personeli ekle'}</button>
        </form>
      </Panel>
    </div>}

    {tab === 'equipment' && canManage && <ClubEquipment token={token} tenantId={tenantId} tags={tags}/>}
    {tab === 'administration' && isClubAdmin(role) && <ClubAdministration token={token} tenantId={tenantId} onError={onError} />}
    {tab === 'activity' && <Panel title="Üye aktiviteleri" subtitle="Bu kulüpte kartla ve elle kaydedilen aktiviteler"><ActivityTable activities={activities} /></Panel>}
  </FacilityAdminLayout>;
}

function MemberTable({ members, canManage, onReview, onStatus, onRemove }: { members: Member[]; canManage: boolean; onReview: (member: Member, decision: 'approve' | 'reject') => void; onStatus?: (member: Member) => void; onRemove?: (member:Member)=>void }) {
  if (!members.length) return <Empty>Gösterilecek üye yok.</Empty>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs uppercase text-slate-500"><th className="p-3">Üye</th><th className="p-3">Kaynak</th><th className="p-3">Başvuru tarihi</th><th className="p-3">Durum</th><th className="p-3">İşlemler</th></tr></thead><tbody>{members.map(member => <tr key={member.id} className="border-b border-slate-800/70"><td className="p-3"><strong className="block text-white">{member.name}</strong><span className="text-xs text-slate-500">{member.email}</span></td><td className="p-3 capitalize">{member.source}</td><td className="p-3 text-slate-400">{new Date(member.requested_at).toLocaleDateString()}</td><td className="p-3"><Status value={member.status} /></td><td className="p-3"><div className="flex gap-2">{canManage && member.status === 'pending' && <><button className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-bold" onClick={() => onReview(member, 'approve')}>Onayla</button><button className="rounded-lg bg-rose-900 px-2.5 py-1.5 text-xs font-bold" onClick={() => onReview(member, 'reject')}>Reddet</button></>}{canManage && onStatus && ['active', 'suspended', 'removed'].includes(member.status) && <button className={secondaryButtonClass} onClick={() => onStatus(member)}>{member.status === 'active' ? 'Askıya al' : 'Yeniden etkinleştir'}</button>}{canManage && onRemove && member.status !== 'removed' && <button className={secondaryButtonClass} onClick={()=>onRemove(member)}>Kaldır</button>}</div></td></tr>)}</tbody></table></div>;
}

function ActivityTable({ activities }: { activities: Activity[] }) {
  if (!activities.length) return <Empty>Henüz aktivite kaydedilmedi.</Empty>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs uppercase text-slate-500"><th className="p-3">Üye</th><th className="p-3">Exercise</th><th className="p-3">Miktar</th><th className="p-3">Kaynak / kart</th><th className="p-3">Tarih ve saat</th></tr></thead><tbody>{activities.map(item => <tr key={item.id} className="border-b border-slate-800/70"><td className="p-3"><strong className="text-white">{item.member}</strong><span className="block text-xs text-slate-500">{item.email}</span></td><td className="p-3">{item.exercise}</td><td className="p-3">{item.quantity} {item.unit}</td><td className="p-3 capitalize">{item.source}{item.tag ? ` · ${item.tag}` : ''}</td><td className="p-3 text-slate-400">{new Date(item.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>;
}

function PersonalActivityTable({ activities }: { activities: PersonalActivity[] }) {
  if (!activities.length) return <Empty>Henüz aktivite kaydedilmedi.</Empty>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-slate-800 text-xs uppercase text-slate-500"><th className="p-3">Kulüp</th><th className="p-3">Exercise</th><th className="p-3">Miktar</th><th className="p-3">Kaynak / kart</th><th className="p-3">Tarih ve saat</th></tr></thead><tbody>{activities.map(item => <tr key={item.id} className="border-b border-slate-800/70"><td className="p-3 text-white">{item.tenant_name}</td><td className="p-3">{item.exercise}</td><td className="p-3">{item.quantity} {item.unit}</td><td className="p-3 capitalize">{item.source}{item.tag ? ` · ${item.tag}` : ''}</td><td className="p-3 text-slate-400">{new Date(item.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>;
}

function MemberConsole({ accountId, token, memberships, onError, onNotice }: { accountId:string; token: string; memberships: Array<{ tenant_id: string; tenant_name: string; status: string }>; onError: (value: string) => void; onNotice: (value: string) => void }) {
  const [requests, setRequests] = useState<Array<{ membership_id: string; tenant_id: string; tenant_name: string; status: string; source: string; requested_at: string; review_note: string | null }>>([]);
  const [activities, setActivities] = useState<PersonalActivity[]>([]);
  const [uid, setUid] = useState('');
  const [quantity, setQuantity] = useState('');
  const [offer, setOffer] = useState<{ tag: { id: string; name: string }; tenant: { name: string }; exercise: Exercise } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending,setPending]=useState<PendingActivity|null>(null);
  const submitting=useRef(false);
  const workflow=useMemo(()=>createActivityWorkflow({getItem:async key=>localStorage.getItem(key),setItem:async(key,value)=>localStorage.setItem(key,value),removeItem:async key=>localStorage.removeItem(key)},
    (tag,amount,requestId)=>request('/nfc/record',token,{method:'POST',body:JSON.stringify({tag_id:tag,quantity:amount,request_id:requestId})}),()=>crypto.randomUUID()),[token]);
  useEffect(()=>{let active=true;void workflow.load(accountId).then(value=>{if(active)setPending(value);}).catch(e=>onError(e.message));return()=>{active=false;};},[accountId,workflow,onError]);
  const refresh = useCallback(async () => {
    try {
      const [joinRequests, activityRows] = await Promise.all([
        request<typeof requests>('/me/join-requests', token),
        request<PersonalActivity[]>('/me/activities?limit=30', token),
      ]);
      setRequests(joinRequests);
      setActivities(activityRows);
    } catch (err) { onError(err instanceof Error ? err.message : 'Aktiviteler alınamadı. Listeyi yenileyin.'); }
  }, [onError, token]);
  useEffect(() => { void refresh(); }, [refresh]);
  const displayedMemberships = requests.length
    ? requests.map(item => ({ tenant_id: item.tenant_id, tenant_name: item.tenant_name, status: item.status }))
    : memberships;
  const scan = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setOffer(null); onError(''); onNotice('');
    try {
      const result = await request<any>('/nfc/scan', token, { method: 'POST', body: JSON.stringify({ uid }) });
      if (result.result === 'join_request_pending') {
        onNotice(`${result.tenant.name} için üyelik isteği gönderildi. Onaylandıktan sonra aktivite kaydedebilirsiniz.`);
        await refresh();
      } else if (result.result === 'tag_unassigned') {
        onNotice('Kart kayıtlı, henüz egzersiz bağlanmamış. Kulüp yöneticinizden egzersiz atamasını isteyin.');
      } else {
        setOffer(result);
        setQuantity(String(result.exercise.default_quantity));
      }
    } catch (err) { onError(err instanceof Error ? err.message : 'Kart kontrol edilemedi.'); }
    finally { setBusy(false); }
  };
  const record = async (existing?: ActivityIntent) => {
    if(submitting.current || (!offer && !existing)) return;
    submitting.current=true;setBusy(true);onError('');
    try {
      const intent=existing??{tagId:offer!.tag.id,quantity:Number(quantity.replace(',','.')),exercise:offer!.exercise.name,exerciseId:offer!.exercise.id,unit:offer!.exercise.unit,tenant:offer!.tenant.name};
      const saved=await workflow.submit(accountId,intent);
      onNotice(`${intent.exercise} · ${saved.quantity} ${intent.unit} kaydedildi.`);
      setPending(null);setOffer(null);await refresh();
    }catch(err){onError(err instanceof Error?err.message:'Aktivite onaylanamadı.');setPending(await workflow.load(accountId));}
    finally{submitting.current=false;setBusy(false);}
  };
  return <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
    <MemberProgramSchedule token={token}/>
    <Panel title="Kulübe katıl" subtitle="Üyelik isteği göndermek için kulüp kartının UID’sini girin">
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={scan}><input className={inputClass} value={uid} onChange={event => setUid(event.target.value)} minLength={4} required placeholder="NFC kart UID" /><button className={buttonClass} disabled={busy}>{busy ? 'Kontrol ediliyor…' : 'Kartı kontrol et'}</button></form>
      {pending && <div className="my-4 rounded-xl border border-amber-700 p-4"><p>{pending.exercise} · {pending.quantity} {pending.unit}: önceki gönderimin sonucu bekleniyor. Yeniden deneme ikinci kayıt oluşturmaz.</p><button className={buttonClass} disabled={busy} onClick={()=>void record(pending)}>Bekleyen kaydı kontrol et</button></div>}
      {offer && <div className="mt-5 rounded-2xl border border-emerald-800 bg-emerald-950/40 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-300">{offer.tenant.name} · {offer.tag.name}</p><h3 className="mt-2 text-lg font-black text-white">{offer.exercise.name}</h3><p className="mt-1 text-sm text-slate-300">Varsayılan: {offer.exercise.default_quantity} {offer.exercise.unit}</p><Field label={`Miktarı onayla (${offer.exercise.unit})`}><input className={`${inputClass} mt-2 max-w-48`} type="number" min="0.1" max="100000" step="any" value={quantity} onChange={event => setQuantity(event.target.value)} /></Field><p className="mt-2 text-xs text-slate-400">Bu aktiviteyi hesabınıza eklemek için onaylayın.</p><button className={`${buttonClass} mt-4`} disabled={busy || Number(quantity) <= 0} onClick={() => void record()}>Onayla ve kaydet</button></div>}
    </Panel>
    <Panel title="Kulüplerim" subtitle="Birden fazla kulübe üye olabilirsiniz">
      {displayedMemberships.length ? <div className="divide-y divide-slate-800">{displayedMemberships.map(item => <div key={item.tenant_id} className="flex items-center justify-between gap-3 py-3"><div><strong className="text-white">{item.tenant_name}</strong><p className="text-xs capitalize text-slate-400">{item.status}</p></div><Status value={item.status} /></div>)}</div> : <Empty>Henüz kulüp üyeliğiniz yok. Kart UID’siyle üyelik isteği gönderin.</Empty>}
    </Panel>
    <div className="lg:col-span-2"><Panel title="Son aktivitelerim" subtitle="Kulüplerinizde kaydettiğiniz aktiviteler"><PersonalActivityTable activities={activities} /></Panel></div>
  </div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-800 bg-[#071827] p-5 shadow-lg"><div className="mb-4"><h2 className="font-black text-white">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}</div>{children}</section>;
}
function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-[#071827] p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-semibold text-slate-300">{label}{children}</label>;
}
function Notice({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
  return <p role={kind === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-xl border p-3 text-sm ${kind === 'error' ? 'border-rose-800 bg-rose-950/50 text-rose-200' : 'border-emerald-800 bg-emerald-950/50 text-emerald-200'}`}>{children}</p>;
}
function Status({ value }: { value: string }) {
  const color = value === 'active' ? 'bg-emerald-950 text-emerald-300' : value === 'pending' ? 'bg-amber-950 text-amber-300' : 'bg-slate-800 text-slate-300';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${color}`}>{value}</span>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-800 px-4 py-7 text-center text-sm text-slate-500">{children}</p>;
}

function ClubAdministration({token,tenantId,onError}:{token:string;tenantId:string;onError:(value:string)=>void}) {
  const [data,setData]=useState<{tenant:Tenant;billing_status:string;billing_profile:{legal_name:string;billing_email:string;tax_id:string;address:string};requests:{id:string;requested_plan:string;status:string}[]}|null>(null);
  const [logs,setLogs]=useState<{id:string;action:string;created_at:string}[]>([]);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const refresh=useCallback(async()=>{
    const [subscription,audit]=await Promise.all([
      request<NonNullable<typeof data>>(`/tenants/${tenantId}/subscription`,token),
      request<typeof logs>(`/tenants/${tenantId}/audit`,token),
    ]);
    setData(subscription);setLogs(audit);
  },[tenantId,token]);
  useEffect(()=>{void refresh().catch(e=>onError(e.message));},[refresh,onError]);
  const save=async(event:FormEvent<HTMLFormElement>,path:string,method:string)=>{
    event.preventDefault();const payload=Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true);setNotice('');onError('');
    try{await request(`/tenants/${tenantId}/${path}`,token,{method,body:JSON.stringify(payload)});setNotice('Kaydedildi.');await refresh();}
    catch(e){onError(e instanceof Error?e.message:'Kaydedilemedi.');}finally{setBusy(false);}
  };
  if(!data)return <Panel title="Abonelik ve ayarlar"><p role="status">Yükleniyor…</p><button className={secondaryButtonClass} onClick={()=>void refresh().catch(e=>onError(e.message))}>Yeniden dene</button></Panel>;
  return <div className="space-y-5">
    {notice&&<Notice kind="success">{notice}</Notice>}
    <Panel title="Kulüp aboneliği" subtitle="Faturalama platform tarafından yönetilir. Plan talebi onaylanana kadar limitler değişmez.">
      <p>{data.tenant.plan} · Üye {data.tenant.active_members}/{data.tenant.member_limit} · Kart {data.tenant.cards}/{data.tenant.card_limit}</p>
      <form className="mt-4 flex flex-wrap gap-3" onSubmit={e=>void save(e,'subscription/requests','POST')}><input className={inputClass} aria-label="İstenen kulüp planı" name="requested_plan" minLength={2} maxLength={80} placeholder="İstenen kulüp planı" required/><button className={buttonClass} disabled={busy}>Plan değişikliği talep et</button></form>
      {data.requests.map(r=><p key={r.id}>{r.requested_plan} · {r.status==='pending'?'İnceleme bekliyor':r.status}</p>)}
    </Panel>
    <Panel title="Fatura bilgileri" subtitle="Kart bilgileri uygulamada saklanmaz; tahsilat platform üzerinden yapılır."><form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>void save(e,'billing-profile','PATCH')}>
      <Field label="Fatura unvanı"><input className={inputClass} name="legal_name" minLength={2} maxLength={200} defaultValue={data.billing_profile.legal_name} required/></Field>
      <Field label="Fatura e-postası"><input className={inputClass} name="billing_email" type="email" defaultValue={data.billing_profile.billing_email} required/></Field>
      <Field label="Vergi numarası"><input className={inputClass} name="tax_id" maxLength={80} defaultValue={data.billing_profile.tax_id}/></Field>
      <Field label="Fatura adresi"><input className={inputClass} name="address" maxLength={1000} defaultValue={data.billing_profile.address}/></Field>
      <button className={buttonClass} disabled={busy}>Fatura bilgilerini kaydet</button>
    </form></Panel>
    <Panel title="Kulüp ayarları"><form className="flex flex-wrap gap-3" onSubmit={e=>void save(e,'settings','PATCH')}><input className={inputClass} aria-label="Kulüp adı" name="name" defaultValue={data.tenant.name} minLength={2} maxLength={160} required/><button className={buttonClass} disabled={busy}>Kaydet</button></form></Panel>
    <Panel title="Denetim kayıtları" subtitle="En son 200 işlem; özel sağlık verileri içermez.">{logs.length?logs.map(r=><p key={r.id}>{new Date(r.created_at).toLocaleString()} · {r.action}</p>):<Empty>Henüz işlem yok.</Empty>}</Panel>
  </div>;
}

function ClubEquipment({token,tenantId,tags}:{token:string;tenantId:string;tags:Tag[]}) {
  type Equipment = {id:string;name:string;equipment_type:string;tag_id:string|null;exercise_ids:string[];active:boolean};
  const [rows,setRows]=useState<Equipment[]>([]);
  const [library,setLibrary]=useState<{id:string;name:string}[]>([]);
  const [editing,setEditing]=useState<Equipment|null>(null);
  const [draftId,setDraftId]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [equipment,exercises]=await Promise.all([
        request<Equipment[]>(`/coaching/tenants/${tenantId}/equipment`,token),
        request<{id:string;name:string}[]>('/coaching/library',token),
      ]);
      setRows(equipment);setLibrary(exercises);
    }finally{setLoading(false);}
  },[tenantId,token]);
  useEffect(()=>{void refresh().catch(e=>setError(e.message));},[refresh]);
  const save=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    const form=new FormData(event.currentTarget);
    try{
      await request(`/coaching/tenants/${tenantId}/equipment`,token,{method:'POST',body:JSON.stringify({
        id:editing?.id??draftId,name:form.get('name'),equipment_type:form.get('equipment_type'),
        tag_id:form.get('tag_id')||null,exercise_ids:form.getAll('exercise_ids'),active:form.get('active')==='true',
      })});
      await refresh();setEditing(null);setDraftId(crypto.randomUUID());setNotice('Ekipman kaydedildi.');
    }catch(e){setError(e instanceof Error?e.message:'Ekipman kaydedilemedi.');}finally{setBusy(false);}
  };
  return <div className="grid gap-5 xl:grid-cols-2">
    <Panel title="Ekipman" subtitle="Kulübe ait ekipman, kart ve kütüphane egzersizi eşleştirmeleri">
      {error&&<Notice kind="error">{error}</Notice>}{notice&&<Notice kind="success">{notice}</Notice>}
      {loading?<p role="status">Yükleniyor…</p>:rows.length?rows.map(row=><div key={row.id} className="flex items-center justify-between gap-3 border-b border-slate-800 py-3"><div><strong>{row.name}</strong><p className="text-sm text-slate-400">{row.equipment_type} · {row.exercise_ids.length} egzersiz · {row.active?'Aktif':'Pasif'}</p></div><button className={secondaryButtonClass} disabled={busy} onClick={()=>setEditing(row)}>Düzenle</button></div>):<Empty>Henüz ekipman tanımlanmadı.</Empty>}
      <button className={`${secondaryButtonClass} mt-3`} disabled={busy||loading} onClick={()=>void refresh().catch(e=>setError(e.message))}>Yenile</button>
    </Panel>
    <Panel title={editing?'Ekipmanı düzenle':'Ekipman ekle'}><form key={editing?.id??draftId} className="space-y-3" onSubmit={e=>void save(e)}>
      <Field label="Ekipman adı"><input className={inputClass} name="name" defaultValue={editing?.name} minLength={2} maxLength={160} required/></Field>
      <Field label="Ekipman türü"><input className={inputClass} name="equipment_type" defaultValue={editing?.equipment_type??'machine'} minLength={2} maxLength={80} required/></Field>
      <Field label="NFC kartı (isteğe bağlı)"><select className={inputClass} name="tag_id" defaultValue={editing?.tag_id??''}><option value="">Kart bağlama</option>{tags.map(t=><option key={t.id} value={t.id}>{t.name} · {t.uid}</option>)}</select></Field>
      <Field label="Kütüphane egzersizleri"><select multiple size={8} className={inputClass} name="exercise_ids" defaultValue={editing?.exercise_ids??[]} required>{library.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
      <Field label="Durum"><select className={inputClass} name="active" defaultValue={String(editing?.active??true)}><option value="true">Aktif</option><option value="false">Pasif</option></select></Field>
      <button className={buttonClass} disabled={busy||loading||!library.length}>{busy?'Kaydediliyor…':'Kaydet'}</button>{editing&&<button type="button" className={`${secondaryButtonClass} ml-3`} onClick={()=>setEditing(null)}>Vazgeç</button>}
    </form></Panel>
  </div>;
}
