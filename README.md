# Генератор PDF та HTML протоколів для Пліч-о-пліч

CLI-інструмент для перетворення результатів з формату IOF XML 3.0 (експорт з MeOS) у PDF-протоколи та HTML-перегляд:

- Індивідуальний протокол (по класах)
- Командний протокол (окремо чоловіки та жінки)
- Естафетний протокол Пліч-о-пліч
- Протокол вибору Пліч-о-пліч
- Протокол результатів рогейну
- Протокол балів рогейну
- Протокол сплітів рогейну
- Військовий індивідуальний протокол
- Військовий протокол естафети
- Військовий загальнокомандний підсумок

Результати в протоколах розраховуються згідно правил національного проекту Пліч-о-пліч

За замовчуванням side-by-side PDF формується одним файлом: індивідуальні результати та командний підсумок в одному протоколі.

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
1. За потреби виберіть конкретний звіт: `iof-reports <results.xml> --report side-by-side-individual`, `--report team`, `--report side-by-side-relay`, `--report side-by-side-rogaining`, `--report rogaining`, `--report rogaining-awards`, `--report rogaining-diplomas`, `--report rogaining-score`, `--report rogaining-results`, `--report rogaining-splits`, `--report military-individual`, `--report military-relay` або `--report military-team`.
1. За потреби вкажіть інший файл конфігурації: `--config my-config.json`. За замовчуванням використовується `config.json` з поточної теки.
1. За потреби виберіть формат файлу: `--format pdf` або `--format docx`. DOCX наразі підтримується для `rogaining-awards`.
1. За потреби згенеруйте HTML-файл: `--html view` або `--html pdf`.
1. Для `rogaining-diplomas` за потреби увімкніть друк фону диплома через `--diploma-template on`. За замовчуванням `off`.

Доступні значення для `--report`: `all` (за замовчуванням), `side-by-side-individual`, `team`, `side-by-side-relay`, `side-by-side-rogaining`, `rogaining`, `rogaining-awards`, `rogaining-diplomas`, `rogaining-score`, `rogaining-results`, `rogaining-results-score`, `rogaining-splits`, `military-individual`, `military-relay`, `military-team`.
Доступні значення для `--html`: `none` (за замовчуванням), `view`, `pdf`.

Приклади:

- `iof-reports results.xml --report rogaining --html view` - створити `rogaining.html` для перегляду
- `iof-reports results.xml --report rogaining --html pdf` - створити `rogaining.pdf.html` для PDF-рендерингу
- `iof-reports results.xml --report rogaining-diplomas` - створити PDF для друку на готові дипломи
- `iof-reports results.xml --report rogaining-diplomas --diploma-template on` - створити дипломи разом із фоновим бланком у PDF
- `iof-reports results.xml --report rogaining-score` - створити протокол балів учасників рогейну
- `iof-reports results.xml --config championship-config.json --report rogaining-score` - створити протокол з іншим файлом конфігурації
- `iof-reports results.xml --report rogaining-results --baza baza.xml` - створити офіційний протокол результатів рогейну з розрахунком виконаних розрядів
- `iof-reports results.xml --report rogaining-splits --courses courses.xml` - створити протокол сплітів рогейну з відстанями між КП
- `iof-reports results.xml --report rogaining-awards --format docx` - створити редагований DOCX нагородного протоколу
- `iof-reports relay.xml --report side-by-side-relay --html view` - створити естафетний HTML-протокол Пліч-о-пліч
- `iof-reports choice.xml --report side-by-side-rogaining --html view` - створити HTML-протокол вибору Пліч-о-пліч
- `iof-reports long.xml --report military-individual --html view` - створити військовий індивідуальний HTML-протокол
- `iof-reports relay.xml --report military-relay --html view` - створити військовий протокол естафети
- `iof-reports long.xml --report military-team --relay relay.xml` - створити військовий загальнокомандний підсумок за довгою дистанцією та естафетою

Якщо є проблема з виводом кіриличних символів в консолі Windows, виконайте команду `chcp 65001` перед запуском додатку.

## Military протоколи

Для військових змагань доступні три типи протоколів:

- `military-individual` - індивідуальний протокол довгої дистанції з очками та командним підсумком у PDF
- `military-relay` - протокол естафети з очками, часами етапів та командним підсумком у PDF
- `military-team` - загальнокомандний підсумок, який об'єднує індивідуальні та естафетні очки

Індивідуальний military-протокол очікує звичайний IOF XML з індивідуальними результатами:

```bash
iof-reports results-long.xml --report military-individual --html view
```

Естафетний military-протокол очікує IOF XML з `TeamResult`:

```bash
iof-reports results-relay.xml --report military-relay --html view
```

Загальнокомандний military-протокол потребує два XML-файли: основний файл індивідуальної дистанції та файл естафети через `--relay`:

```bash
iof-reports results-long.xml --report military-team --relay results-relay.xml
```

