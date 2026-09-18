import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from '@/hooks/useTranslation'
import { STARTING_BALANCES, type StartingBalance } from '@/types'

const balanceLabel = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)

interface ResetAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What the account is funded with now, offered as the default. */
  currentBalance: StartingBalance
  pending?: boolean
  onConfirm: (startingBalance: StartingBalance) => void
}

/**
 * Starting the practice account over.
 *
 * Irreversible and not small: every trade goes, open and closed alike. It also
 * takes a decision — the balance to restart on — which is the reason this is a
 * dialog of its own rather than the plain confirmation used for orders.
 */
export function ResetAccountDialog({
  open,
  onOpenChange,
  currentBalance,
  pending = false,
  onConfirm,
}: ResetAccountDialogProps) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<StartingBalance>(currentBalance)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Reopening should offer today's balance, not the one left behind by a
        // dialog that was dismissed.
        if (next) setChoice(currentBalance)
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader className="sm:group-data-[size=default]/alert-dialog-content:text-start">
          <AlertDialogTitle>{t('reset.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('reset.body')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-balance">{t('reset.balanceLabel')}</Label>
          <Select
            value={String(choice)}
            onValueChange={(value) => setChoice(Number(value) as StartingBalance)}
          >
            <SelectTrigger id="reset-balance" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STARTING_BALANCES.map((amount) => (
                <SelectItem key={amount} value={String(amount)}>
                  {balanceLabel(amount)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t('reset.balanceHint')}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('confirm.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() => onConfirm(choice)}
          >
            {t('reset.action', { amount: balanceLabel(choice) })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
