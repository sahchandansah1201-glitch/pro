import { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CLINICS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/**
 * /bot-sim — симулятор Telegram-подобного бота для пред-триажа.
 * Локальная демонстрация воронки: фото → quality gate → безопасная
 * рекомендация → CTA. Без реального Telegram API, без загрузки файлов,
 * без сети, без записи данных, без PHI.
 */

type Routing = "low" | "moderate" | "high" | "urgent";
type CtaType = "book" | "urgent" | "repeat_photo";

type Scenario = {
  id: string;
  label: string;
  score: number;
  passed: boolean;
  issues: string[];
  routing: Routing;
  cta: CtaType;
  safeSummary: string;
  recommendedClinicId: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: "sc-good-moderate",
    label: "Хорошее фото · умеренный маршрут",
    score: 0.86,
    passed: true,
    issues: [],
    routing: "moderate",
    cta: "book",
    safeSummary:
      "Фото пригодно для предварительной оценки. Рекомендуется очный осмотр дерматолога в плановом порядке.",
    recommendedClinicId: CLINICS[0].id,
  },
  {
    id: "sc-poor-repeat",
    label: "Плохое фото · нужно повторить",
    score: 0.42,
    passed: false,
    issues: ["размытость", "блики", "недостаточный масштаб"],
    routing: "low",
    cta: "repeat_photo",
    safeSummary:
      "Фото не подходит для предварительной оценки. Сделайте новое фото по инструкции.",
    recommendedClinicId: CLINICS[0].id,
  },
  {
    id: "sc-good-urgent",
    label: "Приоритетный маршрут",
    score: 0.81,
    passed: true,
    issues: [],
    routing: "urgent",
    cta: "urgent",
    safeSummary:
      "Признаки требуют срочной очной оценки врача. Это не диагноз, но откладывать визит не следует.",
    recommendedClinicId: CLINICS[1].id,
  },
];

const ROUTING_LABEL: Record<Routing, string> = {
  low: "Плановая запись",
  moderate: "Рекомендуется запись",
  high: "Приоритетная запись",
  urgent: "Срочная очная оценка",
};

const CTA_LABEL: Record<CtaType, string> = {
  book: "Записаться в клинику",
  urgent: "Связаться с клиникой",
  repeat_photo: "Повторить фото",
};

type Step = "start" | "instruction" | "quality" | "recommendation" | "done";

type Bubble = {
  id: string;
  side: "bot" | "user";
  text: string;
};

const SAFETY_LINES = [
  "Предварительная оценка не является диагнозом.",
  "Окончательное решение принимает врач.",
  "При тревожных симптомах обратитесь в клинику очно.",
];

