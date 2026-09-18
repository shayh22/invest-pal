import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
import type { TranslationKey } from '@/i18n'
import { formatUsd } from '@/lib/format'
import {
  fetchCommissionProfiles,
  setCommissionProfile,
} from '@/services/trading'
import { requireSupabase, supabase } from '@/services/supabase'
import type { CommissionProfile } from '@/types'

/**
 * What trading costs, as a choice rather than a house rule.
 *
 * The profiles are shaped after pricing that is common in the market; none of
 * them is any particular firm's published rates, and the copy says so. The
 * point is that the shape of a fee changes which trades make sense — a $15
 * minimum makes a $100 trade absurd, and a per-share charge is indifferent to
 * price — and that is only visible if you can switch between them.
 */
export function CommissionPicker() {
  const { portfolio, refreshAccount } = useAuth()
  const { t } = useTranslation()
  const [profiles, setProfiles] = useState<CommissionProfile[]>([])
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let active = true
    fetchCommissionProfiles(supabase)
      .then((rows) => {
        if (active) setProfiles(rows)
      })
      .catch(() => {
        // The picker simply does not appear; the account keeps its rates.
        if (active) setProfiles([])
      })
    return () => {
      active = false
    }
  }, [])

  if (!portfolio || profiles.length === 0) return null

  const current =
    profiles.find((p) => p.key === portfolio.commissionProfile) ?? profiles[0]

  async function choose(key: string) {
    setPending(true)
    try {
      await setCommissionProfile(requireSupabase(), key)
      await refreshAccount()
      toast.success(
        t('rates.changedToast', {
          name: t(`rates.${key}.name` as TranslationKey),
        }),
      )
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : t('rates.error'),
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('rates.title')}</CardTitle>
        <CardDescription>{t('rates.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="commission-profile">{t('rates.label')}</Label>
          <Select
            value={current.key}
            disabled={pending}
            onValueChange={(value) => void choose(value)}
          >
            <SelectTrigger id="commission-profile" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((profile) => (
                <SelectItem key={profile.key} value={profile.key}>
                  {t(`rates.${profile.key}.name` as TranslationKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-muted-foreground text-sm leading-relaxed">
          {t(`rates.${current.key}.body` as TranslationKey)}
        </p>

        {/* The numbers themselves, so the description is checkable. */}
        <dl className="text-sm">
          <Row
            label={t('rates.spread')}
            value={t('rates.spreadValue', {
              stock: formatBps(current.stockSpreadBps),
              crypto: formatBps(current.cryptoSpreadBps),
            })}
          />
          <Row
            label={t('trade.commission')}
            value={
              current.commissionPerUnit > 0
                ? t('rates.perUnitValue', {
                    amount: current.commissionPerUnit.toFixed(3),
                  })
                : current.commissionBps > 0
                  ? formatBps(current.commissionBps)
                  : t('rates.none')
            }
          />
          <Row
            label={t('rates.minimum')}
            value={
              current.minCommission > 0
                ? formatUsd(current.minCommission)
                : t('rates.none')
            }
          />
        </dl>

        <p className="text-muted-foreground text-xs leading-relaxed">
          {t('rates.disclaimer')}
        </p>
      </CardContent>
    </Card>
  )
}

/** Basis points read as a percentage; 100 bps is 1%. */
function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
