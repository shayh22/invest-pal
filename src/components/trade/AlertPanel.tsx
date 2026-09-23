import { useState } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from '@/hooks/useTranslation'
import { createAlert, deleteAlert } from '@/services/alerts'
import { requireSupabase } from '@/services/supabase'
import type { AlertDirection, Asset, PriceAlert } from '@/types'
import { formatDateTime } from '@/lib/format'
import { GlossaryText } from '@/components/glossary/GlossaryText'

interface AlertPanelProps {
  asset: Asset | null
  price: number | null
  decimals: number
  /** Alerts already set on this asset. */
  alerts: PriceAlert[]
  onChanged: () => void
}

/**
 * Set a level to be told about, on the chart you are already looking at.
 *
 * Deliberately next to the trade panel rather than buried in settings: the
 * moment you want an alert is the moment you are looking at a price and not
 * ready to act on it.
 */
export function AlertPanel({
  asset,
  price,
  decimals,
  alerts,
  onChanged,
}: AlertPanelProps) {
  const { t, locale } = useTranslation()
  const [direction, setDirection] = useState<AlertDirection>('ABOVE')
  const [levelText, setLevelText] = useState('')
  const [pending, setPending] = useState(false)

  const level = Number(levelText)
  const levelValid = Number.isFinite(level) && level > 0

  async function add() {
    if (!asset || !levelValid) return
    setPending(true)
    try {
      await createAlert(requireSupabase(), {
        assetId: asset.id,
        direction,
        price: level,
      })
      setLevelText('')
      toast.success(t('alerts.setToast', { ticker: asset.ticker }))
      onChanged()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t('alerts.error'))
    } finally {
      setPending(false)
    }
  }

  async function remove(id: string) {
    try {
      await deleteAlert(requireSupabase(), id)
      onChanged()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t('alerts.error'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="size-4" aria-hidden />
          {t('alerts.title')}
        </CardTitle>
        <CardDescription><GlossaryText>{t('alerts.subtitle')}</GlossaryText></CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="alert-direction">{t('alerts.directionLabel')}</Label>
          <Select
            value={direction}
            onValueChange={(value) => setDirection(value as AlertDirection)}
          >
            <SelectTrigger id="alert-direction" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ABOVE">{t('alerts.above')}</SelectItem>
              <SelectItem value="BELOW">{t('alerts.below')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="alert-level">{t('alerts.levelLabel')}</Label>
          <Input
            id="alert-level"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder={price ? price.toFixed(decimals) : ''}
            value={levelText}
            onChange={(event) => setLevelText(event.target.value)}
            disabled={!asset}
          />
        </div>

        <Button
          className="w-full"
          disabled={!asset || !levelValid || pending}
          onClick={() => void add()}
        >
          <BellRing className="size-4" />
          {t('alerts.add')}
        </Button>

        {alerts.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">
              {t('alerts.onThisAsset')}
            </p>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm"
              >
                <Badge variant="outline">
                  {t(alert.direction === 'ABOVE' ? 'alerts.above' : 'alerts.below')}
                </Badge>
                <span className="tabular-nums">
                  {alert.price.toFixed(decimals)}
                </span>
                {alert.triggeredAt && (
                  <span className="text-muted-foreground text-xs">
                    {t('alerts.firedAt', {
                      when: formatDateTime(alert.triggeredAt, locale),
                    })}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ms-auto"
                  onClick={() => void remove(alert.id)}
                >
                  {t('alerts.remove')}
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="text-muted-foreground text-xs leading-relaxed">
          <GlossaryText>{t('alerts.note')}</GlossaryText>
        </p>
      </CardContent>
    </Card>
  )
}
