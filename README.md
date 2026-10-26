# Генератор PDF та HTML протоколів для Пліч-о-пліч

CLI-інструмент для перетворення результатів з формату IOF XML 3.0 (експорт з MeOS) у PDF-протоколи та HTML-перегляд:

- Індивідуальний протокол (по класах)
- Командний протокол за віковими групами 5-9 та 9-12 класів
- Естафетний протокол з налаштовуваним підрахунком балів
- Протокол вибору Пліч-о-пліч
- Індивідуальний підсумок за вибраними протоколами
- Загальнокомандний підсумок Пліч-о-пліч за вибраними протоколами
- Протокол результатів рогейну
- Протокол балів рогейну
- Протокол сплітів рогейну
- Військовий загальнокомандний підсумок

Результати в протоколах розраховуються згідно правил національного проекту Пліч-о-пліч

У командному заліку Пліч-о-пліч результати учнів та учениць рахуються разом у межах вікової групи Заходів:

- `5-9 класи` - 6 найкращих особистих результатів у кожній дисципліні та 3 найкращі естафетні команди
- `9-12 класи` - 4 найкращі особисті результати у кожній дисципліні та 2 найкращі естафетні команди
- естафетні бали дорівнюють балам за місце, помноженим на 2
- групи, які не відповідають жодній налаштованій віковій групі, залишаються в особистому протоколі, але ігноруються в командному підсумку
- за рівної суми порівнюється кількість перших, других та наступних місць серед зарахованих результатів; за повної рівності команди мають однакове місце

За замовчуванням індивідуальний протокол використовує scoring `regular`: `1000 × час лідера класу / час учасника`, з математичним округленням до цілого. Командний підсумок у цьому режимі не формується.

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
1. За потреби виберіть конкретний звіт: `iof-reports <results.xml> --report individual`, `--report individual-rogaining`, `--report team`, `--report relay`, `--report side-by-side-rogaining`, `--report summary`, `--report summary-team`, `--report rogaining`, `--report rogaining-diplomas`, `--report rogaining-score`, `--report rogaining-results` або `--report rogaining-splits`.
1. За потреби вкажіть інший файл конфігурації: `--config my-config.json`. За замовчуванням використовується `config.json` з поточної теки.
1. За потреби виберіть формат файлу: `--format pdf`.
1. Для нагородного PDF-протоколу додайте `--awards`: він використовує той самий PDF-шаблон, додає підзаголовок `Нагородний` і залишає тільки 1-3 місця.
1. За потреби згенеруйте HTML-файл: `--html view` або `--html pdf`.
1. Для `rogaining-diplomas` за потреби увімкніть друк фону диплома через `--diploma-template on`. За замовчуванням `off`.

Доступні значення для `--report`: `all` (за замовчуванням), `individual`, `individual-rogaining`, `team`, `relay`, `side-by-side-rogaining`, `summary`, `summary-team`, `rogaining`, `rogaining-diplomas`, `rogaining-score`, `rogaining-results`, `rogaining-results-score`, `rogaining-splits`.
Доступні значення для `--html`: `none` (за замовчуванням), `view`, `pdf`.

Приклади:

