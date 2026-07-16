import { create } from 'zustand';

export interface Profile {
  id: string;
  role: 'patient' | 'pharmacy';
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface MockUser {
  id: string;
  email: string;
}

interface MockSession {
  user: MockUser;
}

interface AuthState {
  session: MockSession | null;
  user: MockUser | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  loginMock: (phone: string, role: 'patient' | 'pharmacy', fullName?: string) => void;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  loginMock: (phone, role, fullName) => {
    const userId = `mock-user-${Date.now()}`;
    const mockUser = {
      id: userId,
      email: `${phone.replace(/\s+/g, '')}@example.com`,
    };
    const mockSession = { user: mockUser };
    const mockProfile: Profile = {
      id: userId,
      role: role,
      full_name: fullName || (role === 'pharmacy' ? 'Mock Pharmacy Owner' : 'Mock Patient'),
      phone: phone,
      avatar_url: null,
      created_at: new Date().toISOString(),
    };

    set({
      session: mockSession,
      user: mockUser,
      profile: mockProfile,
      loading: false,
    });
  },

  signOut: async () => {
    set({ loading: true });
    set({ session: null, user: null, profile: null, loading: false });
  },

  initialize: async () => {
    if (get().initialized) return;
    set({ initialized: true, loading: false });
  },
}));
