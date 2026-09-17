import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">
        That route doesn&rsquo;t exist yet.
      </p>
      <Button asChild>
        <Link to="/">Back to overview</Link>
      </Button>
    </div>
  )
}
