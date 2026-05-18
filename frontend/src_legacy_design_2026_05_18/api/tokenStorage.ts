export interface AuthTokens {
  accessToken: string | null
}

export interface StoredAuthTokens {
  accessToken: string
}

export const AUTH_TOKENS_UPDATED_EVENT = 'mini-crm:auth-tokens-updated'
export const AUTH_LOGOUT_EVENT = 'mini-crm:auth-logout'

let inMemoryAccessToken: string | null = null

export const getStoredTokens = (): AuthTokens => {
  return {
    accessToken: inMemoryAccessToken,
  }
}

export const setStoredTokens = (tokens: StoredAuthTokens) => {
  inMemoryAccessToken = tokens.accessToken
}

export const clearStoredTokens = () => {
  inMemoryAccessToken = null
}

export const emitTokensUpdated = (tokens: StoredAuthTokens) => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(AUTH_TOKENS_UPDATED_EVENT, { detail: tokens }))
}

export const emitAuthLogout = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT))
}
