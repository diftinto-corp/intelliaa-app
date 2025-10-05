import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export interface AuthResult {
  success: true;
  user: User;
  supabase: Awaited<ReturnType<typeof createClient>>;
  accountRole?: string;
}

export interface AuthError {
  success: false;
  error: string;
  status: 401 | 403;
}

/**
 * Authenticate user and validate account membership
 *
 * @param accountId - Account UUID to validate membership
 * @returns AuthResult on success, AuthError on failure
 */
export async function authenticateRequest(
  accountId: string
): Promise<AuthResult | AuthError> {
  try {
    // Create Supabase client (Next.js 15 async cookies)
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: 'No autenticado. Por favor, inicia sesión.',
        status: 401
      };
    }

    // Validate account membership
    const { data: membership, error: membershipError } = await supabase
      .from('basejump.account_user')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      console.error('[AUTH] Membership validation failed', {
        userId: user.id,
        accountId,
        error: membershipError
      });

      return {
        success: false,
        error: 'No tienes acceso a esta cuenta.',
        status: 403
      };
    }

    console.log('[AUTH] User authenticated successfully', {
      userId: user.id,
      accountId,
      role: membership.account_role
    });

    return {
      success: true,
      user,
      supabase,
      accountRole: membership.account_role
    };

  } catch (error) {
    console.error('[AUTH] Unexpected authentication error', error);

    return {
      success: false,
      error: 'Error de autenticación. Por favor, intenta nuevamente.',
      status: 401
    };
  }
}

/**
 * Extract account_id from FormData (for multipart/form-data requests)
 */
export function extractAccountIdFromFormData(formData: FormData): string | null {
  const accountId = formData.get('account_id');
  if (typeof accountId === 'string') {
    return accountId;
  }
  return null;
}

/**
 * Extract account_id from URL query params (for DELETE requests)
 */
export function extractAccountIdFromQuery(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get('account_id');
}

/**
 * Extract account_id from JSON body (for POST requests)
 */
export async function extractAccountIdFromJSON(request: Request): Promise<string | null> {
  try {
    const body = await request.json();
    if (typeof body.account_id === 'string') {
      return body.account_id;
    }
    return null;
  } catch (error) {
    return null;
  }
}
