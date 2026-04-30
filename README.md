# Генератор PDF та HTML протоколів для Пліч-о-пліч

CLI-інструмент для перетворення результатів з формату IOF XML 3.0 (експорт з MeOS) у PDF-протоколи та HTML-перегляд:

- Індивідуальний протокол (по класах)
- Командний протокол (окремо чоловіки та жінки)
- Протокол результатів рогейну
- Протокол балів рогейну
- Протокол сплітів рогейну

Результати в протоколах розраховуються згідно правил національного проекту Пліч-о-пліч

## Встановлення додатку

1. Встановіть [Node.js](https://nodejs.org/en/download)
1. Відкрийте термінал (командний рядок)
1. Встановіть Playwright Chromium `npx playwright install chromium`
1. Встановіть додаток `npm install -g iof-reports`

## Оновлення додатку

Для оновлення додатку до останньої версії, в терміналі виконайте `npm update -g iof-reports`

## Вивантаження данних з MeOS

1. Відкрийте змагання в MeOS
1. На закладці `Змагання` натисність кнопку `Результати та спліти` в `Експорт даних`
1. Виберіть потрібні групи, тип експорту має бути `Результати IOF, версія 3.0 (xml)`
1. Збережіть файл на диск натиснувши `Експорт`

## Запуск додатку

1. Відкрийте командний рядок Windows
1. Виконайте `iof-reports <results.xml>`, де `<results.xml>` - IOF XML файл результатів.
1. За потреби виберіть конкретний звіт: `iof-reports <results.xml> --report individual`, `--report team`, `--report rogaining`, `--report rogaining-awards`, `--report rogaining-diplomas`, `--report rogaining-score` або `--report rogaining-splits`.
1. За потреби вкажіть інший файл конфігурації: `--config my-config.json`. За замовчуванням використовується `config.json` з поточної теки.
1. За потреби виберіть формат файлу: `--format pdf` або `--format docx`. DOCX наразі підтримується для `rogaining-awards`.
1. За потреби згенеруйте HTML-файл: `--html view` або `--html pdf`.
1. Для `rogaining-diplomas` за потреби увімкніть друк фону диплома через `--diploma-template on`. За замовчуванням `off`.

Доступні значення для `--report`: `all` (за замовчуванням), `individual`, `team`, `rogaining`, `rogaining-awards`, `rogaining-diplomas`, `rogaining-score`, `rogaining-splits`.
Доступні значення для `--html`: `none` (за замовчуванням), `view`, `pdf`.

Приклади:

- `iof-reports results.xml --report rogaining --html view` - створити `rogaining.html` для перегляду
- `iof-reports results.xml --report rogaining --html pdf` - створити `rogaining.pdf.html` для PDF-рендерингу
- `iof-reports results.xml --report rogaining-diplomas` - створити PDF для друку на готові дипломи
- `iof-reports results.xml --report rogaining-diplomas --diploma-template on` - створити дипломи разом із фоновим бланком у PDF
- `iof-reports results.xml --report rogaining-score` - створити протокол балів учасників рогейну
- `iof-reports results.xml --config championship-config.json --report rogaining-score` - створити протокол з іншим файлом конфігурації
- `iof-reports results.xml --report rogaining-splits --courses courses.xml` - створити протокол сплітів рогейну з відстанями між КП
- `iof-reports results.xml --report rogaining-awards --format docx` - створити редагований DOCX нагородного протоколу

Якщо є проблема з виводом кіриличних символів в консолі Windows, виконайте команду `chcp 65001` перед запуском додатку.

## Watch режим

Якщо MeOS періодично вивантажує повний XML у директорію, можна запустити режим стеження:

```bash
iof-reports watch \
  --input-dir ./incoming \
  --output-dir ./out \
  --report rogaining-awards \
  --port 4173
```

Поведінка:

- програма кожні кілька секунд шукає найновіший `*.xml` у `--input-dir`
- якщо файл новий або його вміст змінився, генерується новий HTML
- якщо найновіший файл ще дописується, цикл пропускається
- паралельно піднімається локальний HTTP-сервер для перегляду звіту

Артефакти в `--output-dir`:

- `report.html` - останній згенерований протокол
- `report.pdf.html` - HTML-версія для формування PDF
- `viewer.html` - оболонка для перегляду з автооновленням і автоскролом
- `meta.json` - метадані останнього згенерованого репорту
- `.watch-state.json` - службовий state з hash останнього XML

Додаткові параметри:

- `--poll-ms 3000` - інтервал перевірки папки
- `--settle-ms 1000` - пауза для перевірки, що latest XML уже не дописується
- `--port 4173` - порт локального HTTP-сервера
- `--diploma-template off|on` - чи вкладати фон диплома в `rogaining-diplomas`
- `--courses courses.xml` - файл `CourseData` для `rogaining-splits`
- `--config config.json` - файл конфігурації, за замовчуванням `config.json`

Після запуску відкривайте viewer через браузер:

- `http://127.0.0.1:4173/viewer` - viewer з автооновленням і автоскролом
- `http://127.0.0.1:4173/report` - поточний HTML-звіт
- `http://127.0.0.1:4173/meta` - метадані поточного звіту

Для локальної розробки:

```bash
npm run dev:watch -- --input-dir ./incoming --output-dir ./out --report rogaining --port 4173
```

## Конфігурація додатку

Змінні дані для формування протоколів налаштовуються в файлі `config.json`. Файл автоматично підхоплюється з поточної теки при наявності. [Приклад файлу](./config.json), який використовується за замовчуванням.

За потреби можна перевизначити верхній заголовок звіту через `reportHeader.title`. Поле підтримує HTML, наприклад `<br/>`.

Для визначення гендерної належності в рогейн-звітах використовуються налаштування `genderMapping`:

- `womenPrefixes`
- `mixPrefixes`
- `menPrefixes`

Бали для `rogaining-score` налаштовуються в `rogaining.scorePoints`:

- `youthUnder18` - юнаки/дівчата до 18 років включно
- `youthUnder23` - молодь старше 18 і до 23 років включно
- `adult` - дорослі класи
- `masters` - ветеранські класи 45+ і старші

У `rogaining-score` враховуються тільки ті категорії балів, які явно присутні в `scorePoints` завантаженого конфігу. Наприклад, якщо в конфігу є тільки `masters`, то дорослі, молодь і юнаки не додають рядків у протокол балів.

Службові поля звіту `rogaining-score` налаштовуються в `rogaining.scoreReport`: вид спорту, назва змагань, наказ, дата, місце, текст командного місця, назви програми, групи регіонів та підписи.

## Вимоги до проекту

- Node.js 18+
- Playwright Chromium
- npm