- `iof-reports results.xml --report rogaining --html view` - створити `rogaining.html` для перегляду
- `iof-reports results.xml --report rogaining --html pdf` - створити `rogaining.pdf.html` для PDF-рендерингу
- `iof-reports results.xml --report rogaining --awards` - створити `rogaining-awards.pdf` з першими трьома місцями
- `iof-reports results.xml --report rogaining-diplomas` - створити PDF для друку на готові дипломи
- `iof-reports results.xml --report rogaining-diplomas --diploma-template on` - створити дипломи разом із фоновим бланком у PDF
- `iof-reports results.xml --report rogaining-score` - створити протокол балів учасників рогейну
- `iof-reports results.xml --config championship-config.json --report rogaining-score` - створити протокол з іншим файлом конфігурації
- `iof-reports results.xml --report rogaining-results --baza baza.xml` - створити офіційний протокол результатів рогейну з розрахунком виконаних розрядів
- `iof-reports results.xml --report rogaining-splits --courses courses.xml` - створити протокол сплітів рогейну з відстанями між КП
- `iof-reports results.xml --report individual-rogaining` - створити індивідуальний протокол рогейну з балами та штрафами з XML
- `iof-reports relay.xml --report relay --config config-relay-side-by-side.json --html view` - створити естафетний HTML-протокол Пліч-о-пліч
- `iof-reports choice.xml --report side-by-side-rogaining --html view` - створити HTML-протокол вибору Пліч-о-пліч
- `iof-reports --report summary --config config-summary.json` - створити індивідуальний підсумок за серіями з конфігурації
- `iof-reports --report summary-team --config config-summary-team-side-by-side.json --series individual=long.xml --series rogaining=choice.xml --series relay=relay.xml` - створити загальнокомандний підсумок Пліч-о-пліч
- `iof-reports long.xml --report individual --config config-individual-military.json --html view` - створити індивідуальний HTML-протокол з military-нарахуванням балів
- `iof-reports relay.xml --report relay --config config-relay-military.json --html view` - створити військовий протокол естафети
- `iof-reports --report summary-team --config config-summary-team-military.json --series individual=long.xml --series relay=relay.xml` - створити військовий загальнокомандний підсумок

Якщо є проблема з виводом кіриличних символів в консолі Windows, виконайте команду `chcp 65001` перед запуском додатку.

## Друк призерів на готових дипломах

Прапорець `--diplomas` формує написи для готових бланків із призерів вибраного `--report`:

```bash
iof-reports results.xml --report individual --diplomas --config config.json
iof-reports choice.xml --report side-by-side-rogaining --diplomas --config config.json
iof-reports relay.xml --report relay --diplomas --config config.json
iof-reports results.xml --report team --diplomas --config config.json
iof-reports --report summary --diplomas --config config.json
iof-reports --report summary-team --diplomas --config config.json
```

Для `summary` і `summary-team` джерела задаються, як звичайно, через `--series` або відповідну секцію `series` у конфігурації. Інші типи протоколів також підтримують `--diplomas` зі своїми звичайними додатковими XML-файлами (`--baza`, `--courses`). Без `--report` джерелом є `individual`.

Результат записується в `<report>-diplomas.pdf`, наприклад `individual-diplomas.pdf`, у поточній папці. Кожен диплом займає окремий аркуш. Відбираються місця 1–3 у кожній групі, включно зі спільними призовими місцями; використовується ранжування відповідного протоколу. Фон вимкнений. Друкуйте з масштабом **100% / «Фактичний розмір»**, без припасування до сторінки.

За замовчуванням друкуються ПІБ, група та місце шрифтом **Shantell Sans**, який входить до ресурсів проєкту та працює без інтернету. Назва команди або організації вимкнена; для друку ввімкніть `diplomas.fields.teamName.enabled: true`. Для естафети й командного рогейну `teamMode: "members"` створює диплом кожному учаснику, а `"team"` — один на команду з порожнім ПІБ. Для `team` і `summary-team` створюється один диплом на організацію в кожній групі; її назва виводиться в полі `teamName`, тому для цих дипломів увімкніть це поле. Додаткові командні таблиці всередині індивідуального чи естафетного протоколу не додаються до дипломів: для організацій використовуйте `team` або `summary-team`.

Додайте до свого `config.json` секцію `diplomas`. Повний приклад із координатами всіх полів: [config-diplomas.json](config-diplomas.json). Можна змінювати лише потрібні параметри:

