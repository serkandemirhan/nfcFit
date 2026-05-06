import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useBackendInDev = import.meta.env.DEV && import.meta.env.VITE_USE_SUPABASE_IN_DEV !== 'true';

type QueryResult<T = any> = { data: T | null; error: Error | null };
type Operation = 'select' | 'insert' | 'update' | 'delete';

const endpointFor = (table: string, id?: string) => `/api/${table}${id ? `/${encodeURIComponent(id)}` : ''}`;

const normalizeFromBackend = (table: string, value: any): any => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => normalizeFromBackend(table, item));

  switch (table) {
    case 'users':
      return { ...value, avatarurl: value.avatarUrl ?? value.avatarurl };
    case 'cards':
      return {
        ...value,
        secretcode: value.secretCode ?? value.secretcode,
        alias: value.alias ?? value.id,
        assignedlocationid: value.assignedLocationId ?? value.assignedlocationid ?? null,
        assignedLocationId: value.assignedLocationId ?? value.assignedlocationid ?? null,
        active: value.active ?? true,
      };
    case 'locations':
      return {
        ...value,
        layoutid: value.layoutId ?? value.layoutid,
        nfccardid: value.nfcCardId ?? value.nfccardid ?? null,
        nfcCardId: value.nfcCardId ?? value.nfccardid ?? null,
      };
    case 'layouts':
      return { ...value, imageurl: value.imageUrl ?? value.imageurl };
    case 'tasks':
      return {
        ...value,
        createdat: value.createdAt ?? value.createdat,
        duedate: value.dueDate ?? value.duedate,
        lastcompletedat: value.lastCompletedAt ?? value.lastcompletedat,
        completionnotes: value.completionNotes ?? value.completionnotes,
        locationid: value.locationId ?? value.locationid,
        userid: value.userId ?? value.userid,
      };
    case 'attachments':
      return { ...value, taskid: value.taskId ?? value.taskid };
    default:
      return value;
  }
};

const normalizeToBackend = (table: string, payload: any): any => {
  if (!payload || typeof payload !== 'object') return payload;
  const data = { ...payload };

  if (table === 'users') {
    data.avatarUrl = data.avatarUrl ?? data.avatarurl;
  }
  if (table === 'cards') {
    data.secretCode = data.secretCode ?? data.secretcode;
    data.assignedLocationId = data.assignedLocationId ?? data.assignedlocationid;
  }
  if (table === 'locations') {
    data.layoutId = data.layoutId ?? data.layoutid;
    data.nfcCardId = data.nfcCardId ?? data.nfccardid;
  }
  if (table === 'layouts') {
    data.imageUrl = data.imageUrl ?? data.imageurl;
  }
  if (table === 'tasks') {
    data.locationId = data.locationId ?? data.locationid;
    data.userId = data.userId ?? data.userid;
    data.dueDate = data.dueDate ?? data.duedate;
    data.lastCompletedAt = data.lastCompletedAt ?? data.lastcompletedat;
    data.completionNotes = data.completionNotes ?? data.completionnotes;
    if (!data.repeat && (data.repeat_frequency || data.repeat_unit)) {
      data.repeat = data.repeat_unit
        ? { frequency: data.repeat_frequency ?? 1, unit: data.repeat_unit }
        : null;
    }
  }
  if (table === 'attachments') {
    data.taskId = data.taskId ?? data.taskid;
  }

  return data;
};

class BackendQuery {
  private operation: Operation = 'select';
  private payload: any = null;
  private filters: Record<string, any> = {};

  constructor(private table: string) {}

  select() {
    this.operation = this.operation === 'select' ? 'select' : this.operation;
    return this;
  }

  order() {
    return this;
  }

  insert(payload: any) {
    this.operation = 'insert';
    this.payload = Array.isArray(payload) ? payload[0] : payload;
    return this;
  }

  update(payload: any) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters[column] = value;
    return this;
  }

  async single() {
    const result = await this.execute();
    if (result.error) return result;
    const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
    return { data, error: null };
  }

  async maybeSingle() {
    return this.single();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult> {
    try {
      const id = this.filters.id;
      const method = this.operation === 'insert'
        ? 'POST'
        : this.operation === 'update'
          ? 'PUT'
          : this.operation === 'delete'
            ? 'DELETE'
            : 'GET';

      const response = await fetch(endpointFor(this.table, method === 'POST' ? undefined : id), {
        method,
        headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
        body: method === 'GET' || method === 'DELETE'
          ? undefined
          : JSON.stringify(normalizeToBackend(this.table, this.payload)),
      });

      if (!response.ok) {
        const message = await response.text();
        return { data: null, error: new Error(message || `${response.status} ${response.statusText}`) };
      }

      if (response.status === 204) {
        return { data: null, error: null };
      }

      const json = await response.json();
      return { data: normalizeFromBackend(this.table, json), error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }
}

const createBackendClient = () => ({
  from(table: string) {
    return new BackendQuery(table);
  },
  storage: {
    from(bucket: string) {
      return {
        async upload() {
          return { data: null, error: null };
        },
        async remove() {
          return { data: null, error: null };
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `/dev-storage/${bucket}/${path}` } };
        },
      };
    },
  },
});

export const supabase: any = useBackendInDev
  ? createBackendClient()
  : createClient(supabaseUrl, supabaseAnonKey);
