import { supabase } from '../supabase'

export interface CreateUserParams {
  full_name: string | null
  email: string
  password: string
  role: string
  departments: string[]
  hall: string | null
  buyers: string[] | null
  department_admin_for?: string[]
}

export async function createUser(params: CreateUserParams): Promise<{ id: string; email: string }> {
  const { data, error } = await supabase.functions.invoke('create-user', { body: params })

  if (error) {
    let message = error.message
    if ('context' in error && error.context instanceof Response) {
      try {
        const body = await error.context.json()
        if (body?.error) message = body.error
      } catch {
        // fall back to the generic error message below
      }
    }
    throw new Error(message)
  }

  if (!data?.success) {
    throw new Error(data?.error ?? 'Could not create the account.')
  }

  return data.user
}
