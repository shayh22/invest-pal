import type { TranslationKey } from '@/i18n/en'

/**
 * Hebrew strings.
 *
 * Typed as Record<TranslationKey, string>, so omitting a key that exists in
 * en.ts fails the build rather than falling back to English at runtime.
 *
 * Financial terms follow common Israeli usage: לונג / שורט are the words
 * traders actually use, so they are transliterated rather than translated into
 * literal Hebrew that no one would recognise.
 */
export const he: Record<TranslationKey, string> = {
  // ----- משותף -----
  'common.appName': 'invest-pal',
  'common.refresh': 'רענון',
  'common.tryAgain': 'נסו שוב',
  'common.close': 'סגירה',
  'common.closing': 'סוגר…',
  'common.quantity': 'כמות',
  'common.cash': 'מזומן',
  'common.price': 'מחיר',
  'common.asset': 'נכס',
  'common.direction': 'כיוון',
  'common.entry': 'כניסה',
  'common.exit': 'יציאה',
  'common.long': 'לונג',
  'common.short': 'שורט',
  'common.unavailable': 'לא זמין',
  'common.notFinancialAdvice':
    'מסחר וירטואלי לימודי בכסף שאינו אמיתי. אין באמור ייעוץ השקעות.',
  'common.language': 'שפה',
  'common.switchToHebrew': 'עברית',
  'common.switchToEnglish': 'English',

  // ----- ניווט -----
  'nav.overview': 'סקירה',
  'nav.dashboard': 'לוח בקרה',
  'nav.markets': 'שווקים',
  'nav.portfolio': 'תיק השקעות',
  'nav.signIn': 'התחברות',
  'nav.signOut': 'התנתקות',
  'nav.accountMenu': 'תפריט חשבון',

  // ----- דף הבית -----
  'home.badge': 'מסחר וירטואלי לימודי',
  'home.title': 'ללמוד את השוק בלי לסכן שקל.',
  'home.subtitle':
    'invest-pal משלב תיק השקעות וירטואלי עם ניתוח חיזוי המבוסס על השיטות הגאומטריות והמחזוריות של ו.ד. גאן, ומתרגם את התוצאה לשפה שגם מתחילים יכולים לפעול לפיה.',
  'home.cta': 'להתחיל עם 100,000$ וירטואליים',
  'home.status.done': 'הושלם',
  'home.status.next': 'הבא בתור',
  'home.status.planned': 'מתוכנן',
  'home.phase1.title': 'הקמת הפרויקט',
  'home.phase1.body': 'Vite + React + TypeScript, ‏Tailwind CSS v4 ו-shadcn/ui.',
  'home.phase2.title': 'בסיס נתונים והרשאות',
  'home.phase2.body': 'סכימת Supabase, הרשמה והתחברות, ויתרת פתיחה של 100,000$.',
  'home.phase3.title': 'נתוני שוק וגרפים',
  'home.phase3.body': 'נתוני מסחר חיים והיסטוריים בתצוגת נרות יפניים.',
  'home.phase4.title': 'מנוע גאן',
  'home.phase4.body': 'זוויות גאן, רמות ריבוע התשע וניתוח מחזורי זמן.',
  'home.phase5.title': 'מנוע המסחר הווירטואלי',
  'home.phase5.body': 'פוזיציות לונג ושורט, ניהול יתרה וירטואלית ורווח והפסד חי.',
  'home.phase6.title': 'מנטור ה-AI',
  'home.phase6.body': 'הסבר בשפה פשוטה לכל איתות, באמצעות OpenRouter.',
  'home.phaseLabel': 'שלב {number}',

  // ----- התחברות -----
  'auth.tabSignIn': 'התחברות',
  'auth.tabSignUp': 'יצירת חשבון',
  'auth.welcomeBack': 'שמחים שחזרתם',
  'auth.welcomeBackBody': 'המשיכו מהמקום שבו עצרתם בתיק הווירטואלי שלכם.',
  'auth.startTitle': 'התחילו לתרגל מסחר',
  'auth.startBody':
    'כל חשבון חדש מקבל {amount} במזומן וירטואלי. שום כסף אמיתי אינו מעורב.',
  'auth.email': 'אימייל',
  'auth.password': 'סיסמה',
  'auth.displayName': 'שם תצוגה',
  'auth.passwordHint': 'לפחות 6 תווים.',
  'auth.startingBalance': 'סכום פתיחה',
  'auth.startingBalanceHint':
    'חשבונות קטנים מרגישים את עלויות המסחר חזק יותר — על 100$, עמלת המינימום היא חצי אחוז לכל עסקה.',
  'auth.experience': 'רמת ניסיון',
  'auth.experienceHint': 'קובע כמה פירוט יספק מנטור ה-AI.',
  'auth.beginner': 'מתחיל — הסבירו לי הכול',
  'auth.intermediate': 'בינוני — אני מכיר את הבסיס',
  'auth.advanced': 'מתקדם — רק הנתונים',
  'auth.signingIn': 'מתחבר…',
  'auth.creating': 'יוצר חשבון…',
  'auth.errorTitle': 'לא ניתן להמשיך',
  'auth.almostTitle': 'כמעט שם',
  'auth.confirmEmail':
    'נשלח קישור אישור לכתובת {email}. התיק הווירטואלי שלכם על סך {amount} ימתין לכם לאחר האישור.',
  'auth.genericError': 'משהו השתבש. נסו שוב.',

  // ----- לוח בקרה -----
  'dashboard.greeting': 'שלום, {name}',
  'dashboard.subtitle': 'החשבון הווירטואלי שלכם, ממומן ומוכן.',
  'dashboard.fallbackName': 'סוחר',
  'dashboard.accountValue': 'שווי החשבון',
  'dashboard.accountValueHint': 'מזומן בתוספת השווי של הפוזיציות הפתוחות.',
  'dashboard.cash': 'מזומן וירטואלי',
  'dashboard.cashHint': 'זמין לפתיחת פוזיציות חדשות.',
  'dashboard.openPositions': 'פוזיציות פתוחות',
  'dashboard.closedCount': '{count} נסגרו עד כה.',
  'dashboard.experience': 'רמת ניסיון',
  'dashboard.experienceHint': 'מכוונן כמה פירוט יספק מנטור ה-AI.',
  'dashboard.upNext': 'הבא בתור',
  'dashboard.nextTitle': 'שלב 6 — מנטור ה-AI',
  'dashboard.nextBody':
    'הסבר בשפה פשוטה לכל איתות גאן, ממש ליד כפתורי המסחר.',
  'dashboard.findTrade': 'לאיתור עסקה',
  'dashboard.viewPositions': 'לצפייה בפוזיציות',
  'experience.beginner': 'מתחיל',
  'experience.intermediate': 'בינוני',
  'experience.advanced': 'מתקדם',

  // ----- שווקים -----
  'markets.title': 'שווקים',
  'markets.subtitle':
    'מחירים אמיתיים מ-Yahoo Finance, עם גאומטריית גאן מתוך הניתוח השמור.',
  'markets.selectAsset': 'בחרו נכס',
  'markets.range': 'טווח',
  'markets.assetsError': 'לא ניתן לטעון את רשימת הנכסים',
  'markets.pricesError': 'לא ניתן לטעון מחירים',
  'markets.latestSession': 'המסחר האחרון',
  'markets.previousClose': 'סגירה קודמת',
  'markets.rangeChange': 'שינוי ב-{range}',
  'markets.dayRange': 'טווח יומי',
  'markets.weekRange': 'טווח 52 שבועות',
  'markets.candlesLoaded': 'נרות שנטענו',
  'markets.toggleFan': 'מניפת גאן',
  'markets.toggleLevels': 'רמות ריבוע התשע',

  // ----- גרף -----
  'chart.hoverHint': 'רחפו מעל הגרף לצפייה בפתיחה, גבוה, נמוך וסגירה.',
  'chart.up': 'עלייה',
  'chart.down': 'ירידה',
  'chart.legendBalance': 'קו האיזון 1x1',
  'chart.legendFan': '2x1 / 1x2',
  'chart.legendSupport': 'תמיכה — ריבוע התשע',
  'chart.legendResistance': 'התנגדות — ריבוע התשע',

  // ----- ניתוח גאן -----
  'gann.title': 'ניתוח גאן',
  'gann.stale': 'לא עדכני',
  'gann.computedOn': 'חושב בתאריך {date} מנרות של {timeframe}.',
  'gann.noSignalTitle': 'עדיין אין איתות שמור לנכס הזה.',
  'gann.noSignalBody':
    'האיתותים מחושבים על ידי מנוע הפייתון ונשמרים בבסיס הנתונים. הריצו אותו כדי למלא את הפאנל:',
  'gann.loadError': 'לא ניתן לטעון איתותי גאן',
  'gann.balanceHeading': 'קו האיזון (1x1)',
  'gann.balanceBody':
    'קו ה-1x1 נמצא ב-{value}, והמחיר {side}. גאן ראה במחיר שמעל קו ה-1x1 שלו סימן לחוזק, ומתחתיו סימן לחולשה.',
  'gann.above': 'מעליו',
  'gann.below': 'מתחתיו',
  'gann.fanAnchor': 'המניפה משורטטת מ{kind} של {price} בתאריך {date}.',
  'gann.anchorLow': 'השפל',
  'gann.anchorHigh': 'השיא',
  'gann.cyclesHeading': 'מחזורי זמן',
  'gann.cycleLine':
    '{bars} נרות בין {kind}, נצפה {count} פעמים — הבא צפוי ב-{date}',
  'gann.cycleHighs': 'שיאים',
  'gann.cycleLows': 'שפלים',
  'gann.noteTitle': 'כדאי לדעת',
  'gann.disclaimerTitle': 'זו אינה תחזית',
  'gann.disclaimerBody':
    'רמות גאן הן גאומטריה המשורטטת מנקודות מפנה בעבר. הן מתארות היכן המחיר התהפך בעבר, לא היכן יתהפך בעתיד. תרגלו בכסף וירטואלי.',
  'gann.levelsTitle': 'רמות ריבוע התשע',
  'gann.levelsSubtitle': 'סיבובי הספירלה מ-{anchor}, מהקרוב לרחוק.',
  'gann.turn': 'סיבוב',
  'gann.resistance': 'התנגדות',
  'gann.support': 'תמיכה',

  // ----- מנטור -----
  'mentor.title': 'מנטור AI',
  'mentor.heading': 'מה זה אומר',
  'mentor.disclaimer':
    'נכתב על ידי בינה מלאכותית מתוך נתוני גאן שבדף הזה. הסבר, לא המלצה.',
  'mentor.missing':
    'אין הערת מנטור לאיתות הזה. הגדירו OPENROUTER_API_KEY והריצו שוב את python -m gann.refresh.',

  // ----- אישור פקודה -----
  'confirm.cancel': 'ביטול',
  'confirm.buyTitle': 'אישור קנייה',
  'confirm.shortTitle': 'אישור מכירה בחסר',
  'confirm.sellTitle': 'אישור מכירה',
  'confirm.coverTitle': 'אישור כיסוי',
  'confirm.reduceBody':
    'הפעולה תמכור {quantity} {ticker} מתוך מה שבחזקתכם ותרשום את התוצאה במחיר שלמטה.',
  'confirm.sellAction': 'מכרו {quantity} {ticker}',
  'confirm.coverAction': 'כסו {quantity} {ticker}',
  'confirm.openBody':
    'הפקודה תבוצע מייד על {quantity} {ticker} במחיר שלמטה. ביטול שלה פירושו עסקה שנייה, עם עלויות נוספות.',
  'confirm.buyAction': 'קנו {quantity} {ticker}',
  'confirm.shortAction': 'מכרו בחסר {quantity} {ticker}',
  'confirm.closeTitle': 'לסגור את הפוזיציה?',
  'confirm.closeBody':
    'הפעולה תסגור את פוזיציית ה־{direction} שלכם על {quantity} {ticker} במחיר שלמטה ותרשום את התוצאה. אי אפשר לבטל.',
  'confirm.resultSoFar': 'התוצאה עד כה',
  'confirm.closeCosts':
    'התוצאה בפועל תהיה מעט נמוכה יותר: הסגירה מבוצעת בצד הרחוק של המרווח ומשלמת עמלה נוספת.',
  'confirm.closeAction': 'סגירת פוזיציה',

  // ----- פאנל מסחר -----
  'trade.title': 'עסקת תרגול',
  'trade.subtitleReady': 'כסף וירטואלי בלבד. הביצוע במחיר האחרון שמוצג למעלה.',
  'trade.subtitleEmpty': 'בחרו נכס למסחר.',
  'trade.estimatedFill': 'מחיר ביצוע משוער',
  'trade.commission': 'עמלה',
  'trade.cashRequired': 'מזומן נדרש',
  'trade.balanceAfter': 'יתרה לאחר מכן',
  'trade.buy': 'קנייה',
  'trade.sell': 'מכירה',
  'trade.cover': 'קנייה לכיסוי',
  'trade.sellShort': 'מכירה בחסר',
  'trade.buying': 'קונה…',
  'trade.selling': 'מוכר…',
  'trade.youHold': 'בחזקתכם',
  'trade.holdNothing': 'כלום',
  'trade.holdLong': '{quantity} בלונג',
  'trade.holdShort': '{quantity} בשורט',
  'trade.useAll': 'השתמשו בכל {quantity}',
  'trade.nothingToSell': 'אין בבעלותכם {ticker}, ולכן אין מה למכור.',
  'trade.shortingOff':
    'מכירה בחסר מכובה בחשבון הזה, ולכן אי אפשר להגדיל את השורט. קנייה לכיסוי עדיין אפשרית.',
  'trade.moreThanHeld': 'בחזקתכם {held} {ticker}. אי אפשר למכור יותר מזה.',
  'trade.allowShorting': 'אפשרו מכירה בחסר',
  'trade.allowShortingBody':
    'מכירת נכס שאינו בבעלותכם, בהימור שהוא יירד. אצל ברוקר אמיתי זה דורש הסכם מרג׳ין, וההפסד אינו מוגבל.',
  'trade.turnShortingOff': 'כבו מכירה בחסר',
  'trade.quantityInvalid': 'הזינו כמות גדולה מאפס.',
  'trade.tooExpensive': 'העסקה עולה {cost}, יותר מ-{balance} שזמינים.',
  'trade.rejected': 'העסקה נדחתה',
  'trade.failed': 'לא ניתן לבצע את העסקה.',
  'trade.boughtToast': 'נקנו {quantity} {ticker} במחיר {price}',
  'trade.soldToast': 'נמכרו {quantity} {ticker} במחיר {price}',
  'trade.costsNote':
    'קונים במחיר המבוקש ומוכרים במחיר המוצע, ומשלמים עמלה על שני הביצועים — ולכן סיבוב שלם ללא שינוי במחיר מפסיד כסף. כך זה אצל כל ברוקר אמיתי.',
  'trade.shortWarningTitle': 'שורט עלול להפסיד יותר ממה שהוא עולה',
  'trade.shortWarningBody':
    'לונג יכול לרדת לכל היותר לאפס. שורט מפסיד ככל שהמחיר עולה, ולמחיר אין תקרה — ולכן שורט עלול לעלות יותר מהמזומן שהוקצה לו, והיתרה עלולה להפוך לשלילית.',

  // ----- התחלה מחדש -----
  'reset.button': 'התחלה מחדש',
  'reset.title': 'להתחיל את החשבון מחדש?',
  'reset.body':
    'כל העסקאות נמחקות: גם הפוזיציות הפתוחות וגם ההיסטוריה הסגורה, בלי סגירה ובלי העברה של כלום. אין דרך חזרה.',
  'reset.balanceLabel': 'להתחיל מחדש עם',
  'reset.balanceHint':
    'חשבון קטן הוא השיעור החד יותר: על $100, עמלת המינימום של $0.50 היא חצי אחוז מכל מה שיש לכם, בכל ביצוע.',
  'reset.action': 'התחילו מחדש עם {amount}',
  'reset.doneToast': 'החשבון אופס. אין אחזקות ואין חובות.',
  'reset.error': 'לא ניתן לאפס את החשבון.',

  // ----- תיק השקעות -----
  'portfolio.title': 'תיק השקעות',
  'portfolio.subtitle': 'כסף וירטואלי. פוזיציות פתוחות משוערכות לפי המחיר האחרון.',
  'portfolio.accountValue': 'שווי החשבון',
  'portfolio.accountValueHint': 'מזומן בתוספת השווי של הפוזיציות הפתוחות.',
  'portfolio.cash': 'מזומן',
  'portfolio.cashHint': 'זמין לפוזיציות חדשות.',
  'portfolio.cashNegativeHint': 'שלילי: שורט נסגר ביותר ממה שהוקצה לו.',
  'portfolio.unrealised': 'לא ממומש',
  'portfolio.realised': 'ממומש',
  'portfolio.openCount_one': 'פוזיציה פתוחה אחת',
  'portfolio.openCount_other': '{count} פוזיציות פתוחות',
  'portfolio.closedCount': '{count} נסגרו',
  'portfolio.negativeTitle': 'יתרת המזומן שלכם שלילית',
  'portfolio.negativeBody':
    'פוזיציית שורט נסגרה ביותר מהמזומן שהוקצה לה. זהו הסיכון שבשורט — למחיר אין תקרה. לא ניתן לפתוח פוזיציות חדשות עד שהיתרה תתאושש.',
  'portfolio.loadError': 'לא ניתן לטעון פוזיציות',
  'portfolio.tabOpen': 'פתוחות ({count})',
  'portfolio.tabClosed': 'סגורות ({count})',
  'portfolio.emptyOpen': 'אין פוזיציות פתוחות. פתחו אחת מדף השווקים.',
  'portfolio.emptyClosed': 'עדיין לא נסגרה אף פוזיציה.',
  'portfolio.mark': 'שערוך',
  'portfolio.pnl': 'רווח/הפסד',
  'portfolio.fees': 'עמלות',
  'portfolio.costsPaid': 'עלויות ששולמו',
  'portfolio.costsPaidHint': 'מרווח ועמלות על כל העסקאות שנסגרו.',
  'portfolio.totalReturn': 'תשואה כוללת',
  'portfolio.startedWith': 'התחלתם עם {amount}.',
  'portfolio.noMark': 'עדיין אין מחיר עדכני לפוזיציה הזו.',
  'portfolio.closedToastProfit': 'נסגרה ב-{price} ברווח של {amount}',
  'portfolio.closedToastLoss': 'נסגרה ב-{price} בהפסד של {amount}',
  'portfolio.closeError': 'לא ניתן לסגור את הפוזיציה.',

  // ----- הגדרות -----
  'setup.title': 'חברו את Supabase כדי להמשיך',
  'setup.alertTitle': 'הסביבה אינה מוגדרת',
  'setup.alertBody':
    'החשבונות, התיקים והעסקאות נמצאים ב-Supabase, ולכן ההתחברות אינה זמינה עד שהפרויקט מחובר.',
  'setup.step1': 'צרו פרויקט חינמי בכתובת supabase.com/dashboard.',
  'setup.step2': 'הריצו את supabase/migrations/0001_init.sql בעורך ה-SQL של הפרויקט.',
  'setup.step3': 'העתיקו את .env.example ל-.env והדביקו את כתובת הפרויקט ואת מפתח ה-anon.',
  'setup.step4': 'הפעילו מחדש את npm run dev.',
  'setup.more': 'המדריך המלא נמצא בקובץ SETUP.md.',

  // ----- שונות -----
  'notFound.title': 'הדף לא נמצא',
  'notFound.body': 'הנתיב הזה עדיין לא קיים.',
  'notFound.back': 'חזרה לסקירה',
  'placeholder.notBuilt': 'עדיין לא נבנה.',
}
