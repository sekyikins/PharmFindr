import { supabase } from './supabase';

export type AuditAction =
  | 'READ_PRESCRIPTION'
  | 'SCAN_PRESCRIPTION'
  | 'CREATE_RESERVATION'
  | 'CANCEL_RESERVATION'
  | 'EXPORT_HEALTH_DATA'
  | 'DEVICE_SESSION_REVOKED'
  | 'PASSWORD_UPDATED';

export interface AuditLogPayload {
  userId?: string | null;
  action: AuditAction;
  resourceType: 'prescription' | 'reservation' | 'user_profile' | 'device_session';
  resourceId?: string;
  metadata?: Record<string, any>;
}

/**
 * Log a sensitive PHI or security action to the immutable audit_logs database table.
 */
export async function logAuditEvent(payload: AuditLogPayload): Promise<void> {
  try {
    let userId = payload.userId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id ?? null;
    }

    if (!userId) return; // Skip anonymous actions

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: payload.action,
      resource_type: payload.resourceType,
      resource_id: payload.resourceId ?? null,
      metadata: payload.metadata ?? {},
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // Non-blocking audit logger catch
    console.warn('Audit logger warning:', e);
  }
}
