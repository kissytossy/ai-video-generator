declare namespace NodeJS {
  interface ProcessEnv {
    ANTHROPIC_API_KEY: string
    NEXT_PUBLIC_SUPABASE_URL?: string
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
    STRIPE_SECRET_KEY?: string
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string
  }
}