```json
{
  "diplomas": {
    "page": { "width": 210, "height": 297 },
    "fontFamily": "Shantell Sans",
    "color": "#1f2c27",
    "teamMode": "members",
    "fields": {
      "participantName": { "x": 16, "y": 84, "width": 178, "height": 9, "fontSize": 20 },
      "teamName": { "enabled": false, "x": 53, "y": 98, "width": 144, "height": 9, "fontSize": 18 },
      "place": { "x": 29, "y": 113, "width": 25, "height": 8, "fontSize": 20 },
      "className": { "x": 132, "y": 113, "width": 48, "height": 8, "fontSize": 16 }
    }
  }
}
```

Кожне поле (`participantName` — ПІБ, `teamName` — команда або організація, `place` — місце, `className` — група) має власні незалежні координати й перемикач `enabled`. `x` і `y` — відступи від лівого та верхнього краю аркуша в **міліметрах**. `width`, `height` та розмір аркуша також у міліметрах, `fontSize` — у пунктах. Доступні `fontWeight` (1–1000), `align` (`left`, `center`, `right`) для кожного поля. Невказані параметри успадковують значення за замовчуванням; увімкнені поля мають уміщатися в аркуш. Для горизонтального A4 задайте `width: 297, height: 210`.

`--html pdf` додатково зберігає HTML для перевірки розміщення. У режимі `watch` теж доступний `--diplomas`. Старий `--report rogaining-diplomas` залишається сумісним і використовує ту саму секцію `diplomas`. Опція `--diploma-template on` додає наявний фоновий бланк рогейну; для готових дипломів залишайте її вимкненою. `--awards` без `--diplomas` і надалі формує нагородний протокол.

## Індивідуальний підсумок

`summary` формує PDF індивідуального підсумку по учасниках за вибраними індивідуальними дистанціями. Бали кожної дистанції рахуються через поточний `individual.scoring` з конфігурації, так само як у звіті `individual`.

`summary.matchBy` визначає зіставлення між днями: `"name-and-organisation"` (за замовчуванням) — за ПІБ та організацією, `"name"` — лише за ПІБ. Наприклад, `"summary": { "matchBy": "name" }` об'єднає бали учасника, якщо в іншому дні змінилася команда або клуб не вказаний. В обох режимах результати різних груп рахуються окремо. Для відображення зберігається перша відома організація в порядку джерел: порожнє значення, `Unknown` (без урахування регістру) та `Немає клубу` її не замінюють. Якщо перші дні містять лише такі значення, береться клуб із першого наступного дня, де він указаний. Це налаштування також застосовується до дипломів підсумку.

Серії задаються в конфігурації. Шляхи `path` рахуються відносно файлу конфігурації, а `label` задає назву колонки:

```json
{
  "individual": {
    "scoring": "regular"
  },
  "summary": {
    "series": [
      {
        "type": "individual",
        "path": "d1/results.xml",
        "label": "День 1"
      },
      {
        "type": "individual",
        "path": "d2/results.xml",
        "label": "День 2"
      }
    ]
  }
}
```

Після цього достатньо запустити:

```bash
iof-reports --report summary --config config-summary.json
```

Також можна передати серії через CLI:

```bash
iof-reports --report summary --config config-summary.json \
  --series individual=d1/results.xml \
  --series individual=d2/results.xml
```

Якщо одночасно передати `--series`, CLI-серії мають пріоритет над `summary.series` з конфігурації.

## Командний підсумок

`summary-team` формує PDF командного підсумку з командних результатів вибраних звітів. Джерела та порядок колонок задаються повторюваним `--series type=file.xml`:

```bash
iof-reports --report summary-team \
  --config config-summary-team-side-by-side.json \
  --series individual=long.xml \
  --series rogaining=choice.xml \
  --series relay=relay.xml
```

Підтримуються джерела `individual`, `side-by-side-rogaining` (`rogaining` або `choice` як короткі alias-и) та `relay`. Кожне джерело використовує власні scoring і `teamResults` з config. `summaryTeam.layout` визначає плоский (`flat`) або згрупований (`grouped`) підсумок.

