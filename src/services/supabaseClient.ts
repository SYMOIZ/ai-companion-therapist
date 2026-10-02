/// <reference types="vite/client" />

class SupabaseQueryBuilder implements PromiseLike<any> {
  private table: string;
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private filters: { type: string; column: string; value: any }[] = [];
  private selectCols: string = '*';
  private values: any = null;
  private orderCol?: string;
  private orderOpts?: { ascending: boolean };
  private limitCount?: number;
  private isSingle: boolean = false;
  private maybeSingleVal: boolean = false;
  private countOption: string | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
    if (this.action === 'select') {
      this.action = 'select';
    }
    this.selectCols = columns;
    if (options?.count) {
      this.countOption = options.count;
    }
    return this;
  }

  insert(values: any | any[]) {
    this.action = 'insert';
    this.values = values;
    return this;
  }

  update(values: any) {
    this.action = 'update';
    this.values = values;
    return this;
  }

  upsert(values: any) {
    this.action = 'upsert';
    this.values = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ type: 'neq', column, value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ type: 'gte', column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ type: 'lte', column, value });
    return this;
  }

  ilike(column: string, pattern: string) {
    this.filters.push({ type: 'ilike', column, value: pattern });
    return this;
  }

  or(filterString: string) {
    this.filters.push({ type: 'or', column: '', value: filterString });
    return this;
  }

  order(column: string, options?: { ascending: boolean }) {
    this.orderCol = column;
    this.orderOpts = options;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleVal = true;
    return this;
  }

  // Promise-like then method
  async then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      let endpoint = '/api/db/select';
      let bodyData: any = {
        table: this.table,
        filters: this.filters
      };

      if (this.action === 'select') {
        endpoint = '/api/db/select';
        bodyData = {
          ...bodyData,
          select: this.selectCols,
          orderCol: this.orderCol,
          orderOpts: this.orderOpts,
          limit: this.limitCount,
          single: this.isSingle,
          maybeSingle: this.maybeSingleVal
        };
      } else if (this.action === 'insert') {
        endpoint = '/api/db/insert';
        bodyData = {
          ...bodyData,
          values: Array.isArray(this.values) ? this.values : [this.values]
        };
      } else if (this.action === 'update') {
        endpoint = '/api/db/update';
        bodyData = {
          ...bodyData,
          values: this.values
        };
      } else if (this.action === 'upsert') {
        endpoint = '/api/db/upsert';
        bodyData = {
          ...bodyData,
          values: Array.isArray(this.values) ? this.values : [this.values]
        };
      } else if (this.action === 'delete') {
        endpoint = '/api/db/delete';
      }

      let response: Response | null = null;
      let fetchError: any = null;
      const selectLogger = (this.action === 'select' && (this.table === 'therapist_subscriptions' || this.table === 'therapist_boosts'));
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('sukoon_auth_token') || ''}`
            },
            body: JSON.stringify(bodyData)
          });
          fetchError = null;
          break; // Succeeded! Break the retry loop.
        } catch (err: any) {
          fetchError = err;
          if (selectLogger) {
            console.warn(`[SupabaseClient Retry] Attempt ${attempt} failed fetching ${this.table}:`, err.message || err);
          }
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, attempt * 500)); // Exponential backoff: 500ms, 1000ms
          }
        }
      }

      if (fetchError) {
        throw fetchError;
      }

      if (!response) {
        throw new Error("Failed to fetch database endpoint: empty response");
      }

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (err) {
        console.error("Failed to parse DB response as JSON. Endpoint:", endpoint, "BodyData:", bodyData, "ResponseText:", responseText.substring(0, 100));
        throw new Error("Invalid JSON from DB: " + responseText.substring(0, 50));
      }

      if (!response.ok) {
        throw new Error(result.error?.message || 'Database request failed');
      }

      let data = result.data;
      let error = result.error;

      if ((this.isSingle || this.maybeSingleVal) && Array.isArray(data)) {
        if (data.length === 0) {
          if (this.isSingle) {
            error = { message: 'Row not found' };
            data = null;
          } else {
            data = null;
          }
        } else {
          data = data[0];
        }
      }

      // Format response exactly as Supabase expects including count and details
      const responsePayload: any = {
        data,
        error,
        count: Array.isArray(result.data) ? result.data.length : (result.data ? 1 : 0)
      };

      return onfulfilled ? onfulfilled(responsePayload) : responsePayload;
    } catch (error: any) {
      const errPayload = { data: null, error: { message: error.message }, count: null };
      return onfulfilled ? onfulfilled(errPayload) : (errPayload as any);
    }
  }
}

function mapBackendUserToFrontend(raw: any): any {
  if (!raw) return null;
  
  const name = raw.name !== undefined ? raw.name : (raw.display_name !== undefined ? raw.display_name : 'User');
  const preferredLanguage = raw.preferredLanguage !== undefined ? raw.preferredLanguage : (raw.preferred_language || 'English');
  const tonePreference = raw.tonePreference !== undefined ? raw.tonePreference : (raw.tone_preference || 'Friendly');
  const voiceEnabled = raw.voiceEnabled !== undefined ? raw.voiceEnabled : (raw.voice_enabled !== undefined ? !!raw.voice_enabled : false);
  const autoPlayAudio = raw.autoPlayAudio !== undefined ? raw.autoPlayAudio : (raw.auto_play_audio !== undefined ? !!raw.auto_play_audio : false);
  const memoryEnabled = raw.memoryEnabled !== undefined ? raw.memoryEnabled : (raw.memory_enabled !== undefined ? !!raw.memory_enabled : true);
  const therapistStyle = raw.therapistStyle !== undefined ? raw.therapistStyle : (raw.therapist_style || 'gentle');
  const personalityMode = raw.personalityMode !== undefined ? raw.personalityMode : (raw.personality_mode || 'introvert');
  const darkMode = raw.darkMode !== undefined ? raw.darkMode : (raw.dark_mode !== undefined ? !!raw.dark_mode : false);
  const isAdmin = raw.isAdmin !== undefined ? raw.isAdmin : (raw.is_admin !== undefined ? !!raw.is_admin : (raw.role === 'admin' || raw.role === 'staff'));
  const accountStatus = raw.accountStatus !== undefined ? raw.accountStatus : (raw.account_status || 'active');
  const stats = raw.stats !== undefined ? raw.stats : (raw.metadata || { totalActiveDays: 1, lastActiveDate: '', badges: [] });

  return {
    id: raw.id,
    email: raw.email,
    name: name,
    is_anonymous: raw.is_anonymous !== undefined ? !!raw.is_anonymous : false,
    age: raw.age !== undefined ? Number(raw.age) : 25,
    region: raw.region || 'Global',
    gender: raw.gender || 'Other',
    profession: raw.profession || 'Other',
    preferredLanguage: preferredLanguage,
    tonePreference: tonePreference,
    voiceEnabled: voiceEnabled,
    autoPlayAudio: autoPlayAudio,
    memoryEnabled: memoryEnabled,
    therapistStyle: therapistStyle,
    personalityMode: personalityMode,
    darkMode: darkMode,
    isAdmin: isAdmin,
    role: raw.role || 'patient',
    accountStatus: accountStatus,
    accountType: raw.accountType,
    stats: stats
  };
}

async function safeJson(response: Response, endpoint: string) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error(`Invalid JSON from ${endpoint}:`, text.substring(0, 100));
        return { data: null, error: { message: "Invalid server response: " + text.substring(0, 50) } };
    }
}

const authClient = {
  signUp: async (credentials: any) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      const result = await safeJson(response, '/api/auth/signup');
      if (result.error) throw new Error(result.error.message);
      const mappedUser = mapBackendUserToFrontend(result.data?.user);
      if (result.data?.session?.access_token) {
        localStorage.setItem('sukoon_auth_token', result.data.session.access_token);
        localStorage.setItem('sukoon_current_user', JSON.stringify(mappedUser));
      }
      return {
        data: {
          user: mappedUser,
          session: result.data?.session ? {
            access_token: result.data.session.access_token,
            refresh_token: '',
            expires_in: 3600,
            token_type: 'bearer' as "bearer",
            user: mappedUser
          } : null
        },
        error: null
      };
    } catch (error: any) {
      return { data: { user: null, session: null }, error: { message: error.message } };
    }
  },

  signInWithDemo: async (role: 'client' | 'therapist' | 'admin') => {
    try {
      const response = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      const result = await safeJson(response, '/api/auth/demo-login');
      if (result.error) throw new Error(result.error.message);
      const mappedUser = mapBackendUserToFrontend(result.data?.user);
      if (result.data?.session?.access_token) {
        localStorage.setItem('sukoon_auth_token', result.data.session.access_token);
        localStorage.setItem('sukoon_current_user', JSON.stringify(mappedUser));
      }
      return {
        data: {
          user: mappedUser,
          session: result.data?.session ? {
            access_token: result.data.session.access_token,
            refresh_token: '',
            expires_in: 3600,
            token_type: 'bearer' as "bearer",
            user: mappedUser
          } : null
        },
        error: null
      };
    } catch (error: any) {
      return { data: { user: null, session: null }, error: { message: error.message } };
    }
  },

  signInWithPassword: async (credentials: any) => {
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      try {
        const logClone = response.clone();
        console.log("=== RESPONSE TRACE ===");
        console.log(logClone.status);
        console.log(logClone.headers.get("content-type"));
        console.log(await logClone.text());
        console.log("======================");
      } catch (logErr) {
        console.error("Log trace error:", logErr);
      }
      const result = await safeJson(response, '/api/auth/signin');
      if (result.error) throw new Error(result.error.message);
      const mappedUser = mapBackendUserToFrontend(result.data?.user);
      if (result.data?.session?.access_token) {
        localStorage.setItem('sukoon_auth_token', result.data.session.access_token);
        localStorage.setItem('sukoon_current_user', JSON.stringify(mappedUser));
      }
      return {
        data: {
          user: mappedUser,
          session: result.data?.session ? {
            access_token: result.data.session.access_token,
            refresh_token: '',
            expires_in: 3600,
            token_type: 'bearer' as "bearer",
            user: mappedUser
          } : null
        },
        error: null
      };
    } catch (error: any) {
      return { data: { user: null, session: null }, error: { message: error.message } };
    }
  },

  signInAnonymously: async () => {
    try {
      const response = await fetch('/api/auth/signin_anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await safeJson(response, '/api/auth/signin_anonymous');
      if (result.error) throw new Error(result.error.message);
      const mappedUser = mapBackendUserToFrontend(result.data?.user);
      if (result.data?.session?.access_token) {
        localStorage.setItem('sukoon_auth_token', result.data.session.access_token);
        localStorage.setItem('sukoon_current_user', JSON.stringify(mappedUser));
      }
      return {
        data: {
          user: mappedUser,
          session: result.data?.session ? {
            access_token: result.data.session.access_token,
            refresh_token: '',
            expires_in: 3600,
            token_type: 'bearer' as "bearer",
            user: mappedUser
          } : null
        },
        error: null
      };
    } catch (error: any) {
      return { data: { user: null, session: null }, error: { message: error.message } };
    }
  },

  getUser: async () => {
    try {
      const token = localStorage.getItem('sukoon_auth_token');
      if (!token) return { data: { user: null }, error: null };
      
      const response = await fetch('/api/auth/user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await safeJson(response, '/api/auth/user');
      if (!response.ok || result.error) {
        localStorage.removeItem('sukoon_auth_token');
        localStorage.removeItem('sukoon_current_user');
        return { data: { user: null }, error: { message: result.error?.message || 'Token authentication failed' } };
      }
      const mappedUser = mapBackendUserToFrontend(result.data.user);
      localStorage.setItem('sukoon_current_user', JSON.stringify(mappedUser));
      return { data: { user: mappedUser }, error: null };
    } catch (error: any) {
      return { data: { user: null }, error: { message: error.message } };
    }
  },

  updateUser: async (attributes: any) => {
    try {
      const token = localStorage.getItem('sukoon_auth_token');
      const cached = localStorage.getItem('sukoon_current_user');
      const user = cached ? JSON.parse(cached) : null;
      if (!token || !user) return { data: { user: null }, error: { message: 'Not logged in' } };

      const response = await fetch('/api/db/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          table: 'users',
          values: attributes.data || attributes,
          filters: [{ type: 'eq', column: 'id', value: user.id }]
        })
      });
      const result = await safeJson(response, '/api/db/update');
      if (result.error) throw new Error(result.error.message);

      const updatedUser = Array.isArray(result.data) ? result.data[0] : result.data;
      const mappedUser = mapBackendUserToFrontend(updatedUser);
      if (mappedUser) {
        localStorage.setItem('sukoon_current_user', JSON.stringify(mappedUser));
      }
      return { data: { user: mappedUser }, error: null };
    } catch (error: any) {
      return { data: { user: null }, error: { message: error.message } };
    }
  },

  getSession: async () => {
    try {
      const token = localStorage.getItem('sukoon_auth_token');
      if (!token) return { data: { session: null }, error: null };
      const cached = localStorage.getItem('sukoon_current_user');
      const user = cached ? mapBackendUserToFrontend(JSON.parse(cached)) : null;
      return {
        data: {
          session: {
            access_token: token,
            refresh_token: '',
            expires_in: 3600,
            token_type: 'bearer' as "bearer",
            user
          }
        },
        error: null
      };
    } catch (e) {
      return { data: { session: null }, error: null };
    }
  },

  onAuthStateChange: (callback: any) => {
    // Return unsubscribe payload
    return { data: { subscription: { unsubscribe: () => {} } } };
  },

  signOut: async () => {
    localStorage.removeItem('sukoon_auth_token');
    localStorage.removeItem('sukoon_current_user');
    return { error: null };
  }
};

const storageClient = {
  from: (bucket: string) => ({
    upload: async (path: string, file: any) => {
      // Mock successful document upload for application workflows
      return { data: { path }, error: null };
    },
    download: async (path: string) => {
      return { data: new Blob(), error: null };
    },
    remove: async (paths: string[]) => {
      return { data: null, error: null };
    },
    createSignedUrl: async (_path: string, _expiresIn: number) => {
      return { data: null, error: { message: 'Object not found' } };
    }
  })
};

export const supabase = {
  auth: authClient,
  storage: storageClient,
  from: (table: string) => {
    return new SupabaseQueryBuilder(table);
  },
  rpc: async (fnName: string, args: any) => {
    try {
      const response = await fetch('/api/db/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sukoon_auth_token') || ''}`
        },
        body: JSON.stringify({ name: fnName, args })
      });
      const result = await response.json();
      return result;
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }
};
