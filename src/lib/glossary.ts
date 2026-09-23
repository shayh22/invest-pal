/**
 * The beginner's glossary: every term the app uses, in both languages.
 *
 * Each entry says what the word means in one sentence, then a little more in
 * plain language. `aliases` are the forms the word takes on screen — plurals,
 * the label a panel uses, the Hebrew with and without its article — and are
 * what GlossaryText looks for to turn a word into a link. Hebrew prefixes
 * (ב, ה, ו, ל, מ, ש, כ) are handled there, not listed here.
 */

import type { Language } from '@/i18n'

export interface GlossaryText {
  term: string
  aliases: string[]
  short: string
  body: string
}

export interface GlossaryEntry {
  id: string
  en: GlossaryText
  he: GlossaryText
  related?: string[]
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'paper-trading',
    related: ['portfolio', 'cash'],
    en: {
      term: 'Paper trading',
      aliases: ['paper trading', 'virtual money', 'practice trade'],
      short: 'Trading with pretend money against real prices.',
      body: 'Every price here is real, but the money is not. You can make every beginner mistake and learn from it without losing a cent.',
    },
    he: {
      term: 'מסחר וירטואלי',
      aliases: ['מסחר וירטואלי', 'כסף וירטואלי', 'עסקת תרגול', 'כסף דמיוני'],
      short: 'מסחר בכסף דמיוני מול מחירים אמיתיים.',
      body: 'כל מחיר כאן אמיתי, אבל הכסף לא. אפשר לעשות כל טעות של מתחילים וללמוד ממנה בלי להפסיד שקל.',
    },
  },
  {
    id: 'stock',
    related: ['etf', 'ticker'],
    en: {
      term: 'Stock (share)',
      aliases: ['stock', 'stocks', 'share', 'shares'],
      short: 'A small piece of ownership in a company.',
      body: 'If the company does well and more people want its shares, the price tends to rise; if not, it falls. One share of Apple is one tiny slice of Apple.',
    },
    he: {
      term: 'מניה',
      aliases: ['מניה', 'מניות'],
      short: 'חלק קטן בבעלות על חברה.',
      body: 'כשלחברה הולך טוב ויותר אנשים רוצים את המניות שלה, המחיר נוטה לעלות; כשלא, הוא יורד. מניה אחת של אפל היא פרוסה זעירה של אפל.',
    },
  },
  {
    id: 'etf',
    related: ['stock'],
    en: {
      term: 'ETF (fund)',
      aliases: ['ETF', 'ETFs', 'fund', 'funds'],
      short: 'A basket of many investments that trades like a single share.',
      body: 'SPY, for example, holds the 500 largest US companies at once. Buying one unit spreads your money across all of them, so one company having a bad day matters less.',
    },
    he: {
      term: 'קרן סל',
      // Not plain "קרן": it also means a ray, and the Gann texts talk about rays.
      aliases: ['קרן סל', 'קרנות סל'],
      short: 'סל של הרבה השקעות שנסחר כמו מניה אחת.',
      body: 'SPY, למשל, מחזיקה בבת אחת את 500 החברות הגדולות בארה״ב. קנייה של יחידה אחת מפזרת את הכסף על כולן, כך שיום רע של חברה אחת משפיע פחות.',
    },
  },
  {
    id: 'crypto',
    related: ['ticker'],
    en: {
      term: 'Cryptocurrency',
      aliases: ['crypto', 'cryptocurrency', 'cryptocurrencies', 'coin', 'coins'],
      short: 'A digital currency that trades around the clock.',
      body: 'Bitcoin and Ethereum are the best known. Crypto prices move much more than most shares, in both directions, and the market never closes.',
    },
    he: {
      term: 'מטבע קריפטו',
      aliases: ['מטבע קריפטו', 'מטבעות קריפטו', 'קריפטו', 'מטבע דיגיטלי'],
      short: 'מטבע דיגיטלי שנסחר מסביב לשעון.',
      body: 'ביטקוין ואתריום הם המוכרים ביותר. מחירי קריפטו זזים הרבה יותר מרוב המניות, לשני הכיוונים, והשוק אף פעם לא נסגר.',
    },
  },
  {
    id: 'ticker',
    en: {
      term: 'Ticker',
      aliases: ['ticker', 'tickers', 'symbol'],
      short: 'The short code an asset trades under.',
      body: 'AAPL is Apple, BTC-USD is Bitcoin priced in dollars. Tickers stay the same in every language.',
    },
    he: {
      term: 'סימול',
      aliases: ['סימול', 'סימולים', 'טיקר'],
      short: 'הקוד הקצר שתחתיו נכס נסחר.',
      body: 'AAPL היא אפל, ו-BTC-USD הוא ביטקוין במחיר בדולרים. הסימול זהה בכל שפה.',
    },
  },
  {
    id: 'candle',
    related: ['close', 'day-range'],
    en: {
      term: 'Candlestick',
      aliases: ['candlestick', 'candlesticks', 'candle', 'candles', 'bar', 'bars'],
      short: 'One bar on the chart, showing a period’s open, high, low and close.',
      body: 'The thick body runs from the opening price to the closing price, and the thin wicks reach the highest and lowest prices. Green means it closed higher than it opened; red means lower.',
    },
    he: {
      term: 'נר',
      aliases: ['נר', 'נרות', 'נר יפני', 'נרות יפניים'],
      short: 'עמודה אחת בגרף, שמראה פתיחה, גבוה, נמוך וסגירה של תקופה.',
      body: 'הגוף העבה נמתח ממחיר הפתיחה למחיר הסגירה, והפתילים הדקים מגיעים למחיר הגבוה והנמוך. ירוק אומר שנסגר מעל הפתיחה; אדום – מתחתיה.',
    },
  },
  {
    id: 'close',
    related: ['candle'],
    en: {
      term: 'Close (previous close)',
      aliases: ['previous close', 'closing price', 'close', 'closes'],
      short: 'The last price of a trading session.',
      body: 'The previous close is yesterday’s last price. Today’s change is measured from it.',
    },
    he: {
      term: 'סגירה',
      aliases: ['סגירה קודמת', 'מחיר סגירה', 'סגירה'],
      short: 'המחיר האחרון של יום מסחר.',
      body: 'הסגירה הקודמת היא המחיר האחרון של אתמול. השינוי של היום נמדד ממנה.',
    },
  },
  {
    id: 'day-range',
    related: ['week-range'],
    en: {
      term: 'Day range',
      aliases: ['day range'],
      short: 'The lowest and highest prices today.',
      body: 'A wide day range means a busy, nervous day; a narrow one means a quiet day.',
    },
    he: {
      term: 'טווח יומי',
      aliases: ['טווח יומי'],
      short: 'המחיר הנמוך והגבוה ביותר היום.',
      body: 'טווח יומי רחב מעיד על יום עמוס ועצבני; טווח צר – על יום שקט.',
    },
  },
  {
    id: 'week-range',
    related: ['day-range'],
    en: {
      term: '52-week range',
      aliases: ['52-week range'],
      short: 'The lowest and highest prices over the past year.',
      body: 'It shows where today’s price sits in the year: near the top, near the bottom, or in between.',
    },
    he: {
      term: 'טווח 52 שבועות',
      aliases: ['טווח 52 שבועות'],
      short: 'המחיר הנמוך והגבוה ביותר בשנה האחרונה.',
      body: 'הוא מראה איפה המחיר של היום נמצא ביחס לשנה: קרוב לשיא, קרוב לשפל, או באמצע.',
    },
  },
  {
    id: 'portfolio',
    related: ['position', 'account-value'],
    en: {
      term: 'Portfolio',
      aliases: ['portfolio'],
      short: 'Everything you own: your cash and your positions.',
      body: 'The Portfolio page lists what you hold now, what you have closed, and orders still waiting.',
    },
    he: {
      term: 'תיק השקעות',
      aliases: ['תיק השקעות', 'תיק'],
      short: 'כל מה שבבעלותכם: המזומן והפוזיציות.',
      body: 'דף התיק מציג מה אתם מחזיקים עכשיו, מה סגרתם, ואילו פקודות עדיין ממתינות.',
    },
  },
  {
    id: 'account-value',
    related: ['cash', 'position', 'return'],
    en: {
      term: 'Account value',
      aliases: ['account value'],
      short: 'Your cash plus what your open positions are worth right now.',
      body: 'It moves with the market even when you do nothing, because your positions are valued at the latest price.',
    },
    he: {
      term: 'שווי החשבון',
      aliases: ['שווי החשבון', 'שווי חשבון'],
      short: 'המזומן שלכם ועוד השווי הנוכחי של הפוזיציות הפתוחות.',
      body: 'הוא זז עם השוק גם כשאתם לא עושים כלום, כי הפוזיציות משוערכות לפי המחיר האחרון.',
    },
  },
  {
    id: 'cash',
    related: ['account-value'],
    en: {
      term: 'Cash',
      aliases: ['cash'],
      short: 'Money in the account that is not invested.',
      body: 'Buying uses cash; selling returns it. You cannot buy more than your cash allows.',
    },
    he: {
      term: 'מזומן',
      aliases: ['מזומן'],
      short: 'כסף בחשבון שאינו מושקע.',
      body: 'קנייה משתמשת במזומן; מכירה מחזירה אותו. אי אפשר לקנות יותר ממה שהמזומן מאפשר.',
    },
  },
  {
    id: 'position',
    related: ['long', 'short', 'entry'],
    en: {
      term: 'Position',
      aliases: ['position', 'positions', 'holding', 'holdings'],
      short: 'An asset you currently hold, and how much of it.',
      body: 'A position is open from the moment you buy until you sell. While open, its profit or loss changes with every price move.',
    },
    he: {
      term: 'פוזיציה',
      aliases: ['פוזיציה', 'פוזיציות', 'החזקה', 'החזקות'],
      short: 'נכס שאתם מחזיקים כרגע, וכמה ממנו.',
      body: 'פוזיציה פתוחה מרגע הקנייה ועד המכירה. כל עוד היא פתוחה, הרווח או ההפסד שלה משתנים עם כל תזוזת מחיר.',
    },
  },
  {
    id: 'long',
    related: ['short', 'position'],
    en: {
      term: 'Long',
      aliases: ['long', 'going long'],
      short: 'Owning an asset because you think its price will rise.',
      body: 'Buy low, sell higher. The most you can lose is what you paid.',
    },
    he: {
      term: 'לונג',
      aliases: ['לונג'],
      short: 'החזקת נכס מתוך מחשבה שהמחיר שלו יעלה.',
      body: 'קונים בזול, מוכרים ביוקר. ההפסד המרבי הוא הסכום ששילמתם.',
    },
  },
  {
    id: 'short',
    related: ['long', 'position'],
    en: {
      term: 'Short selling',
      aliases: ['short selling', 'sell short', 'shorting', 'short'],
      short: 'Selling something you borrowed, hoping to buy it back cheaper.',
      body: 'You profit if the price falls. If it rises instead, the loss has no ceiling, which is why the app keeps shorting off until you switch it on.',
    },
    he: {
      term: 'שורט (מכירה בחסר)',
      aliases: ['מכירה בחסר', 'שורט'],
      short: 'מכירה של נכס מושאל, בתקווה לקנות אותו בחזרה בזול.',
      body: 'מרוויחים אם המחיר יורד. אם הוא עולה במקום, להפסד אין תקרה – ולכן האפליקציה משאירה שורט כבוי עד שמפעילים אותו.',
    },
  },
  {
    id: 'entry',
    related: ['mark', 'pnl'],
    en: {
      term: 'Entry price',
      aliases: ['entry price', 'entry'],
      short: 'The price you paid when you opened a position.',
      body: 'Your profit or loss is measured from it.',
    },
    he: {
      term: 'מחיר כניסה',
      aliases: ['מחיר כניסה', 'כניסה'],
      short: 'המחיר ששילמתם כשפתחתם פוזיציה.',
      body: 'הרווח או ההפסד שלכם נמדדים ממנו.',
    },
  },
  {
    id: 'mark',
    related: ['entry', 'unrealised'],
    en: {
      term: 'Mark price',
      aliases: ['mark price', 'mark'],
      short: 'The latest price, used to value what you hold.',
      body: 'Comparing the mark with your entry price gives your unrealised profit or loss.',
    },
    he: {
      term: 'מחיר שערוך',
      aliases: ['מחיר שערוך', 'שערוך'],
      short: 'המחיר האחרון, שלפיו מוערך מה שאתם מחזיקים.',
      body: 'ההשוואה בין השערוך למחיר הכניסה נותנת את הרווח או ההפסד הלא ממומש.',
    },
  },
  {
    id: 'pnl',
    related: ['unrealised', 'realised'],
    en: {
      term: 'Profit and loss (P&L)',
      aliases: ['profit and loss', 'P&L'],
      short: 'How much you have made or lost.',
      body: 'Shown with a sign and a colour: + and green for a gain, − and red for a loss.',
    },
    he: {
      term: 'רווח והפסד',
      aliases: ['רווח והפסד', 'רווח/הפסד'],
      short: 'כמה הרווחתם או הפסדתם.',
      body: 'מוצג עם סימן ועם צבע: + וירוק לרווח, − ואדום להפסד.',
    },
  },
  {
    id: 'unrealised',
    related: ['realised', 'mark'],
    en: {
      term: 'Unrealised P&L',
      aliases: ['unrealised', 'unrealized'],
      short: 'Profit or loss on positions that are still open.',
      body: 'It exists only on paper until you sell, and it can change back at any time.',
    },
    he: {
      term: 'רווח לא ממומש',
      aliases: ['רווח לא ממומש', 'לא ממומש'],
      short: 'רווח או הפסד על פוזיציות שעדיין פתוחות.',
      body: 'הוא קיים רק על הנייר עד שמוכרים, והוא יכול להתהפך בכל רגע.',
    },
  },
  {
    id: 'realised',
    related: ['unrealised', 'commission'],
    en: {
      term: 'Realised P&L',
      aliases: ['realised', 'realized'],
      short: 'Profit or loss that is locked in because you closed the position.',
      body: 'Here it is shown after costs, because a trade that made $10 but cost $12 lost money.',
    },
    he: {
      term: 'רווח ממומש',
      aliases: ['רווח ממומש', 'ממומש'],
      short: 'רווח או הפסד שננעל כי סגרתם את הפוזיציה.',
      body: 'כאן הוא מוצג אחרי עלויות, כי עסקה שהרוויחה 10 דולר ועלתה 12 – הפסידה.',
    },
  },
  {
    id: 'return',
    related: ['account-value'],
    en: {
      term: 'Return',
      aliases: ['total return', 'return'],
      short: 'How much the account has grown or shrunk, in percent.',
      body: 'Measured against what you started with, so +5% on $100,000 means $105,000.',
    },
    he: {
      term: 'תשואה',
      aliases: ['תשואה כוללת', 'תשואה'],
      short: 'בכמה אחוזים החשבון גדל או קטן.',
      body: 'נמדדת ביחס לסכום ההתחלתי, כך ש-5%+ על 100,000 דולר הם 105,000 דולר.',
    },
  },
  {
    id: 'spread',
    related: ['commission'],
    en: {
      term: 'Spread',
      aliases: ['spread'],
      short: 'The gap between the price you can buy at and the price you can sell at.',
      body: 'You buy a little above the middle price and sell a little below it. It is a hidden cost on every trade.',
    },
    he: {
      term: 'מרווח (ספרד)',
      aliases: ['מרווח', 'ספרד'],
      short: 'הפער בין המחיר שבו אפשר לקנות למחיר שבו אפשר למכור.',
      body: 'קונים קצת מעל מחיר האמצע ומוכרים קצת מתחתיו. זו עלות נסתרת בכל עסקה.',
    },
  },
  {
    id: 'commission',
    related: ['spread'],
    en: {
      term: 'Commission',
      aliases: ['commission', 'commissions', 'fee', 'fees', 'costs paid', 'trading costs'],
      short: 'The fee a broker charges for each trade.',
      body: 'Small per trade, but it adds up if you trade often. Costs paid on the Portfolio page adds up spread and commission.',
    },
    he: {
      term: 'עמלה',
      aliases: ['עמלה', 'עמלות', 'עלויות ששולמו', 'עלויות מסחר'],
      short: 'התשלום שהברוקר גובה על כל עסקה.',
      body: 'קטנה בכל עסקה, אבל מצטברת אם סוחרים הרבה. "עלויות ששולמו" בדף התיק מחברות מרווח ועמלה.',
    },
  },
  {
    id: 'market-order',
    related: ['limit-order', 'stop-order'],
    en: {
      term: 'Market order',
      aliases: ['market order', 'market orders'],
      short: 'Buy or sell right now, at the current price.',
      body: 'The simplest order: it fills immediately, but you take whatever the price is at that moment.',
    },
    he: {
      term: 'פקודת שוק',
      aliases: ['פקודת שוק', 'פקודות שוק'],
      short: 'קנייה או מכירה עכשיו, במחיר הנוכחי.',
      body: 'הפקודה הפשוטה ביותר: היא מתבצעת מיד, אבל מקבלים את המחיר שיש באותו רגע.',
    },
  },
  {
    id: 'limit-order',
    related: ['market-order', 'stop-order'],
    en: {
      term: 'Limit order',
      aliases: ['limit order', 'limit orders'],
      short: 'Wait for a better price before trading.',
      body: 'A buy limit fills only if the price drops to your number; a sell limit only if it rises to it. It may never fill.',
    },
    he: {
      term: 'פקודת לימיט',
      aliases: ['פקודת לימיט', 'פקודות לימיט', 'לימיט'],
      short: 'המתנה למחיר טוב יותר לפני הביצוע.',
      body: 'לימיט קנייה מתבצע רק אם המחיר יורד למספר שקבעתם; לימיט מכירה – רק אם הוא עולה אליו. ייתכן שלא יתבצע לעולם.',
    },
  },
  {
    id: 'stop-order',
    related: ['trailing-stop', 'limit-order'],
    en: {
      term: 'Stop order (stop loss)',
      aliases: ['stop order', 'stop orders', 'stop loss', 'stop-loss', 'stop'],
      short: 'Trade automatically if the price moves against you.',
      body: 'A stop loss sells when the price falls to a level you chose, so a bad trade cannot keep getting worse while you are away.',
    },
    he: {
      term: 'פקודת סטופ (סטופ לוס)',
      aliases: ['פקודת סטופ', 'סטופ לוס', 'סטופ'],
      short: 'ביצוע אוטומטי אם המחיר זז נגדכם.',
      body: 'סטופ לוס מוכר כשהמחיר יורד לרמה שבחרתם, כך שעסקה גרועה לא ממשיכה להידרדר כשאתם לא מסתכלים.',
    },
  },
  {
    id: 'trailing-stop',
    related: ['stop-order'],
    en: {
      term: 'Trailing stop',
      aliases: ['trailing stop', 'trailing stops'],
      short: 'A stop that follows the price as it moves your way.',
      body: 'Set it, say, 5% below the price. If the price rises, the stop rises with it; if the price falls 5% from its best, you sell. It locks in part of a gain.',
    },
    he: {
      term: 'סטופ נגרר',
      aliases: ['סטופ נגרר'],
      short: 'סטופ שעוקב אחרי המחיר כשהוא זז לטובתכם.',
      body: 'קובעים אותו, למשל, 5% מתחת למחיר. אם המחיר עולה, הסטופ עולה איתו; אם המחיר יורד 5% מהשיא שלו – מוכרים. כך ננעל חלק מהרווח.',
    },
  },
  {
    id: 'alert',
    related: ['watchlist'],
    en: {
      term: 'Price alert',
      aliases: ['price alert', 'price alerts', 'alert', 'alerts'],
      short: 'A note to yourself that fires when a price reaches a level.',
      body: 'It trades nothing. It just tells you, so you do not have to keep checking.',
    },
    he: {
      term: 'התראת מחיר',
      aliases: ['התראת מחיר', 'התראות מחיר', 'התראה', 'התראות'],
      short: 'תזכורת לעצמכם שמופעלת כשהמחיר מגיע לרמה.',
      body: 'היא לא סוחרת בכלום. היא רק מודיעה, כדי שלא תצטרכו לבדוק כל הזמן.',
    },
  },
  {
    id: 'watchlist',
    related: ['alert'],
    en: {
      term: 'Watchlist',
      aliases: ['watchlist'],
      short: 'The assets you follow, shown on the dashboard.',
      body: 'Tap the star on any chart to add it. Following costs nothing and buys nothing.',
    },
    he: {
      term: 'רשימת מעקב',
      aliases: ['רשימת מעקב', 'רשימת המעקב'],
      short: 'הנכסים שאתם עוקבים אחריהם, שמוצגים בלוח הבקרה.',
      body: 'לחצו על הכוכב בכל גרף כדי להוסיף. מעקב לא עולה כלום ולא קונה כלום.',
    },
  },
  {
    id: 'support',
    related: ['resistance', 'square-of-nine'],
    en: {
      term: 'Support',
      aliases: ['support', 'supports'],
      short: 'A price below the market where falls have tended to stop.',
      body: 'Think of a floor that buyers have defended before. Floors break, though; support is a tendency, not a promise.',
    },
    he: {
      term: 'תמיכה',
      aliases: ['תמיכה', 'תמיכות'],
      short: 'מחיר מתחת לשוק שבו ירידות נטו להיעצר.',
      body: 'תחשבו על רצפה שקונים כבר הגנו עליה בעבר. אבל רצפות נשברות; תמיכה היא נטייה, לא הבטחה.',
    },
  },
  {
    id: 'resistance',
    related: ['support', 'square-of-nine'],
    en: {
      term: 'Resistance',
      aliases: ['resistance', 'resistances'],
      short: 'A price above the market where rises have tended to stall.',
      body: 'A ceiling where sellers have appeared before. When price breaks through, the old ceiling often becomes the new floor.',
    },
    he: {
      term: 'התנגדות',
      aliases: ['התנגדות', 'התנגדויות'],
      short: 'מחיר מעל השוק שבו עליות נטו להיתקע.',
      body: 'תקרה שבה מוכרים הופיעו בעבר. כשהמחיר פורץ אותה, התקרה הישנה הופכת לא פעם לרצפה החדשה.',
    },
  },
  {
    id: 'gann',
    related: ['balance-line', 'gann-fan', 'square-of-nine'],
    en: {
      term: 'W.D. Gann',
      aliases: ['Gann'],
      short: 'A trader of the early 1900s who analysed markets with geometry and time.',
      body: 'His tools — angles, the Square of Nine, time cycles — are what this app draws on the chart. They describe the past; they do not predict the future.',
    },
    he: {
      term: 'ו.ד. גאן',
      aliases: ['גאן'],
      short: 'סוחר מתחילת המאה ה-20 שניתח שווקים בעזרת גאומטריה וזמן.',
      body: 'הכלים שלו – זוויות, ריבוע התשע, מחזורי זמן – הם מה שהאפליקציה משרטטת על הגרף. הם מתארים את העבר; הם לא חוזים את העתיד.',
    },
  },
  {
    id: 'balance-line',
    related: ['gann-fan', 'pivot'],
    en: {
      term: '1x1 balance line',
      aliases: ['1x1 balance line', 'balance line', '1x1'],
      short: 'Gann’s main angle: one unit of price for each unit of time.',
      body: 'It is drawn from a major turning point. Gann read price above it as strength and below it as weakness.',
    },
    he: {
      term: 'קו האיזון 1x1',
      aliases: ['קו האיזון', 'קו איזון', '1x1'],
      short: 'הזווית המרכזית של גאן: יחידת מחיר אחת לכל יחידת זמן.',
      body: 'הוא משורטט מנקודת מפנה משמעותית. גאן ראה במחיר שמעליו סימן לחוזק, ובמחיר שמתחתיו סימן לחולשה.',
    },
  },
  {
    id: 'gann-fan',
    related: ['balance-line', 'pivot'],
    en: {
      term: 'Gann fan',
      aliases: ['Gann fan', 'Gann angles', 'fan', 'angles'],
      short: 'A set of lines at different angles from one turning point.',
      body: 'Around the 1x1 sit steeper lines (2x1, 3x1…) and flatter ones (1x2, 1x3…). Price moving from one to the next shows the trend speeding up or slowing down.',
    },
    he: {
      term: 'מניפת גאן',
      aliases: ['מניפת גאן', 'זוויות גאן', 'מניפה', 'זוויות'],
      short: 'אוסף קווים בזוויות שונות מנקודת מפנה אחת.',
      body: 'סביב ה-1x1 יש קווים תלולים יותר (2x1, 3x1…) ושטוחים יותר (1x2, 1x3…). מעבר של המחיר מקו לקו מראה שהמגמה מאיצה או מאטה.',
    },
  },
  {
    id: 'square-of-nine',
    related: ['support', 'resistance'],
    en: {
      term: 'Square of Nine',
      aliases: ['Square of Nine', 'Sq9'],
      short: 'Gann’s spiral of numbers, used to find support and resistance levels.',
      body: 'Every full turn around the spiral adds 2 to the square root of the price. The levels here are turns of 45°, 90° and so on from the latest close.',
    },
    he: {
      term: 'ריבוע התשע',
      aliases: ['ריבוע התשע', 'ריבוע תשע'],
      short: 'הספירלה המספרית של גאן, שמשמשת למציאת רמות תמיכה והתנגדות.',
      body: 'כל סיבוב מלא בספירלה מוסיף 2 לשורש הריבועי של המחיר. הרמות כאן הן סיבובים של 45°, 90° וכן הלאה מהסגירה האחרונה.',
    },
  },
  {
    id: 'cycle',
    related: ['pivot'],
    en: {
      term: 'Time cycle',
      aliases: ['time cycles', 'time cycle', 'cycles', 'cycle'],
      short: 'A number of bars that has repeated between past turning points.',
      body: 'If lows have come every 18 bars several times, the next one is marked on the calendar. It is a pattern worth watching, not a forecast.',
    },
    he: {
      term: 'מחזור זמן',
      aliases: ['מחזורי זמן', 'מחזור זמן', 'מחזורים', 'מחזור'],
      short: 'מספר נרות שחזר על עצמו בין נקודות מפנה בעבר.',
      body: 'אם שפלים הגיעו כל 18 נרות כמה פעמים, המועד הבא מסומן בלוח השנה. זו תבנית שכדאי לשים לב אליה, לא תחזית.',
    },
  },
  {
    id: 'pivot',
    related: ['balance-line', 'cycle'],
    en: {
      term: 'Swing pivot',
      aliases: ['swing pivot', 'swing high', 'swing low', 'pivot', 'pivots'],
      short: 'A clear turning point: a high or low the price turned back from.',
      body: 'Gann’s angles and cycles are all measured from these turns.',
    },
    he: {
      term: 'נקודת מפנה',
      aliases: ['נקודת מפנה', 'נקודות מפנה'],
      short: 'נקודה ברורה שבה המחיר הסתובב: שיא או שפל.',
      body: 'הזוויות והמחזורים של גאן נמדדים כולם מנקודות כאלה.',
    },
  },
  {
    id: 'calibration',
    en: {
      term: 'Calibration',
      aliases: ['calibration', 'calibrated', 'overconfident', 'underconfident', 'overconfidence'],
      short: 'Whether how sure you feel matches how often you are right.',
      body: 'If your “80% sure” calls come true about 80% of the time, you are well calibrated. Most beginners are overconfident — the Time Machine measures it.',
    },
    he: {
      term: 'כיול',
      aliases: ['כיול', 'מכוילים', 'ביטחון יתר', 'ביטחון חסר'],
      short: 'האם כמה שאתם בטוחים תואם את כמה שאתם צודקים.',
      body: 'אם ההחלטות שעליהן אמרתם "80% בטוחים" מתממשות בערך ב-80% מהפעמים, אתם מכוילים היטב. רוב המתחילים סובלים מביטחון יתר – ומכונת הזמן מודדת את זה.',
    },
  },
]

