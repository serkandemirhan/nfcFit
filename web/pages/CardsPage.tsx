import React, { FC, useMemo, useState } from 'react';
import { ExerciseType, NfcCard, WellnessType } from '../types';
import { Panel, ProgressBar, formatNumber, formatUnit } from '../components/web-ui';
import { supabase } from '../supabaseClient';

type FormState = {
  name: string;
  domain: 'unassigned' | 'fitness' | 'wellness';
  exerciseTypeId: string;
  wellnessTypeId: string;
  quantity: string;
  unit: string;
  active: boolean;
};

const emptyForm: FormState = {
  name: '',
  domain: 'fitness',
  exerciseTypeId: '',
  wellnessTypeId: '',
  quantity: '10',
  unit: 'repetition',
  active: true,
};

export const CardsPage: FC<{
  cards: NfcCard[];
  exerciseTypes: ExerciseType[];
  wellnessTypes: WellnessType[];
  setNfcCards: React.Dispatch<React.SetStateAction<NfcCard[]>>;
}> = ({ cards, exerciseTypes, wellnessTypes, setNfcCards }) => {
  const [editingCard, setEditingCard] = useState<NfcCard | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => ({
    all: cards.length,
    linked: cards.filter(card => card.action_domain === 'fitness' || card.action_domain === 'wellness').length,
    setup: cards.filter(card => !card.action_domain || card.action_domain === 'unassigned').length,
  }), [cards]);

  const openEdit = (card: NfcCard) => {
    const domain = card.action_domain === 'wellness' || card.action_domain === 'fitness' ? card.action_domain : 'fitness';
    const exerciseType = exerciseTypes.find(type => type.id === card.exercise_type_id) ?? exerciseTypes[0];
    const wellnessType = wellnessTypes.find(type => type.id === card.wellness_type_id) ?? wellnessTypes[0];
    setEditingCard(card);
    setForm({
      name: card.alias ?? card.name ?? '',
      domain,
      exerciseTypeId: card.exercise_type_id ?? exerciseType?.id ?? '',
      wellnessTypeId: card.wellness_type_id ?? wellnessType?.id ?? '',
      quantity: card.quantity ? String(card.quantity) : domain === 'wellness' ? '500' : '10',
      unit: card.unit ?? (domain === 'wellness' ? wellnessType?.unit ?? 'ml' : exerciseType?.unit ?? 'repetition'),
      active: card.active !== false && card.is_active !== false,
    });
  };

  const saveCard = async () => {
    if (!editingCard || !form.name.trim()) return;
    const quantity = Number(form.quantity);
    if (form.domain !== 'unassigned' && quantity <= 0) return;
    const selectedExercise = exerciseTypes.find(type => type.id === form.exerciseTypeId);
    const payload =
      form.domain === 'fitness'
        ? {
            name: form.name.trim(),
            action_domain: 'fitness',
            exercise_type_id: form.exerciseTypeId,
            wellness_type_id: null,
            quantity,
            unit: form.unit,
            calorie_estimate: Number((quantity * Number(selectedExercise?.default_calorie_per_unit ?? 0)).toFixed(2)),
            is_active: form.active,
          }
        : form.domain === 'wellness'
          ? {
              name: form.name.trim(),
              action_domain: 'wellness',
              exercise_type_id: null,
              wellness_type_id: form.wellnessTypeId,
              quantity,
              unit: form.unit,
              calorie_estimate: null,
              is_active: form.active,
            }
          : {
              name: form.name.trim(),
              action_domain: 'unassigned',
              exercise_type_id: null,
              wellness_type_id: null,
              quantity: null,
              unit: null,
              calorie_estimate: null,
              is_active: form.active,
            };

    setSaving(true);
    try {
      const { data, error } = await supabase.from('exercise_tags').update(payload).eq('id', editingCard.id).select().single();
      if (error) throw error;
      setNfcCards(prev => prev.map(card => card.id === editingCard.id ? parseCard(data) : card));
      setEditingCard(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black text-white">Tags</h1>
          <p className="mt-1 text-sm text-slate-400">Bind each NFC tag to a fitness or wellness action</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-green-300">+ Add Tag from Scan</div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat title="All" value={stats.all} />
        <Stat title="Linked" value={stats.linked} />
        <Stat title="Needs Setup" value={stats.setup} />
      </div>

      <Panel className="overflow-hidden">
        <div className="grid grid-cols-[1.1fr_1fr_120px_120px_90px] gap-3 border-b border-white/10 px-5 py-4 text-xs uppercase tracking-wide text-slate-400">
          <span>Tag</span>
          <span>Action</span>
          <span>Quantity</span>
          <span>Status</span>
          <span />
        </div>
        <div className="divide-y divide-white/10">
          {cards.map(card => {
            const actionName = card.action_domain === 'wellness'
              ? wellnessTypes.find(type => type.id === card.wellness_type_id)?.name ?? card.wellness_name
              : exerciseTypes.find(type => type.id === card.exercise_type_id)?.name ?? card.exercise_name;
            const linked = card.action_domain === 'fitness' || card.action_domain === 'wellness';
            return (
              <div key={card.id} className="grid grid-cols-[1.1fr_1fr_120px_120px_90px] items-center gap-3 px-5 py-4 text-sm hover:bg-white/[0.03]">
                <div>
                  <p className="font-bold text-white">{card.alias ?? card.name ?? 'New NFC Tag'}</p>
                  <p className="mt-1 text-xs text-slate-500">{shortUid(card.uid ?? card.nfc_uid)}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-200">{linked ? actionName : 'Not linked yet'}</p>
                  <p className="mt-1 text-xs text-slate-500">{linked ? card.action_domain : 'Setup required'}</p>
                </div>
                <p className="text-slate-300">{card.quantity ? `${formatNumber(Number(card.quantity))} ${formatUnit(card.unit)}` : '-'}</p>
                <span className={`w-fit rounded-md px-2 py-1 text-xs font-bold ${card.active === false || card.is_active === false ? 'bg-red-400/15 text-red-300' : linked ? 'bg-green-400/15 text-green-300' : 'bg-orange-400/15 text-orange-300'}`}>
                  {card.active === false || card.is_active === false ? 'Inactive' : linked ? 'Active' : 'Setup'}
                </span>
                <button onClick={() => openEdit(card)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5">Edit</button>
              </div>
            );
          })}
        </div>
      </Panel>

      {editingCard && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <Panel className="w-full max-w-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">Edit Tag</h2>
                <p className="mt-1 text-sm text-slate-400">{shortUid(editingCard.uid ?? editingCard.nfc_uid)}</p>
              </div>
              <button onClick={() => setEditingCard(null)} className="text-slate-400">Close</button>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Tag name">
                <input value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none focus:border-green-400" />
              </Field>

              <div className="grid grid-cols-3 gap-2 rounded-xl bg-white/[0.04] p-1">
                {(['fitness', 'wellness', 'unassigned'] as const).map(domain => (
                  <button key={domain} onClick={() => {
                    const nextExercise = exerciseTypes[0];
                    const nextWellness = wellnessTypes[0];
                    setForm(prev => ({
                      ...prev,
                      domain,
                      unit: domain === 'wellness' ? nextWellness?.unit ?? 'ml' : domain === 'fitness' ? nextExercise?.unit ?? 'repetition' : prev.unit,
                    }));
                  }} className={`rounded-lg px-3 py-2 text-sm font-bold ${form.domain === domain ? 'bg-green-500 text-[#04120a]' : 'text-slate-300'}`}>
                    {domain === 'unassigned' ? 'Unassigned' : domain[0].toUpperCase() + domain.slice(1)}
                  </button>
                ))}
              </div>

              {form.domain === 'fitness' && (
                <Field label="Exercise">
                  <select value={form.exerciseTypeId} onChange={event => {
                    const next = exerciseTypes.find(type => type.id === event.target.value);
                    setForm(prev => ({ ...prev, exerciseTypeId: event.target.value, unit: next?.unit ?? prev.unit }));
                  }} className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none focus:border-green-400">
                    {exerciseTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </Field>
              )}

              {form.domain === 'wellness' && (
                <Field label="Wellness action">
                  <select value={form.wellnessTypeId} onChange={event => {
                    const next = wellnessTypes.find(type => type.id === event.target.value);
                    setForm(prev => ({ ...prev, wellnessTypeId: event.target.value, unit: next?.unit ?? prev.unit }));
                  }} className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none focus:border-green-400">
                    {wellnessTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </Field>
              )}

              {form.domain !== 'unassigned' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantity">
                    <input type="number" min="1" value={form.quantity} onChange={event => setForm(prev => ({ ...prev, quantity: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none focus:border-green-400" />
                  </Field>
                  <Field label="Unit">
                    <select value={form.unit} onChange={event => setForm(prev => ({ ...prev, unit: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none focus:border-green-400">
                      {(form.domain === 'wellness' ? ['ml', 'cups', 'minutes', 'count'] : ['repetition', 'seconds', 'minutes', 'meters']).map(unit => <option key={unit} value={unit}>{formatUnit(unit)}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
                Active
                <input type="checkbox" checked={form.active} onChange={event => setForm(prev => ({ ...prev, active: event.target.checked }))} className="accent-green-500" />
              </label>

              <button onClick={saveCard} disabled={saving} className="w-full rounded-xl bg-green-500 py-3 text-sm font-black text-[#04120a] disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Tag'}
              </button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
};

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <Panel className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
      <div className="mt-3"><ProgressBar value={value > 0 ? 80 : 0} color="green" /></div>
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function parseCard(raw: any): NfcCard {
  return {
    ...raw,
    uid: raw.uid ?? raw.nfc_uid,
    alias: raw.alias ?? raw.name ?? raw.id,
    active: raw.active ?? raw.is_active ?? true,
    exercise_name: raw.exercise_name ?? raw.exercise_types?.name ?? null,
    wellness_name: raw.wellness_name ?? raw.wellness_types?.name ?? null,
  };
}

function shortUid(uid?: string | null) {
  if (!uid) return 'No UID';
  if (uid.length <= 16) return uid;
  return `${uid.slice(0, 8)}...${uid.slice(-4)}`;
}