Серії також можна задати в конфігурації. У цьому випадку шляхи `path` рахуються відносно файлу конфігурації, а `label` задає назву колонки:

```json
{
  "summaryTeam": {
    "series": [
      {
        "type": "individual",
        "path": "d1/results.xml",
        "label": "День 1"
      },
      {
        "type": "individual",
        "path": "d2/results.xml",
        "label": "День 2"
      }
    ]
  }
}
```

Після цього достатньо запустити:

```bash
iof-reports --report summary-team --config config-summary-team-side-by-side.json
```

Якщо одночасно передати `--series`, CLI-серії мають пріоритет над `summaryTeam.series` з конфігурації.

## Military протоколи

Для військових змагань індивідуальний протокол формується через `--report individual` з `individual.scoring: "military"` у конфігурації. Естафета формується через спільний `--report relay` з `relay.scoring: "military"`.

- `relay` - протокол естафети; спосіб підрахунку та командний підсумок задаються в секції `relay`
- `summary-team` з military-конфігом - загальнокомандний підсумок, який об'єднує індивідуальні та естафетні очки

Індивідуальний military-протокол очікує звичайний IOF XML з індивідуальними результатами:

```bash
iof-reports results-long.xml --report individual --config config-individual-military.json --html view
```

Естафетний military-протокол очікує IOF XML з `TeamResult`:

```bash
iof-reports results-relay.xml --report relay --config config-relay-military.json --html view
```

Загальнокомандний military-протокол приймає обидва XML-файли через `--series`:

```bash
iof-reports --report summary-team --config config-summary-team-military.json \
  --series individual=results-long.xml \
  --series relay=results-relay.xml
```

Тип нарахування балів для індивідуального протоколу вибирається в `config.json` у секції `individual`. Доступні значення: `regular`, `side-by-side` та `military`.

Готові приклади конфігів:

- `config-individual-regular.json` - scoring за часом лідера, без командного підсумку
- `config-individual-side-by-side.json` - вигляд і підрахунок Пліч-о-пліч, близький до старого `side-by-side-individual`
- `config-individual-military.json` - військовий вигляд і grouped-командний підсумок, близький до старого `military-individual`
- `config-relay-side-by-side.json` - підрахунок і командний підсумок Пліч-о-пліч за віковими групами
- `config-relay-military.json` - військовий підрахунок і grouped-командний підсумок
- `config-summary-team-side-by-side.json` - командний підсумок Пліч-о-пліч за віковими групами
- `config-summary-team-military.json` - grouped військовий командний підсумок

```bash
iof-reports results.xml --report individual --config config-individual-regular.json
iof-reports results.xml --report individual --config config-individual-side-by-side.json
iof-reports results.xml --report individual --config config-individual-military.json
iof-reports relay.xml --report relay --config config-relay-side-by-side.json
iof-reports relay.xml --report relay --config config-relay-military.json
iof-reports --report summary-team --config config-summary-team-side-by-side.json --series individual=long.xml --series relay=relay.xml
iof-reports --report summary-team --config config-summary-team-military.json --series individual=long.xml --series relay=relay.xml
```

Приклад military-конфігурації:

