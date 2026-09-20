import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useTranslation } from '@/hooks/useTranslation'
import { cn } from 'cn'
import type { Asset } from '@/types'

/**
 * How well one "TICKER Name" entry answers a query.
 *
 * cmdk sorts descending and drops anything scoring zero, so the bands only
 * have to be ordered, not meaningful: an exact ticker beats a ticker that
 * starts with the query, which beats a name that starts with it, which beats a
 * match anywhere.
 */
function score(itemValue: string, search: string): number {
  const query = search.toLowerCase().trim()
  if (query === '') return 1

  const value = itemValue.toLowerCase()
  const [ticker = '', ...rest] = value.split(' ')
  const name = rest.join(' ')

  if (ticker === query) return 1
  if (ticker.startsWith(query)) return 0.9
  // Its own band, above a mere prefix: "bitcoin" names exactly one asset, and
  // without this it ties with Bitcoin Cash and the order is arbitrary.
  if (name === query) return 0.85
  if (name.startsWith(query)) return 0.8
  // A word inside the name, so "sector" finds the sector funds.
  if (name.split(' ').some((word) => word.startsWith(query))) return 0.7
  if (value.includes(query)) return 0.6
  return 0
}

interface AssetPickerProps {
  assets: Asset[]
  value: string | null
  disabled?: boolean
  onChange: (ticker: string) => void
}

/**
 * Choosing among several dozen assets.
 *
 * A plain dropdown was fine for eight and is not for seventy: the list is
 * longer than the screen and there is nothing to type into. This filters on
 * ticker and on name, so "apple" finds AAPL and "gold" finds GLD, and groups
 * shares and funds apart from crypto.
 */
export function AssetPicker({
  assets,
  value,
  disabled = false,
  onChange,
}: AssetPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const selected = assets.find((asset) => asset.ticker === value) ?? null
  const groups = [
    { type: 'STOCK' as const, label: t('markets.groupStocks') },
    { type: 'CRYPTO' as const, label: t('markets.groupCrypto') },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t('common.asset')}
          disabled={disabled}
          className="w-full justify-between font-normal sm:w-72"
        >
          {/* The chosen asset is Latin; the placeholder is not. Only the
              former gets an explicit direction, or the Hebrew prompt would be
              laid out backwards. */}
          {selected ? (
            <span dir="ltr" className="truncate rtl:text-end">
              {`${selected.ticker} — ${selected.name}`}
            </span>
          ) : (
            <span className="truncate">{t('markets.selectAsset')}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="start">
        <Command
          // Ticker and name both, so either way of thinking about an asset
          // finds it — but ranked, not merely matched. Typing "bitcoin" with a
          // flat substring filter puts Bitcoin Cash first, which is the wrong
          // answer to an unambiguous question.
          filter={(itemValue, search) => score(itemValue, search)}
        >
          <CommandInput placeholder={t('markets.searchAssets')} />
          <CommandList>
            <CommandEmpty>{t('markets.noAssets')}</CommandEmpty>
            {groups.map((group) => {
              const rows = assets.filter((asset) => asset.type === group.type)
              if (rows.length === 0) return null
              return (
                <CommandGroup key={group.type} heading={group.label}>
                  {rows.map((asset) => (
                    <CommandItem
                      key={asset.id}
                      value={`${asset.ticker} ${asset.name}`}
                      onSelect={() => {
                        onChange(asset.ticker)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          'size-4',
                          asset.ticker === value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="font-medium">{asset.ticker}</span>
                      {/* Latin text in an RTL list: without a direction the
                          trailing full stop is moved to the visual start. */}
                      <span dir="ltr" className="text-muted-foreground truncate">
                        {asset.name}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
