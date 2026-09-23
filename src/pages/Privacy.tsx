import { useTranslation } from '@/hooks/useTranslation'
import { env } from '@/lib/env'

/**
 * What this app stores about you, in the words of what it actually does.
 *
 * Google Play requires a privacy policy from any app that holds a user
 * account, and this one does. It is a page inside the app rather than a
 * document on a third-party host so the URL in the store listing is one we
 * control and one that cannot quietly go away.
 *
 * Written from an audit of the code rather than from a template: every row in
 * the table below corresponds to a column that exists. A generic policy that
 * claims to collect analytics this app does not collect would be both untrue
 * and a worse answer on the Data Safety form.
 */
export function Privacy() {
  const { t } = useTranslation()

  const collected = [
    ['privacy.dataEmail', 'privacy.dataEmailWhy'],
    ['privacy.dataName', 'privacy.dataNameWhy'],
    ['privacy.dataExperience', 'privacy.dataExperienceWhy'],
    ['privacy.dataTrades', 'privacy.dataTradesWhy'],
    ['privacy.dataPrefs', 'privacy.dataPrefsWhy'],
    ['privacy.dataGame', 'privacy.dataGameWhy'],
  ] as const

  return (
    <article className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('privacy.title')}
        </h1>
        <p className="text-muted-foreground text-sm">{t('privacy.updated')}</p>
      </header>

      <p className="leading-relaxed">{t('privacy.intro')}</p>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('privacy.collectTitle')}</h2>
        <dl className="flex flex-col gap-3">
          {collected.map(([what, why]) => (
            <div key={what} className="flex flex-col gap-0.5">
              <dt className="text-sm font-medium">{t(what)}</dt>
              <dd className="text-muted-foreground text-sm leading-relaxed">
                {t(why)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* The more useful half of a privacy policy is usually this one. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('privacy.notCollectTitle')}</h2>
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 text-sm leading-relaxed ps-5">
          <li>{t('privacy.noTracking')}</li>
          <li>{t('privacy.noAds')}</li>
          <li>{t('privacy.noLocation')}</li>
          <li>{t('privacy.noContacts')}</li>
          <li>{t('privacy.noPayments')}</li>
          <li>{t('privacy.noSelling')}</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t('privacy.whereTitle')}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t('privacy.whereBody')}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t('privacy.deleteTitle')}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t('privacy.deleteBody')}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t('privacy.contactTitle')}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {/* Deliberately a build-time variable, not a literal. Publishing a
              personal address on a public page is the owner's decision, and
              Play wants the same address in the listing — so it is set once,
              in the environment, rather than committed here. Until it is, the
              fallback sends readers to the developer contact Play requires on
              every listing, which is a real address even when this one is not
              set; it never names the variable, because the person reading is
              a user, not whoever deploys. */}
          {env.contactEmail
            ? t('privacy.contactBody', { email: env.contactEmail })
            : t('privacy.contactUnset')}
        </p>
      </section>
    </article>
  )
}
