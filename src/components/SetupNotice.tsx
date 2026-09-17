import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Shown instead of the auth-gated UI when VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY are missing, so a fresh clone explains itself.
 */
export function SetupNotice() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Supabase to continue</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <Alert>
          <AlertTitle>Environment not configured</AlertTitle>
          <AlertDescription>
            Accounts, portfolios and trades all live in Supabase, so sign-in is
            unavailable until the project is connected.
          </AlertDescription>
        </Alert>
        <ol className="text-muted-foreground list-decimal space-y-2 pl-5">
          <li>
            Create a free project at{' '}
            <a
              className="text-foreground underline underline-offset-4"
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              supabase.com/dashboard
            </a>
            .
          </li>
          <li>
            Run <code className="text-foreground">supabase/migrations/0001_init.sql</code>{' '}
            in the project&rsquo;s SQL editor.
          </li>
          <li>
            Copy <code className="text-foreground">.env.example</code> to{' '}
            <code className="text-foreground">.env</code> and paste in the
            project URL and anon key.
          </li>
          <li>
            Restart <code className="text-foreground">npm run dev</code>.
          </li>
        </ol>
        <p className="text-muted-foreground">
          Full walkthrough in <code className="text-foreground">SETUP.md</code>.
        </p>
      </CardContent>
    </Card>
  )
}
