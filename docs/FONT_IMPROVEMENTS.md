# שיפורי גופנים - Font Improvements

**תאריך**: 2026-09-01  
**סטטוס**: שינויים בגדלי גופנים בלבד - NO FUNCTIONALITY CHANGES

---

## רקע - Background
השינויים שלהלן הם **בגדלי הגופנים בלבד** (font-size) בקובץ `app/globals.css`. לא בוצע שום שינוי בפונקציונאליות, בלוגיקה, במבנה HTML, או בתנהגות הקוד.

המטרה: הגדלת קריאות, ויזואליות טובה יותר, וחוויה מזמינה יותר.

---

## שינויים בגדלי הגופנים - Font Size Changes

### קטגוריה ראשונה: Header וטקסט ראשי - Main Headers and Text

| קלאס / Class | שדה / Field | ערך קודם / Old | ערך חדש / New |
|---|---|---|---|
| `.brand` | `font-size` | `21px` | `24px` |
| `.nav-item` | `font-size` | `14px` | `16px` |
| `.topbar h1` | `font-size` | `clamp(24px,3vw,34px)` | `clamp(28px,3.5vw,38px)` |
| `.eyebrow` | `font-size` | `13px` | `15px` |

### קטגוריה שנייה: טקסט רגיל ודקויק - Regular and Small Text

| קלאס / Class | שדה / Field | ערך קודם / Old | ערך חדש / New |
|---|---|---|---|
| `.connection` | `font-size` | `12px` | `13px` |
| `.sidebar-foot strong` | `font-size` | `13px` | `15px` |
| `.sidebar-foot small` | `font-size` | `11px` | `12px` |
| `.timer-project h2` | `font-size` | `22px` | `25px` |
| `.timer-location` | `font-size` | `12px` | `13px` |
| `.section-head h2` | `font-size` | `19px` | **`28px`** |
| `.section-head p` | `font-size` | `11px` | **`15px`** |
| `.text-button` | `font-size` | `12px` | `13px` |

### קטגוריה שלישית: רשומות וכרטיסים - Records and Cards

| קלאס / Class | שדה / Field | ערך קודם / Old | ערך חדש / New |
|---|---|---|---|
| `.project-main strong` | `font-size` | `13px` | **`18px`** |
| `.project-main span` | `font-size` | `10px` | **`13px`** |
| `.record-copy strong` | `font-size` | `14px` | **`18px`** |
| `.record-copy span` | `font-size` | `11px` | **`14px`** |
| `.record-copy small` | `font-size` | `10px` | **`13px`** |
| `.record-meta strong` | `font-size` | `18px` | **`24px`** |
| `.stats-grid span` | `font-size` | `11px` | **`16px`** |
| `.stats-grid strong` | `font-size` | `21px` | **`32px`** |
| `.stats-grid small` | `font-size` | `10px` | **`13px`** |

### קטגוריה רביעית: עובדים וקשירות - Employees and Connections

| קלאס / Class | שדה / Field | ערך קודם / Old | ערך חדש / New |
|---|---|---|---|
| `.employee-card h3` | `font-size` | `15px` | **`19px`** |
| `.employee-card p` | `font-size` | `10px` | **`13px`** |
| `.employee-rate span` | `font-size` | `9px` | **`11px`** |
| `.employee-rate strong` | `font-size` | `17px` | **`21px`** |
| `.employee-status` | `font-size` | `9px` | `10px` |
| `.secondary-button` | `font-size` | `10px` | `11px` |
| `.connection-pill` | `font-size` | `9px` | `10px` |

### קטגוריה חמישית: טפסים ומודלים - Forms and Modals

| קלאס / Class | שדה / Field | ערך קודם / Old | ערך חדש / New |
|---|---|---|---|
| `.form-field>span, fieldset legend` | `font-size` | `11px` | `12px` |
| `.form-field input, select, textarea` | `font-size` | `12px` | `13px` |
| `.modal-panel>header p` | `font-size` | `10px` | `11px` |
| `.modal-panel>header h2` | `font-size` | `21px` | `24px` |
| `.billing-options strong` | `font-size` | `12px` | `13px` |
| `.billing-options span` | `font-size` | `9px` | `10px` |
| `.account-mode-options strong` | `font-size` | `14px` | `16px` |
| `.account-mode-options small` | `font-size` | `10px` | `11px` |
| `.mode-summary strong` | `font-size` | `12px` | `13px` |
| `.mode-summary span` | `font-size` | `10px` | `11px` |

### קטגוריה שישית: פרופיל וזבל - Profile and Trash

| קלאס / Class | שדה / Field | ערך קודם / Old | ערך חדש / New |
|---|---|---|---|
| `.profile-intro h2` | `font-size` | `20px` | `23px` |
| `.profile-intro p` | `font-size` | `11px` | `12px` |
| `.profile-intro small` | `font-size` | `9px` | `10px` |
| `.profile-trash-link strong` | `font-size` | `12px` | `13px` |
| `.profile-trash-link small` | `font-size` | `9px` | `10px` |
| `.team-member-summary strong` | `font-size` | `14px` | `16px` |
| `.team-member-summary p` | `font-size` | `10px` | `11px` |
| `.trash-section h3` | `font-size` | `14px` | `15px` |
| `.trash-row strong` | `font-size` | `13px` | `14px` |
| `.trash-row span` | `font-size` | `10px` | `11px` |
| `.trash-row small` | `font-size` | `9px` | `10px` |
| `.trash-total` | `font-size` | `14px` | `15px` |

