import { ElectronRepository } from './ElectronRepository';
import { SupabaseRepository } from './SupabaseRepository';

const isElectron = typeof window !== 'undefined' && Boolean(window.api);

export const api = isElectron ? new ElectronRepository() : new SupabaseRepository();
