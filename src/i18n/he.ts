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
  'common.buy': 'קנייה',
  'common.sell': 'מכירה',
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
  'home.badge': 'מסחר תרגול לימודי',
  'home.title': 'ללמוד את השוק בלי לסכן אגורה.',
  'home.subtitle':
    'מחירים אמיתיים, עלויות ביצוע אמיתיות, כסף וירטואלי. invest-pal מצייר את הגאומטריה של ו״ד גאן על גרף חי, ואז בינה מלאכותית מסבירה בשני משפטים פשוטים מה רואים — כדי שתתאמנו לקרוא שוק לפני שאתם מפקידים שקל.',
  'home.cta': 'פתחו חשבון תרגול',
  'home.ctaSignedIn': 'מעבר לשווקים',
  'home.ctaHint': 'בחינם, בלי כרטיס אשראי, בלי כסף אמיתי בשום שלב.',

  'home.featuresTitle': 'מה יש כאן',
  'home.featuresSubtitle': 'שישה דברים, והם עובדים ביחד.',
  'home.feature.charts.title': 'נתוני שוק אמיתיים',
  'home.feature.charts.body':
    'מחירים חיים והיסטוריים למניות ולקריפטו, מיום אחד ועד חמש שנים, בגרף נרות. אותם מספרים שהברוקר שלכם רואה.',
  'home.feature.gann.title': 'גאומטריית גאן על הגרף',
  'home.feature.gann.body':
    'קו האיזון 1x1 והמניפה שלו, תמיכות והתנגדויות של ריבוע התשע, ומספר הנרות בין נקודות מפנה בעבר — מחושבים מההיסטוריה, מצוירים במקום שרואים אותם.',
  'home.feature.mentor.title': 'בינה מלאכותית שמסבירה',
  'home.feature.mentor.body':
    'שני משפטים מתחת לכל גרף שאומרים מה המספרים אומרים עכשיו, בעברית או באנגלית. היא מסבירה; היא לא ממליצה, לא חוזה ולא אומרת לכם מה לעשות.',
  'home.feature.account.title': 'חשבון שמתנהג כמו חשבון',
  'home.feature.account.body':
    'אי אפשר למכור מה שאין לכם. קנייה שנייה מוסיפה לאחזקה אחת במקום לפתוח שנייה. מכירה בחסר קיימת, אבל כבויה עד שתדליקו אותה.',
  'home.feature.costs.title': 'עלויות שאינן הצגה',
  'home.feature.costs.body':
    'קונים במחיר המבוקש, מוכרים במחיר המוצע, ומשלמים עמלה על שני הביצועים — כך שסיבוב שלם בלי שינוי במחיר מפסיד כסף גם כאן, בדיוק כמו בכל מקום אחר.',
  'home.feature.reset.title': 'להתחיל קטן, להתחיל מחדש',
  'home.feature.reset.body':
    'התחילו עם $100, $1,000, $10,000 או $100,000 — חשבון קטן הוא השיעור החד יותר. אפשר למחוק ולהתחיל מחדש מתי שרוצים.',

  'home.howTitle': 'איך זה עובד',
  'home.step.one.title': 'בוחרים עם כמה מתחילים',
  'home.step.one.body':
    'נרשמים ובוחרים יתרת פתיחה. על $100 עמלת המינימום היא חצי אחוז בכל ביצוע, וזה מלמד מהר יותר מ־$100,000.',
  'home.step.two.title': 'קוראים את הגרף, ואז את ההערה',
  'home.step.two.body':
    'בוחרים נכס, מדליקים ומכבים את שכבות גאן, וקוראים את שני המשפטים של המנטור שמתחת — לפני שנוגעים במשהו.',
  'home.step.three.title': 'מתרגלים, ורואים כמה זה עלה',
  'home.step.three.body':
    'כל פקודה עוברת אישור לפני שהיא יוצאת, והתיק מראה רווח, הפסד, ואת המרווח והעמלה ששילמתם בדרך.',

  'home.honestTitle': 'מה זה לא',
  'home.honestBody':
    'לא ייעוץ השקעות, ולא תחזית. רמות גאן הן גאומטריה שנגזרת מנקודות מפנה בעבר — הן מתארות איפה המחיר התהפך קודם, לא איפה הוא יתהפך. שום דבר כאן לא נוגע בכסף אמיתי, ואין לסחור על סמך שום דבר כאן.',

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
  'experience.beginner': 'מתחיל',
  'experience.intermediate': 'בינוני',
  'experience.advanced': 'מתקדם',

  // ----- שווקים -----
  'markets.title': 'שווקים',
  'markets.subtitle':
    'מחירים אמיתיים מ-Yahoo Finance, עם גאומטריית גאן מתוך הניתוח השמור.',
  'markets.groupStocks': 'מניות וקרנות',
  'markets.groupCrypto': 'קריפטו',
  'markets.searchAssets': 'חיפוש לפי סימול או שם…',
  'markets.noAssets': 'אין התאמות.',
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
  'chart.touchHint': 'שתי אצבעות להזזת הגרף — אצבע אחת גוללת את העמוד.',
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
  'trade.amountLabel': 'סכום להשקעה',
  'trade.switchToAmount': 'להזין סכום במקום',
  'trade.switchToShares': 'להזין כמות במקום',
  'trade.amountBuys': 'קונה בערך {quantity} {ticker} במחיר שלמעלה.',
  'trade.feeHeavy':
    'העלויות מסתכמות ב־{percent}% מפקודה בגודל כזה. לעמלות יש רצפה, ולכן פקודה קטנה משלמת חלק גדול ממנה.',
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

  // ----- עמלות ברוקר -----
  'rates.title': 'כמה המסחר עולה לכם',
  'rates.subtitle':
    'ברוקרים גובים בצורות שונות, והצורה משנה אילו עסקאות בכלל הגיוניות.',
  'rates.label': 'פרופיל עלויות',
  'rates.spread': 'מרווח',
  'rates.spreadValue': '{stock} מניות · {crypto} קריפטו',
  'rates.minimum': 'מינימום לביצוע',
  'rates.perUnitValue': '${amount} למניה',
  'rates.none': 'אין',
  'rates.changedToast': 'מעכשיו נסחרים לפי עמלות {name}',
  'rates.error': 'לא ניתן לשנות את העמלות.',
  'rates.disclaimer':
    'אלה צורות גבייה נפוצות בשוק, לא המחירון המפורסם של ברוקר מסוים, והן לא מתעדכנות לפי אף אחד. ההשפעה היא רק על ביצועים עתידיים: פוזיציה שכבר פתוחה שומרת על המחיר והעמלה שבהם בוצעה.',
  'rates.standard.name': 'ברירת המחדל',
  'rates.standard.body':
    'מרווח צנוע ואחוז קטן עם רצפה. הנקודה היא שהעלות אינה אפס, לא לחקות ברוקר מסוים.',
  'rates.commission_free.name': 'ללא עמלה',
  'rates.commission_free.body':
    'אפס עמלה — ובמקומה מרווח רחב יותר. שם הברוקר ה״חינמי״ באמת מרוויח, ובסיבוב שלם זה עלול לעלות יותר מעמלה רגילה.',
  'rates.per_share.name': 'לפי מניה',
  'rates.per_share.body':
    'שבריר סנט לכל מניה, עם רצפה. אדיש למחיר: אלף מניות עולות אותו דבר בין אם הן ב־$10 או ב־$90, מה שמתאים לפקודות גדולות במניה זולה ומעניש פקודות קטנות.',
  'rates.percentage.name': 'לפי אחוז',
  'rates.percentage.body':
    'עשירית האחוז מהיקף העסקה, עם רצפה נמוכה. גדל עם גודל העסקה, ולכן לעולם לא מפתיע בעסקה גדולה.',
  'rates.bank.name': 'בנק קמעונאי',
  'rates.bank.body':
    'כמה עשיריות האחוז עם מינימום גבוה. נסו עסקה של $100 כאן: המינימום לבדו לוקח 15% ממנה, ולכן עסקאות קטנות דרך בנק כמעט אף פעם לא משתלמות.',

  // ----- פקודות ממתינות -----
  'orders.typeLabel': 'סוג פקודה',
  'orders.typeNow': 'שוק — ביצוע מיידי',
  'orders.typeLimit': 'לימיט — המתנה למחיר טוב יותר',
  'orders.typeStop': 'סטופ — המתנה למחיר גרוע יותר',
  'orders.typeTrailing': 'סטופ נגרר — עוקב אחרי המחיר',
  'orders.typeTime': 'מתוזמנת — המתנה לשעה',
  'orders.hintNow': 'מתבצעת מייד במחיר שלמעלה.',
  'orders.hintLimit':
    'קנייה ממתינה שהמחיר יירד לרמה שקבעתם, מכירה ממתינה שיעלה. לעולם לא תשלמו גרוע מהרמה שנקבתם.',
  'orders.hintStop':
    'מכירה ממתינה שהמחיר יירד לרמה שקבעתם — סטופ־לוס, הפקודה שמחליטה מראש כמה אתם מוכנים להפסיד. קנייה ממתינה שיעלה.',
  'orders.hintTrailing':
    'סטופ שעולה עם המחיר ולעולם לא יורד בחזרה. במקום רמה קובעים מרחק, והסטופ נשאר במרחק הזה מתחת למחיר הגבוה ביותר שנראה — כך שעלייה שומרת יותר מהרווח שלכם בלי שתיגעו בכלום.',
  'orders.hintTime':
    'מתבצעת במחיר השוק ברגע שהזמן מגיע. בלי שום הבטחה לגבי המחיר.',
  'orders.priceLabel': 'מחיר הפעלה',
  'orders.trailLabel': 'מרחק מאחורי המחיר',
  'orders.trailUnitLabel': 'יחידת מרחק',
  'orders.trailPercent': 'אחוזים',
  'orders.trailAmount': 'דולרים',
  'orders.trailHint':
    'כמה מתחת למחיר יישב הסטופ. אחוזים שומרים על אותו מרחק יחסי גם כשהמחיר זז; סכום קבוע לא.',
  'orders.trailPreview':
    'במחיר {price} היום, מכירה תיעצר ב־{down} וקנייה ב־{up}. הרמה עוקבת אחרי המחיר ולא נסוגה.',
  'orders.trailStopNow': 'הסטופ מתחיל ב־',
  'orders.trailStopAt': 'הסטופ כרגע ב־',
  'orders.trailSeenNote':
    'הסטופ זז כשהאפליקציה רואה מחיר חדש, כלומר כשהנכס פתוח לפניכם. תנועה שאיש לא ראה לא מרימה אותו.',
  'orders.whenLabel': 'להריץ בשעה',
  'orders.expiryLabel': 'תפוגה',
  'orders.expiryHint': 'לא חובה. אם תשאירו ריק, הפקודה ממתינה ללא הגבלה.',
  'orders.noExpiry': 'ללא',
  'orders.restBuy': 'שליחת פקודת קנייה',
  'orders.restSell': 'שליחת פקודת מכירה',
  'orders.cancel': 'ביטול פקודה',
  'orders.tab': 'ממתינות ({count})',
  'orders.emptyWaiting': 'אין פקודות ממתינות. אפשר לשלוח אחת מדף השווקים.',
  'orders.historyTitle': 'פקודות שהסתיימו',
  'orders.confirmTitle': 'לשלוח את הפקודה?',
  'orders.confirmBody':
    'הפעולה משאירה פקודה ממתינה על {quantity} {ticker}. שום דבר לא נקנה או נמכר, ושום כסף לא מוקצה, עד שהיא מופעלת.',
  'orders.confirmWarning':
    'הכסף אינו מוקצה מראש. אם היתרה לא תספיק ברגע ההפעלה, הפקודה תידחה ולא תתבצע — והדחייה תסביר למה.',
  'orders.confirmAction': 'שליחת הפקודה',
  'orders.placedToast': 'נשלחה פקודה על {quantity} {ticker}',
  'orders.cancelledToast': 'הפקודה בוטלה',
  'orders.cancelError': 'לא ניתן לבטל את הפקודה.',
  'orders.filledToast_one': 'פקודה ממתינה אחת בוצעה',
  'orders.filledToast_other': '{count} פקודות ממתינות בוצעו',
  'orders.rejectedToast_one': 'פקודה אחת לא הצליחה להתבצע',
  'orders.rejectedToast_other': '{count} פקודות לא הצליחו להתבצע',
  'orders.statusFILLED': 'בוצעה',
  'orders.statusCANCELLED': 'בוטלה',
  'orders.statusEXPIRED': 'פגה',
  'orders.statusREJECTED': 'נדחתה',
  'orders.statusPENDING': 'ממתינה',
  'orders.settlementNote':
    'שום דבר לא עוקב אחרי מחירים כשהאפליקציה סגורה. פקודה ממתינה נבדקת בכל פעם שפותחים את הגרף של אותו נכס, ולכן היא מתבצעת כשמסתכלים ולא ברגע שהשוק חוצה אותה.',

  // ----- רשימת מעקב -----
  'watchlist.title': 'במעקב',
  'watchlist.subtitle': 'הקישו על אחד כדי לפתוח את הגרף שלו.',
  'watchlist.follow': 'הוספה למעקב',
  'watchlist.unfollow': 'הסרה מהמעקב',
  'watchlist.added': '{ticker} נוסף למעקב',
  'watchlist.removed': '{ticker} הוסר מהמעקב',
  'watchlist.error': 'לא ניתן לעדכן את הרשימה.',

  // ----- התראות מחיר -----
  'alerts.title': 'עדכנו אותי כש…',
  'alerts.subtitle': 'לעקוב אחרי רמה בלי להתחייב לעסקה.',
  'alerts.directionLabel': 'לעקוב אחרי',
  'alerts.above': 'עלייה ל־',
  'alerts.below': 'ירידה ל־',
  'alerts.levelLabel': 'רמה',
  'alerts.add': 'הגדרת התראה',
  'alerts.remove': 'הסרה',
  'alerts.onThisAsset': 'התראות על הנכס הזה',
  'alerts.firedAt': 'הופעלה {when}',
  'alerts.setToast': 'הוגדרה התראה על {ticker}',
  'alerts.error': 'לא ניתן לעדכן את ההתראה.',
  'alerts.firedToast_one': 'התראת מחיר אחת',
  'alerts.firedToast_other': '{count} התראות מחיר',
  'alerts.firedTitle': 'רמות שנפגשו',
  'alerts.firedSubtitle': 'הקישו על אחת כדי לפתוח את הגרף.',
  'alerts.markSeen': 'סימון הכול כנקרא',
  'alerts.note':
    'התראה מופעלת פעם אחת ואז נעצרת. כמו פקודה ממתינה, היא נבדקת כשפותחים את הנכס ולא ברגע שהשוק חוצה אותה.',

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
  // ----- סורק גאן -----
  'scan.title': 'היכן הגאומטריה מסתדרת',
  'scan.subtitle':
    'בוחר את הנכס שקריאת גאן שלו מסודרת הכי טוב היום, ומסביר למה.',
  'scan.action': 'שיבחר לי אחד',
  'scan.beforeYouPress':
    'מדרג את כל הנכסים שהמנוע מדד, ואז מסביר את הראשון \u2014 באיזה צד הקריאה, על איזו רמה היא נשענת ועל איזה תאריך המחזורים מצביעים. שום דבר לא נקנה; הכפתור בסוף פותח את הגרף הזה.',
  'scan.errorTitle': 'לא ניתן לדרג את הנכסים',
  'scan.empty':
    'עדיין לא דורג דבר. המנוע מודד את כל הנכסים פעם ביום; אפשר לבדוק שוב אחרי ההרצה הבאה.',
  'scan.topPick': 'הבחירה הראשונה',
  'scan.biasLong': 'מעל ה־1x1',
  'scan.biasShort': 'מתחת ל־1x1',
  'scan.whyHeading': 'למה דווקא זה',
  'scan.whyLong':
    '{ticker} נסגר מעל קו ה־1x1 שלו, והצד הזה נקרא אצל גאן כצד הקנייה.',
  'scan.whyShort':
    '{ticker} נסגר מתחת לקו ה־1x1 שלו, והצד הזה נקרא אצל גאן כצד המכירה.',
  'scan.whyNone':
    'אין מניפה מאושרת בגרף הזה, ולכן אין צד לקרוא \u2014 הדירוג נשען על הרמות בלבד.',
  'scan.whyRoom':
    'יש פי {ratio} יותר מרחב עד הרמה הבאה שלפנים מאשר חזרה לזו שמאחור.',
  'scan.noRoom': 'אין רמה משני צידי המחיר שאפשר למדוד מולה.',
  'scan.whatHeading': 'מה זה אומר לעקוב אחריו',
  'scan.whatLong':
    'סגירה אחרונה {price}. התמיכה ב־{support} היא הרמה שקונה נשען עליה, ומעט מתחתיה מקומו של הסטופ. {resistance} היא הדבר הבא שעומד בדרך.',
  'scan.whatShort':
    'סגירה אחרונה {price}. ההתנגדות ב־{resistance} היא הרמה שמוכר נשען עליה, ומעט מעליה מקומו של הסטופ. {support} היא הדבר הבא שעומד בדרך.',
  'scan.whatNoLevels':
    'רמות ריבוע התשע כאן יושבות כולן בצד אחד של המחיר, ולכן אין תחום לסחור מולו.',
  'scan.whenHeading': 'מתי',
  'scan.whenDate':
    'המחזורים מצביעים על {date}, בעוד כ־{days} ימים. זה התאריך שסביבו נבנתה הקריאה \u2014 לא מועד אחרון לפעול בו.',
  'scan.whenNone':
    'אין מחזור צפוי בשלושת השבועות הקרובים, ולכן לזה לא מוצמד תאריך.',
  'scan.openPick': 'פתיחת {ticker}',
  'scan.opensChart':
    'מעביר אתכם ל־{ticker} בדף השווקים: הגרף עם המניפה המשורטטת עליו, קריאת גאן המלאה, והפאנל שבו שולחים פקודה.',
  'scan.alsoTitle': 'דורגו גם',
  'scan.roomShort': 'מרחב פי {ratio}',
  'scan.caveat':
    'זהו דירוג, לא ייעוץ. ציון גבוה אומר שגאומטריית גאן של הגרף הזה מסודרת היטב היום \u2014 היכן שהמחיר התהפך בעבר, לא היכן שיתהפך. תרגלו בכסף וירטואלי.',
}