```json
{
  "individual": {
    "scoring": "military",
    "classOrder": "grouped",
    "teamResults": "grouped",
    "teamFilterRegex": ".*",
    "classFilterRegex": ".*",
    "classOrderGroups": [
      {
        "name": "ВВНЗ",
        "classRegex": "ВВНЗ"
      },
      {
        "name": "ЗСУ",
        "classRegex": "ЗСУ"
      }
    ],
    "reportTitle": "Довга дистанція",
    "title": "Відкритий Кубок Командувача Сухопутних військ ЗСУ<br/>зі спортивного орієнтування (бігом)"
  },
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

- `individual.scoring` - alias scoring-файлу з `src/scoring`: `regular`, `side-by-side` або `military`.
- `relay.scoring` - alias scoring-файлу естафети: `side-by-side` або `military`.
- `relay.teamResults` - формат командного підсумку: `none`, `flat` або `grouped`.
- `summary.reportTitle`, `summary.title`, `summary.subtitle`, `summary.sourceLabels`, `summary.series`, `summary.showZeroPoints` - заголовок, назви колонок, джерела та показ нульових балів для індивідуального підсумку.
- `summaryTeam.layout` - формат сумарного командного звіту: `flat` або `grouped`.
- `summaryTeam.tieBreak` - правило розв'язання рівності: `source-order` або `counted-places`; для Пліч-о-пліч використовується `counted-places`.
- `summaryTeam.groupOrder`, `summaryTeam.sourceLabels`, `summaryTeam.reportTitle`, `summaryTeam.title`, `summaryTeam.subtitle` - порядок груп, назви колонок та заголовок сумарного звіту.
- `summaryTeam.series` - список джерел для `summary-team` у форматі `{ "type": "individual", "path": "d1/results.xml", "label": "День 1" }`; `path` відносний до файлу конфігурації, `label` необов'язковий.
- Для всіх `relay.scoring` використовується одна live-логіка статусів, місць і незавершених етапів.
- `individual.classOrder` - порядок класів: `name` за назвою або `grouped` за `individual.classOrderGroups`.
- `individual.teamResults` - тип командного підсумку в PDF: `none`, `gender`, `grouped` або `side-by-side`.
- `individual.teamFilterRegex`, `individual.classFilterRegex` - фільтри для grouped-заліку в індивідуальному протоколі.
- `individual.filterParticipants: true` - показувати в індивідуальному HTML і PDF тільки учасників, які проходять обидва фільтри. За замовчуванням `false`.
- `individual.teamResultLimits` - квоти для grouped-командного заліку за класами. Наприклад, `[{"classRegex":"^Ч21[АA]$","count":4},{"classRegex":"^Ж21[АA]$","count":2}]` зараховує кожній організації чотири найкращі чоловічі та два найкращі жіночі результати в спільну суму. Квоти не заповнюються учасниками з інших класів; за відсутності квот враховуються всі результати.
- `individual.classOrderGroups` - групи для порядку класів і grouped-командного підсумку індивідуального протоколу.
- `individual.reportTitle`, `individual.title`, `individual.subtitle` - тексти заголовка індивідуального протоколу. У `title` та `subtitle` підтримуються плейсхолдери `{{stage}}`, `{{region_of}}`, `{{year}}`.
- `rogaining.reportTitle` - назва рогейнового протоколу, використовується для `rogaining` та `individual-rogaining`.
- `awards.classOrder` - порядок класів у нагородному режимі `--awards`. Класи, яких немає у списку, виводяться після заданих у звичайному порядку.
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
  --report individual \
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
- `--report individual` - індивідуальний протокол для live-перегляду; тип нарахування балів задається через `individual.scoring`, звіт коректно працює з XML без учасників
- `--report relay` - естафетний протокол для live-перегляду; тип нарахування балів задається через `relay.scoring`
- `--report side-by-side-rogaining` - протокол вибору Пліч-о-пліч; учасники зі статусом `OK` сортуються за часом, `MissingPunch` - нижче за кількістю взятих КП і часом
- `--report individual-rogaining` - індивідуальний протокол рогейну; показує бал до штрафу, штраф і підсумковий бал з XML, учасники зі статусом `OK` сортуються за підсумковим балом, потім за часом
- `--awards` - нагородний режим для PDF-протоколу; додає підзаголовок `Нагородний` і залишає 1-3 місця
- `--diplomas` - написи призерів для готових дипломів із вибраного протоколу; координати задаються в `diplomas.fields`
- `--diploma-template off|on` - чи вкладати наявний фон рогейну в дипломи
- `--courses courses.xml` - файл `CourseData` для `rogaining-splits`
- `--baza baza.xml` - файл бази УФО для `rogaining-results`; з нього беруться поточні кваліфікації, дати народження, регіони та тренери

Для `individual-rogaining` можна налаштувати статус за перевищення часу:

```json
{
  "rogaining": {
    "controlTime": "12:00:00",
    "allowedOvertime": "00:30:00"
  }
}
```

Якщо час учасника зі статусом `OK` більший за `controlTime + allowedOvertime`, він отримає статус `Перевищено час` без місця. Для нього `Бал` показує всі зібрані бали, `Штраф` дорівнює всім зібраним балам, а `Разом` дорівнює нулю. Обидва значення задаються у форматі `чч:мм:сс`; години можуть бути більшими за 23. Якщо одне з налаштувань відсутнє, правило вимкнене.

Для нагородного протоколу можна задати порядок класів:

```json
{
  "awards": {
    "classOrder": ["Ч55", "Ж45", "Ж18", "Ч18", "Ж", "Ч"]
  }
}
```

- `--config config.json` - файл конфігурації, за замовчуванням `config.json`

Після запуску відкривайте viewer через браузер:

- `http://127.0.0.1:4173/viewer` - viewer з автооновленням і автоскролом
- `http://127.0.0.1:4173/report` - поточний HTML-звіт
- `http://127.0.0.1:4173/meta` - метадані поточного звіту

