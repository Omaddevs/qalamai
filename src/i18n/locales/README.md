# World-language dictionaries

`src/i18n/msg/<area>.js` holds every UI text in the six regional languages (uz, ru, en, kk, ky, tg).
This folder holds the same keys in the 18 world languages, one JSON file per language and area:

    src/i18n/locales/<lang>/<area>.json      e.g. locales/es/home.json ↔ msg/home.js

Languages: zh (Simplified Chinese), hi, es, fr, ar, bn, pt (Brazilian), ur, id, de, ja, tr, ko, vi, it, fa, pl, uk.
`scripts/i18n-dict.mjs` merges them into the dictionary; `npm run i18n:check` (or `node scripts/i18n-check.mjs --lang es`)
verifies them. A missing world-language text falls back to English.

## File format

A flat JSON object, keys in the same order as the area's `msg/*.js`, every key of that area present:

```json
{
  "eb.newTitle": "Hay una nueva versión",
  "ad.slidesN": { "one": "{n} diapositiva", "many": "{n} de diapositivas", "other": "{n} diapositivas" }
}
```

## Rules for translators

1. **Source.** Translate from the English text; read the Russian and Uzbek texts and the comments in `msg/*.js`
   for context (where the text is shown, what a button does). Write natural, native product language as a
   professional localizer of a modern SaaS app would — not word-for-word. Use the polite/formal register of
   that language's software UI (es: tú is fine for consumer apps — use "tú"; fr: "vous"; de: "du"; it: "tu";
   pt-BR: "você"; pl: informal imperatives like modern apps; uk: "ви"; ja: です/ます; ko: 해요체/합니다 as fits UI;
   hi/ur/bn/fa/ar/tr/id/vi/zh: the standard polite UI register).
2. **Placeholders.** Keep every `{name}` exactly as written (never translate or rename what is inside the braces).
   A placeholder may move anywhere the grammar needs it. Do not add placeholders English doesn't use
   (exception: an entry with `_vars` lists extra ones allowed, e.g. `{n}`).
3. **Rich tags.** Keep `<b>…</b>`, `<strong>`, `<em>`, `<i>`, `<br/>` — same count; wrap the word the English wraps.
4. **Lists.** A text with `|` is a list: keep exactly the same number of items, in the same order, and no `|`
   inside an item. (`ad.names` lists language names in this order — translate each name into your language.)
5. **Plurals.** When the English text is an object (`{ one, other }`), write an object with every plural category
   your language has (Intl.PluralRules): zh/ja/ko/id/vi → `other`; hi/bn/ur/fa/de/tr → `one, other`;
   es/fr/pt/it → `one, many, other` (`many` is the millions form: "1 000 000 de diapositivas");
   pl/uk → `one, few, many, other`; ar → `zero, one, two, few, many, other`.
   If English is a plain string, write a plain string (unless `_vars` lets you use a plural on `{n}`).
6. **Empty texts.** If the English text is `""`, write `""`. Keys ending in `.l2a`, `.l2b`, `.title2`, `.guest2`,
   `.titleEm` are parts of a split sentence — you may move words between the parts and leave one empty.
7. **Keep as is:** brand and product names (QalamAI, QalamCoin, Word, Excel, PowerPoint, PDF, Telegram, Google,
   Canva, Payme, Click, HUMO, UZCARD, VISA, Markdown …), URLs, e-mails, file names and extensions, keyboard keys
   (Ctrl, ⌘, Shift), units like MB/KB, emoji, and the Uzbek document ids shown in quotes.
8. **Facts stay true.** Prices, coin amounts and payments are in Uzbek söm / UZS with Uzbek bank cards — keep those
   currencies and numbers. Only the sample-document texts in `bp.*` follow the language's country:

   | lang | country | capital (bp.city) | phone (bp.phone) | currency (bp.cur) |
   |---|---|---|---|---|
   | zh | China | 北京 | +86 ___ ____ ____ | 元 |
   | hi | India | नई दिल्ली | +91 _____ _____ | रुपये |
   | es | Spain | Madrid | +34 ___ ___ ___ | € |
   | fr | France | Paris | +33 _ __ __ __ __ | € |
   | ar | Egypt | القاهرة | +20 ___ ___ ____ | جنيه |
   | bn | Bangladesh | ঢাকা | +880 ____ ______ | টাকা |
   | pt | Brazil | Brasília | +55 __ _____ ____ | R$ |
   | ur | Pakistan | اسلام آباد | +92 ___ _______ | روپے |
   | id | Indonesia | Jakarta | +62 ___ ____ ____ | Rp |
   | de | Germany | Berlin | +49 ___ ________ | € |
   | ja | Japan | 東京 | +81 __ ____ ____ | 円 |
   | tr | Türkiye | Ankara | +90 ___ ___ __ __ | TL |
   | ko | South Korea | 서울 | +82 __ ____ ____ | 원 |
   | vi | Vietnam | Hà Nội | +84 ___ ___ ____ | đồng |
   | it | Italy | Roma | +39 ___ ___ ____ | € |
   | fa | Iran | تهران | +98 ___ ___ ____ | تومان |
   | pl | Poland | Warszawa | +48 ___ ___ ___ | zł |
   | uk | Ukraine | Київ | +380 __ ___ __ __ | грн |

   `bp.ministry` and similar official names become that country's real institution (Spain: "MINISTERIO DE
   UNIVERSIDADES"), written the way such a title page writes them (kk/ky/tg in `msg/bp.js` show the pattern).
   University names in `uni.*` are real Uzbek universities: give their established name in your language
   (or a faithful translation), never another country's university.
9. **Typography.** Use the language's own punctuation and quotes (« » in fr with narrow spaces, „ “ in de/pl/uk,
   「」 in ja, “ ” in zh with full-width punctuation ，。：？！, ، and ؟ in ar/fa/ur, । in hi/bn). No machine artefacts,
   no English left untranslated unless it is a brand from rule 7.
10. **Length.** Buttons and labels are short in the UI — keep them about as short as English.
