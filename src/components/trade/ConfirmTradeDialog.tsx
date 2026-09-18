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
import { useTranslation } from '@/hooks/useTranslation'

export interface ConfirmLine {
  label: string
  value: string
  /** Set on the line that answers "what does this cost me". */
  emphasis?: boolean
}

interface ConfirmTradeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  lines: ConfirmLine[]
  /** Shown above the buttons when the trade carries a risk worth restating. */
  warning?: string | null
  confirmLabel: string
  /** Destructive styling for the irreversible side of the trade. */
  destructive?: boolean
  onConfirm: () => void
}

/**
 * The last step before money moves.
 *
 * Every order in this app settles the instant it is placed — there is no
 * pending state to cancel out of — so a mis-tapped button is a filled trade
 * that costs spread and commission to undo. This restates the numbers and
 * makes the reader agree to them.
 *
 * Radix sends focus to Cancel on open, so a stray Enter or Space dismisses the
 * dialog rather than confirming it.
 */
export function ConfirmTradeDialog({
  open,
  onOpenChange,
  title,
  description,
  lines,
  warning = null,
  confirmLabel,
  destructive = false,
  onConfirm,
}: ConfirmTradeDialogProps) {
  const { t } = useTranslation()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader className="sm:group-data-[size=default]/alert-dialog-content:text-start">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <dl className="text-sm">
          {lines.map((line) => (
            <div
              key={line.label}
              className={
                line.emphasis
                  ? 'flex items-center justify-between border-t py-1 font-medium'
                  : 'flex items-center justify-between py-1'
              }
            >
              <dt className={line.emphasis ? '' : 'text-muted-foreground'}>
                {line.label}
              </dt>
              <dd className="tabular-nums">{line.value}</dd>
            </div>
          ))}
        </dl>

        {warning && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {warning}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{t('confirm.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