Налаштування military-заліку знаходяться в `config.json` у секції `military`:

```json
{
  "military": {
    "teamFilterRegex": ".*",
    "classFilterRegex": ".*",
    "individualTeamGroups": [
      {
        "name": "ВВНЗ",
        "classRegex": "ВВНЗ"
      },
      {
        "name": "ЗСУ",
        "classRegex": "ЗСУ"
      }
    ]
  }
}
```

- `teamFilterRegex` - регулярний вираз для організацій, які беруть участь у нарахуванні очок. Місце в протоколі не змінюється. Якщо організація не проходить фільтр, очки не нараховуються.
- `classFilterRegex` - регулярний вираз для класів/груп, у яких нараховуються очки. Місце в протоколі не змінюється. Якщо клас не проходить фільтр, очки не нараховуються.
- `individualTeamGroups` - групи командного підсумку та порядок виводу класів у military-протоколах. `classRegex` визначає, до якої групи належить клас.

В індивідуальному military-протоколі очки для учасників рахуються тільки серед тих, хто проходить `teamFilterRegex` і `classFilterRegex`. Якщо перед учасником фінішували спортсмени поза фільтром, вони не впливають на позицію для підрахунку очок.

В естафеті очки приносить тільки перша команда від організації в межах тієї самої дистанції. Команди поза `teamFilterRegex` або `classFilterRegex` залишаються в протоколі, але не отримують очок. Якщо команда має не всі три етапи з часом, у протоколі вона отримує статус `DidNotFinish`, місце не ставиться, очки дорівнюють `0`.

Колонка `Відст.` в естафеті показує відставання за сумою етапів до поточного етапу. Наприклад, команда з двома етапами порівнюється з найкращою сумою перших двох етапів серед усіх команд цього класу.

## Watch режим

Якщо MeOS періодично вивантажує повний XML у директорію, можна запустити режим стеження:

```bash
iof-reports watch \
  --input-dir ./incoming \
  --output-dir ./out \
  --report side-by-side-individual \
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
- `--report side-by-side-individual` - індивідуальний протокол Пліч-о-пліч для live-перегляду; звіт коректно працює з XML без учасників
- `--report side-by-side-relay` - естафетний протокол Пліч-о-пліч з очками за шкалою side-by-side
- `--report side-by-side-rogaining` - протокол вибору Пліч-о-пліч; учасники зі статусом `OK` сортуються за часом, `MissingPunch` - нижче за кількістю взятих КП і часом
- `--diploma-template off|on` - чи вкладати фон диплома в `rogaining-diplomas`
- `--courses courses.xml` - файл `CourseData` для `rogaining-splits`
- `--baza baza.xml` - файл бази УФО для `rogaining-results`; з нього беруться поточні кваліфікації, дати народження, регіони та тренери
- `--config config.json` - файл конфігурації, за замовчуванням `config.json`

Після запуску відкривайте viewer через браузер:

- `http://127.0.0.1:4173/viewer` - viewer з автооновленням і автоскролом
- `http://127.0.0.1:4173/report` - поточний HTML-звіт
- `http://127.0.0.1:4173/meta` - метадані поточного звіту

У viewer-панелі доступні перемикачі для показу/приховування рядків і колонок. Для military relay корисні `Show participants` для колонки учасників і `Show Club` для колонки організації (`ВВНЗ, військо`).

Для локальної розробки:

```bash
npm run dev:watch -- --input-dir ./incoming --output-dir ./out --report rogaining --port 4173
```

## Конфігурація додатку

Змінні дані для формування протоколів налаштовуються в файлі `config.json`. Файл автоматично підхоплюється з поточної теки при наявності. [Приклад файлу](./config.json), який використовується за замовчуванням.

За потреби можна перевизначити верхній заголовок звіту через `reportHeader.title`. Поле підтримує HTML, наприклад `<br/>`.

Логотипи в PDF-заголовку можна перевизначити top-level полями `leftLogo` та `rightLogo`. Відносні шляхи рахуються відносно файлу конфігурації; порожній рядок означає стандартний логотип для відповідного типу звіту.

Налаштування звичайних протоколів Пліч-о-пліч знаходяться в секції `side-by-side`:

- `side-by-side.teamRules.menCount` - очікувана кількість чоловічих класів у командному протоколі
- `side-by-side.teamRules.womenCount` - очікувана кількість жіночих класів у командному протоколі

Для визначення гендерної належності класів використовуються налаштування `genderMapping`:

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

Формат таблиці регіонів у `rogaining-score` задається через `rogaining.scoreReport.regionTableLayout`:

- `groups` - поточний формат з I, II, III групами
- `flat` - одна таблиця регіонів у дві колонки та окрема колонка ФСТ/відомств

Для `flat` порядок регіонів можна перевизначити через `rogaining.scoreReport.flatRegions`.

## Вимоги до проекту

- Node.js 18+
- Playwright Chromium
- npm
