import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { setConfigPath } from "../config";
import { Participant } from "../io/parse-iof";
import {
  buildIndividualRogainingClasses,
  buildIndividualRogainingHtml,
} from "./individual-rogaining-report";

afterEach(() => {
  setConfigPath(undefined);
});

function makeParticipant(
  name: string,
  resultScore: number,
  timeSec: number,
  status = "OK",
  resultPenalty = 0,
): Participant {
  return {
    className: "Ч",
    name,
    club: "Команда",
    timeSec,
    position: 99,
    status,
    points: 999,
    resultScore,
    resultPenalty,
  };
}

describe("buildIndividualRogainingClasses", () => {
  it("ranks OK participants by XML score and then by time", () => {
    const classes = buildIndividualRogainingClasses([
      makeParticipant("Менше балів", 30, 800),
      makeParticipant("Повільніший", 40, 1000),
      makeParticipant("Швидший", 40, 900),
      makeParticipant("Не фінішував", 50, 700, "Active"),
    ]);

    expect(classes[0].participants).toEqual([
      {
        position: "1",
        name: "Швидший",
        time: "15:00",
        score: 40,
        penalty: 0,
        totalScore: 40,
        status: "OK",
      },
      {
        position: "2",
        name: "Повільніший",
        time: "16:40",
        score: 40,
        penalty: 0,
        totalScore: 40,
        status: "OK",
      },
      {
        position: "3",
        name: "Менше балів",
        time: "13:20",
        score: 30,
        penalty: 0,
        totalScore: 30,
        status: "OK",
      },
      {
        position: "",
        name: "Не фінішував",
        time: "11:40",
        score: 50,
        penalty: 0,
        totalScore: 50,
        status: "Active",
      },
    ]);
  });

  it("removes the place when the configured maximum time is exceeded", () => {
    setConfigPath(
      path.resolve(__dirname, "../__fixtures__/individual-rogaining-time-limit-config.json"),
    );

    const classes = buildIndividualRogainingClasses([
      makeParticipant("На межі", 30, 4200),
      makeParticipant("Перевищив", 40, 4201),
    ]);

    expect(classes[0].participants).toMatchObject([
      {
        position: "1",
        name: "На межі",
        status: "OK",
      },
      {
        position: "",
        name: "Перевищив",
        score: 40,
        penalty: 40,
        totalScore: 0,
        status: "OverTime",
      },
    ]);
  });

  it("reports invalid configured time format", () => {
    setConfigPath(
      path.resolve(
        __dirname,
        "../__fixtures__/individual-rogaining-invalid-time-limit-config.json",
      ),
    );

    expect(() =>
      buildIndividualRogainingClasses([makeParticipant("Учасник", 30, 3600)]),
    ).toThrow('Invalid rogaining.controlTime "1:00". Expected чч:мм:сс.');
  });

  it("renders collected score as the full penalty for overtime participants", () => {
    setConfigPath(
      path.resolve(__dirname, "../__fixtures__/individual-rogaining-time-limit-config.json"),
    );

    const html = buildIndividualRogainingHtml(
      [makeParticipant("Перевищив", 35, 4201, "OK", 5)],
      new Date(2026, 3, 11),
      "view",
    );

    expect(html).toMatch(
      /Перевищив[\s\S]*<td>40<\/td>\s*<td><strong>40<\/strong><\/td>\s*<td><strong>0<\/strong><\/td>[\s\S]*Перевищено час/,
    );
  });
});

describe("buildIndividualRogainingHtml", () => {
  it("renders only individual rogaining result columns without team results", () => {
    const html = buildIndividualRogainingHtml(
      [makeParticipant("Учасник", 42, 3600, "OK", 3)],
      new Date(2026, 3, 11),
      "pdf",
    );

    expect(html).toContain("<th>Учасник</th>");
    expect(html).toContain("<th>Час</th>");
    expect(html).toContain('<th class="points-cell">Бал</th>');
    expect(html).toContain('<th class="points-cell">Штраф</th>');
    expect(html).toContain('<th class="points-cell">Разом</th>');
    expect(html).toContain('<td class="points-cell">45</td>');
    expect(html).toContain('<td class="points-cell"><strong>3</strong></td>');
    expect(html).toContain('<td class="points-cell"><strong>42</strong></td>');
    expect(html).toMatch(
      /<th class="points-cell">Бал<\/th>\s*<th class="points-cell">Штраф<\/th>\s*<th class="points-cell">Разом<\/th>\s*<th>Час<\/th>\s*<th>Статус<\/th>/,
    );
    expect(html).not.toContain("<th>Команда</th>");
    expect(html).not.toContain("<th>Кількість КП</th>");
    expect(html).not.toContain("<th>Відст.</th>");
    expect(html).not.toContain("Командні результати");
    expect(html).not.toContain(">999<");
  });
});