У viewer-панелі доступні перемикачі для показу/приховування рядків і колонок. Для `relay.scoring: "military"` корисні `Show participants` для колонки учасників і `Show Club` для колонки організації (`ВВНЗ, військо`).

Для локальної розробки:

```bash
npm run dev:watch -- --input-dir ./incoming --output-dir ./out --report rogaining --port 4173
```

## Конфігурація додатку

Змінні дані для формування протоколів налаштовуються в файлі `config.json`. Файл автоматично підхоплюється з поточної теки при наявності. [Приклад файлу](./config.json), який використовується за замовчуванням.

За потреби можна перевизначити верхній заголовок звіту через `reportHeader.title`. Поле підтримує HTML, наприклад `<br/>`.

Логотипи в PDF-заголовку можна перевизначити top-level полями `leftLogo` та `rightLogo`. Відносні шляхи рахуються відносно файлу конфігурації; порожній рядок означає стандартний логотип для відповідного типу звіту.

Налаштування протоколів Пліч-о-пліч знаходяться в секції `side-by-side`:

- `side-by-side.ageGroups` - вікові групи командного заліку; для кожної задаються `name`, `classRegex`, `individualResultCount` і `relayResultCount`
- `side-by-side.relayCoefficient` - коефіцієнт балів естафетної команди, за правилами 2026 року дорівнює `2`

Стандартні правила зіставляють `Ч 5-6`, `Ж 5-6`, `Ч 7-8`, `Ж 7-8`, `Ч 9`, `Ж 9` з групою `5-9 класи`, а `Ч 9-10`, `Ж 9-10`, `Ч 11-12`, `Ж 11-12` - з групою `9-12 класи`. Пробіл після `Ч` або `Ж` необов'язковий.

Для визначення гендерної належності класів використовуються налаштування `genderMapping`:

- `womenPrefixes`
- `mixPrefixes`
- `menPrefixes`

Бали для `rogaining-score` налаштовуються в `rogaining.scorePoints`:

- `youthUnder18` - юнаки/дівчата до 18 років включно
- `youthUnder23` - молодь старше 18 і до 23 років включно
- `adult` - дорослі класи
- `masters` - ветеранські класи 45+ і старші

Режим формування класів для `rogaining-score` і `rogaining-results-score` задається через `rogaining.scoreClassMode`:

- `promoted` (за замовчуванням) - результати також підтягуються у доступні вищі та відкриті класи
- `declared` - бали нараховуються тільки в заявленому класі

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
