import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface PlaceholderPageProps {
  title: string
  phase: string
  description: string
}

export function PlaceholderPage({
  title,
  phase,
  description,
}: PlaceholderPageProps) {
  return (
    <Card>
      <CardHeader>
        <Badge variant="outline" className="w-fit">
          {phase}
        </Badge>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>Not built yet.</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        {description}
      </CardContent>
    </Card>
  )
}