export default function BotSimPage() {
  const [step, setStep] = useState<Step>("start");
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [ctaStatus, setCtaStatus] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: "b-0",
      side: "bot",
      text:
        "Здравствуйте. Я помогу подготовить фото образования для предварительной оценки. Это не диагноз.",
    },
  ]);

  const idRef = useRef(1);
  const nextId = () => `b-${idRef.current++}`;
  const push = (b: Omit<Bubble, "id">) =>
    setBubbles((prev) => [...prev, { ...b, id: nextId() }]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [bubbles]);

  const recommendedClinic = useMemo(
    () =>
      scenario
        ? CLINICS.find((c) => c.id === scenario.recommendedClinicId) ?? CLINICS[0]
        : CLINICS[0],
    [scenario],
  );

  function handleNewAnalysis() {
    push({ side: "user", text: "Новый анализ" });
    push({
      side: "bot",
      text:
        "Хорошо. Сначала короткая инструкция по фото. Это нужно, чтобы оценка была корректной.",
    });
    setStep("instruction");
    setCtaStatus(null);
    setScenario(null);
  }

  function handleInstruction() {
    push({ side: "user", text: "Инструкция" });
    push({
      side: "bot",
      text:
        "Фото должно быть: при хорошем освещении, в фокусе, с понятным масштабом, без бликов. Если есть дерматоскоп — добавьте дерматоскопическое фото.",
    });
    setStep("instruction");
  }

  function handleWhy() {
    push({ side: "user", text: "Зачем это" });
    push({
      side: "bot",
      text:
        "Предварительная оценка помогает выбрать срочность визита. Это не диагноз. Окончательное решение принимает врач.",
    });
  }

  function handleHelp() {
    push({ side: "user", text: "Помощь" });
    push({
      side: "bot",
      text:
        "Если что-то беспокоит, напишите оператору в клинику или запишитесь на приём.",
    });
  }

  function handleSimulatePhoto() {
    const sc = SCENARIOS[scenarioIdx % SCENARIOS.length];
    setScenarioIdx((i) => i + 1);
    setScenario(sc);
    push({ side: "user", text: "📷 [симулированное фото]" });
    push({
      side: "bot",
      text: sc.passed
        ? `Фото принято. Оценка качества: ${(sc.score * 100).toFixed(0)}%.`
        : `Фото не прошло проверку качества: ${sc.issues.join(", ")}.`,
    });
    setStep("quality");
  }

  function handleShowRecommendation() {
    if (!scenario) return;
    push({ side: "bot", text: scenario.safeSummary });
    push({
      side: "bot",
      text: `Маршрут: ${ROUTING_LABEL[scenario.routing]}. Демо-ссылка анализа будет создана на этапе бэкенда.`,
    });
    setStep("recommendation");
  }

  function handleCta() {
    if (!scenario) return;
    if (scenario.cta === "repeat_photo") {
      push({ side: "user", text: CTA_LABEL.repeat_photo });
      push({
        side: "bot",
        text: "Хорошо, вернёмся к инструкции. Сделайте, пожалуйста, новое фото.",
      });
      setStep("instruction");
      setCtaStatus(null);
      setScenario(null);
      return;
    }
    push({ side: "user", text: CTA_LABEL[scenario.cta] });
    setCtaStatus(
      "Демо: лид подготовлен для оператора. В следующем шаге откроется Mini App записи.",
    );
    setStep("done");
  }

  const showQuickRow = step !== "recommendation";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 lg:flex-row">
      {/* Phone frame */}
      <div className="flex justify-center lg:flex-1">
        <div
          className="flex w-full max-w-[390px] flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-sm"
          style={{ minHeight: 640 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-medium">Дерматолог Про Bot</span>
              <span className="text-[11px] text-muted-foreground">симуляция</span>
            </div>
            <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
              demo
            </span>
          </div>

          {/* Chat */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-2 overflow-y-auto bg-background px-3 py-3"
            style={{ maxHeight: 460 }}
          >
            {bubbles.map((b) => (
              <div
                key={b.id}
                className={cn(
                  "flex",
                  b.side === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-snug",
                    b.side === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {b.text}
                </div>
              </div>
            ))}

            {step === "quality" && scenario && (
              <Card className="space-y-1 p-3 text-[12px]">
                <div className="font-medium">Проверка качества</div>
                <div>Оценка: {(scenario.score * 100).toFixed(0)}%</div>
                <div>
                  Статус: {scenario.passed ? "пригодно" : "требуется повтор"}
                </div>
                {scenario.issues.length > 0 && (
                  <div>Замечания: {scenario.issues.join(", ")}</div>
                )}
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  style={{ minHeight: 44 }}
                  onClick={handleShowRecommendation}
                >
                  Показать рекомендацию
                </Button>
              </Card>
            )}

            {step === "recommendation" && scenario && (
              <Card className="space-y-2 p-3 text-[12px]">
                <div className="font-medium">Безопасная рекомендация</div>
                <div>Качество фото: {(scenario.score * 100).toFixed(0)}%</div>
                {scenario.issues.length > 0 && (
                  <div>Замечания: {scenario.issues.join(", ")}</div>
                )}
                <div>{scenario.safeSummary}</div>
                <div>
                  <span className="text-muted-foreground">Маршрут: </span>
                  {ROUTING_LABEL[scenario.routing]}
                </div>
                <div className="text-muted-foreground">
                  Демо-ссылка анализа будет создана на этапе бэкенда.
                </div>
                <Button
                  className="mt-1 w-full"
                  style={{ minHeight: 44 }}
                  onClick={handleCta}
                >
                  {CTA_LABEL[scenario.cta]}
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                  style={{ minHeight: 44 }}
                >
                  <Link to="/bot-sim/miniapp/booking">Открыть Mini App записи</Link>
                </Button>
              </Card>
            )}

            {ctaStatus && (
              <div className="rounded-md border border-border bg-muted/40 p-2 text-[12px] text-muted-foreground">
                {ctaStatus}
              </div>
            )}

            <div className="pt-2 text-[11px] text-muted-foreground">
              {SAFETY_LINES.map((l) => (
                <div key={l}>· {l}</div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="border-t border-border bg-muted/30 p-2">
            {step === "start" && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  style={{ minHeight: 44 }}
                  onClick={handleNewAnalysis}
                >
                  Новый анализ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  style={{ minHeight: 44 }}
                  onClick={handleInstruction}
                >
                  Инструкция
                </Button>
              </div>
            )}

            {step === "instruction" && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  style={{ minHeight: 44 }}
                  onClick={handleSimulatePhoto}
                >
                  Сымитировать отправку фото
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  style={{ minHeight: 44 }}
                  onClick={handleInstruction}
                >
                  Повторить инструкцию
                </Button>
              </div>
            )}

            {(step === "quality" || step === "done") && showQuickRow && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  style={{ minHeight: 44 }}
                  onClick={handleNewAnalysis}
                >
                  Новый анализ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  style={{ minHeight: 44 }}
                  onClick={handleHelp}
                >
                  Помощь
                </Button>
              </div>
            )}

            <div className="mt-2 grid grid-cols-4 gap-1 text-[11px]">
              <button
                type="button"
                className="rounded border border-border bg-background py-1"
                style={{ minHeight: 44 }}
                onClick={handleNewAnalysis}
              >
                Новый
              </button>
              <button
                type="button"
                className="rounded border border-border bg-background py-1"
                style={{ minHeight: 44 }}
                onClick={handleInstruction}
              >
                Инструкция
              </button>
              <button
                type="button"
                className="rounded border border-border bg-background py-1"
                style={{ minHeight: 44 }}
                onClick={handleWhy}
              >
                Зачем
              </button>
              <button
                type="button"
                className="rounded border border-border bg-background py-1"
                style={{ minHeight: 44 }}
                onClick={handleHelp}
              >
                Помощь
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Demo / operator panel */}
      <DemoPanel
        step={step}
        scenario={scenario}
        recommendedClinic={recommendedClinic}
        ctaStatus={ctaStatus}
      />
    </div>
  );
}

function DemoPanel({
  step,
  scenario,
  recommendedClinic,
  ctaStatus,
}: {
  step: Step;
  scenario: Scenario | null;
  recommendedClinic: { id: string; name: string; address: string };
  ctaStatus: string | null;
}) {
  const content = (
    <div className="space-y-2 text-[12px]">
      <div>
        <span className="text-muted-foreground">Состояние диалога: </span>
        {step}
      </div>
      <div>
        <span className="text-muted-foreground">Источник: </span>
        telegram-sim
      </div>
      <div>
        <span className="text-muted-foreground">Маршрут риска: </span>
        {scenario ? ROUTING_LABEL[scenario.routing] : "—"}
      </div>
      <div>
        <span className="text-muted-foreground">Лид (локально): </span>
        {ctaStatus ? "подготовлен" : "не создан"}
      </div>
      <div>
        <span className="text-muted-foreground">Рекомендуемая клиника: </span>
        <div>{recommendedClinic.name}</div>
        <div className="text-muted-foreground">{recommendedClinic.address}</div>
      </div>
      <div className="rounded-md border border-border bg-muted/40 p-2 text-muted-foreground">
        Данные не записываются. Это симуляция воронки.
      </div>
    </div>
  );

  return (
    <div className="lg:w-80">
      {/* Desktop */}
      <Card className="hidden p-3 lg:block">
        <div className="mb-2 text-sm font-medium">Демо-статус</div>
        {content}
      </Card>
      {/* Mobile */}
      <div className="lg:hidden">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full" style={{ minHeight: 44 }}>
              Демо-статус
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <Card className="p-3">{content}</Card>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