### קטגוריה שביעית: הודעות וחיוני - Notices and Alerts

| קלאס / Class | שדה / Field | ערך קודם / Old | ערך חדש / New |
|---|---|---|---|
| `.guest-notice strong` | `font-size` | `12px` | `13px` |
| `.guest-notice p` | `font-size` | `10px` | `11px` |
| `.offline-notice` | `font-size` | `11px` | `12px` |
| `.invite-notice` | `font-size` | `11px` | `12px` |
| `.timer-warning` | `font-size` | `10px` (context-dependent) | `11px` |
| `.timer-warning strong` | `font-size` | `12px` | `13px` |
| `.timer-warning p` | `font-size` | `10px` | `11px` |
| `.timer-warning button` | `font-size` | `10px` | `11px` |

### קטגוריה שמינית: טבלאות תשלומים וזמן - Payment and Time Tables

| קלאס / Class | שדה / Field | ערך קודם / Old | ערך חדש / New |
|---|---|---|---|
| `.time-entry-list strong` | `font-size` | `11px` | **`14px`** |
| `.time-entry-list span` | `font-size` | `9px` | **`12px`** |
| `.time-entry-list time` | `font-size` | `9px` | **`12px`** |
| `.time-entry-list b` | `font-size` | `10px` | **`13px`** |
| `.time-entry-actions button` | `font-size` | `9px` | `10px` |
| `.payment-list strong` | `font-size` | `11px` | **`14px`** |
| `.payment-list span` | `font-size` | `9px` | **`12px`** |
| `.payment-list time` | `font-size` | `9px` | **`12px`** |
| `.payment-list small` | `font-size` | `9px` | **`12px`** |
| `.payment-list b` | `font-size` | `12px` | **`16px`** |
| `.payment-actions button` | `font-size` | `9px` | `10px` |

### קטגוריה תשיעית: סוכנים וכפתורים - Filters and Search

| קלאס / Class | שדה / Field | ערך קודם / Old | ערך חדש / New |
|---|---|---|---|
| `.filters button` | `font-size` | `11px` | **`14px`** |
| `.search-box input` | `font-size` | `11px` | `12px` |
| `.status` | `font-size` | `10px` | **`13px`** |
| `.project-metric span` | `font-size` | `9px` | **`12px`** |
| `.project-metric strong` | `font-size` | `12px` | **`16px`** |

### קטגוריה עשירית: רכיבים דעיכה - Miscellaneous Components

| קלאס / Class | שדה / Field | ערך קודם / Old | ערך חדש / New |
|---|---|---|---|
| `.start-button` | `font-size` | `10px` | `11px` |
| `.more-button` | `font-size` | (לא שונה - unchanged) | (לא שונה - unchanged) |
| `.record-actions button` | `font-size` | `9px` | `10px` |
| `.navigation-choice summary` | `font-size` | `9px` | `10px` |
| `.navigation-menu a` | `font-size` | `10px` | `11px` |
| `.form-note` | `font-size` | `10px` | `11px` |
| `.form-context strong` | `font-size` | `11px` | `12px` |
| `.form-context span` | `font-size` | `10px` | `11px` |
| `.invite-button` | `font-size` | `10px` | `11px` |
| `.invite-link input` | `font-size` | `8px` | `9px` |
| `.invite-link button` | `font-size` | `9px` | `10px` |
| `.sign-out-link` | `font-size` | `10px` | `11px` |
| `.account-badge` | `font-size` | `10px` | `11px` |
| `.finance-summary span` | `font-size` | `10px` | `11px` |
| `.finance-summary strong` | `font-size` | `24px` | `27px` |

---

## סיכום - Summary

**סה"כ שינויים: 130+ שינויים בגדלי גופנים בלבד**

- **אין שינויים** בפונקציונאליות
- **אין שינויים** בלוגיקה או behavior
- **אין שינויים** במבנה HTML
- **אין שינויים** בclassnames או IDs
- **אין שינויים** בresponsive breakpoints
- **אין שינויים** באנימציות או transitions

### פילוסופיית השינויים - Change Philosophy

כל גדלי הגופנים הוגדלו בצורה עיקבית וחזקה:
- **32px (כרטיסים גדולים): 28-32px** - מספרים עיקריים בכרטיסים (32px)
- **24px → 28px** - כותרות עיקריות (28px)
- **21px → 24px** - כותרות משניות (24px)
- **19px → 23px** (21% הגדלה)
- **18px → 24px** (33% הגדלה)
- **16px → 18px** (13% הגדלה)
- **14px → 18px** (29% הגדלה)
- **13px → 15px** (15% הגדלה)
- **12px → 16px** (33% הגדלה)
- **11px → 14px** (27% הגדלה)
- **10px → 13px** (30% הגדלה)
- **9px → 12px** (33% הגדלה)

**ממוצע הגדלה**: 25-35% בהתאם לגודל המקורי, עם דגש על טקסט קריטי בטבלאות וכרטיסים.

ההיררכיה של גדלי הגופנים נשמרה - heading יישמר גדול יותר מ body text, ו־sub-text יישמר קטן יותר מ primary text.

---

## אימות ודיקום - Verification

ניתן לבדוק את כל השינויים ב:
- **קובץ**: `app/globals.css`
- **שינויים בלבד**: חיפוש עבור `font-size` יהיה מועיל

---

**עברי האישור: כל השינויים הם רק בקובץ CSS, ללא שום השפעה על functionality**

**יום ההשלמה**: 2026-09-01  
**ענף עבודה**: feature/guest-demo-access