const BY_ID = new Map(GLOSSARY.map((entry) => [entry.id, entry]))

export function glossaryEntry(id: string): GlossaryEntry | undefined {
  return BY_ID.get(id)
}

export type Segment = string | { id: string; text: string }

/**
 * Hebrew attaches prepositions and the article to the word: "בריבוע התשע",
 * "והתמיכה", "לפקודת". Up to two of them may precede a term.
 */
const HEBREW_PREFIX = '[ובהלמשכ]{0,2}'

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface Matcher {
  pattern: RegExp
  lookup: Map<string, string>
}

const matchers = new Map<Language, Matcher>()

function matcher(language: Language): Matcher {
  const cached = matchers.get(language)
  if (cached) return cached
  const lookup = new Map<string, string>()
  for (const entry of GLOSSARY) {
    for (const alias of entry[language].aliases) lookup.set(alias.toLowerCase(), entry.id)
  }
  // Longest first, so "1x1 balance line" wins over "1x1" and "Gann fan" over "Gann".
  const aliases = [...lookup.keys()].sort((a, b) => b.length - a.length).map(escape)
  const prefix = language === 'he' ? `(${HEBREW_PREFIX})` : '()'
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${prefix}(${aliases.join('|')})(?![\\p{L}\\p{N}])`,
    'giu',
  )
  const built = { pattern, lookup }
  matchers.set(language, built)
  return built
}

/**
 * Splits `text` into plain runs and glossary terms. Each term is linked once:
 * a paragraph that says "support" four times gets one link, not four.
 * `except` leaves one entry unlinked, for that entry's own definition.
 */
export function linkTerms(text: string, language: Language, except?: string): Segment[] {
  const { pattern, lookup } = matcher(language)
  const seen = new Set<string>(except ? [except] : [])
  const segments: Segment[] = []
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    const [whole, prefix, term] = match
    const id = lookup.get(term.toLowerCase())
    if (!id || seen.has(id)) continue
    seen.add(id)
    const start = match.index ?? 0
    if (start > cursor) segments.push(text.slice(cursor, start))
    // The prefix stays inside the link: "בריבוע התשע" is one word to a
    // Hebrew reader, and a link that began mid-word would look broken.
    segments.push({ id, text: prefix + term })
    cursor = start + whole.length
  }
  if (cursor < text.length) segments.push(text.slice(cursor))
  return segments
}
