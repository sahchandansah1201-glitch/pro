import { useEffect, useState } from "react";
import { CheckCircle2, Globe, MessageCircle, Radio, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchAdminChannelConfigurator,
  updateAdminChannelConfigurator,
  type OmnichannelConfigDTO,
} from "@/lib/self-hosted-onboarding-api";

const FALLBACK_CONFIG: OmnichannelConfigDTO = {
  configKey: "default",
  channels: {
    telegram: {
      enabled: true,
      transport: "Вебхук мессенджера",
      botHandle: "@skindoktor_pro_bot",
    },
    web: {
      enabled: true,
      transport: "Встроенный веб-экран /check (без сжатия)",
      route: "/check",
    },
    max: {
      enabled: false,
      transport: "Канал мессенджера МАХ",
      botHandle: "",
    },
    whatsapp: {
      enabled: false,
      transport: "Шлюз сообщений Вотсап",
      instanceName: "",
    },
  },
  flowRules: {
    photoFirstMode: true,
    postPhotoLeadCaptureEnabled: true,
    photoWaitNudgeMinutes: 4,
    lowRiskFollowupDays: 30,
    mediumRiskSecondPhotoCheckEnabled: true,
    persistentMenuEnabled: true,
  },
  greetingVariants: [
    "Ура! Рад помочь — сделайте фото по наглядной памятке ниже и пришлите сюда.",
    "Рад новому обращению! Пожалуйста, пришлите чёткую фотографию участка кожи крупным планом.",
    "Отлично, готов проверить снимок! Точная маршрутизация возможна только по чёткой фотографии с расстояния около 10 см.",
  ],
};

export function OmnichannelConfiguratorCard({
  apiBaseUrl,
  apiToken,
}: {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}) {
  const [cfg, setCfg] = useState<OmnichannelConfigDTO>(FALLBACK_CONFIG);
  const [greetingsText, setGreetingsText] = useState<string>(
    FALLBACK_CONFIG.greetingVariants.join("\n"),
  );
  const [saving, setSaving] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [errorNote, setErrorNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadOmnichannel() {
      if (!apiToken) return;
      const res = await fetchAdminChannelConfigurator({ apiBaseUrl, apiToken });
      if (!active) return;
      if (res.ok && res.value?.item) {
        setCfg(res.value.item);
        if (Array.isArray(res.value.item.greetingVariants) && res.value.item.greetingVariants.length > 0) {
          setGreetingsText(res.value.item.greetingVariants.join("\n"));
        }
      }
    }
    void loadOmnichannel();
    return () => {
      active = false;
    };
  }, [apiBaseUrl, apiToken]);

  async function handleSaveOmnichannel() {
    setSaving(true);
    setStatusNote(null);
    setErrorNote(null);

    const parsedVariants = greetingsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const res = await updateAdminChannelConfigurator({
      apiBaseUrl,
      apiToken,
      payload: {
        channels: cfg.channels,
        flowRules: cfg.flowRules,
        greetingVariants: parsedVariants,
      },
    });
    setSaving(false);

    if (!res.ok || !res.value?.item) {
      setErrorNote(res.error?.message || "Не удалось сохранить настройки каналов.");
      return;
    }

    setCfg(res.value.item);
    setGreetingsText(res.value.item.greetingVariants.join("\n"));
    setStatusNote("Мультиканальный сценарий и таймеры успешно сохранены.");
  }

  const enabledChannelsCount = [
    cfg.channels.telegram.enabled,
    cfg.channels.web.enabled,
    cfg.channels.max.enabled,
    cfg.channels.whatsapp.enabled,
  ].filter(Boolean).length;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Radio className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-[15px] font-semibold">
              Мультиканальный конфигуратор воронки общения
            </h2>
            <Badge variant="secondary" className="text-[11px]">
              Активных каналов: {enabledChannelsCount} из 4
            </Badge>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Единый сценарий приёма фотографий кожи без сжатия, знакомства сразу после проверки резкости, таймеров напоминания и записи в клинику в 1 нажатие (предварительный ответ не является диагнозом).
          </p>
        </div>
      </div>

      {/* 4 канала связи */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-md border border-border p-3">
          <label className="flex cursor-pointer items-center justify-between gap-2 text-[13px] font-medium">
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-primary" aria-hidden />
              Канал Телеграм (меню 2×3 + приём фото)
            </span>
            <input
              type="checkbox"
              checked={cfg.channels.telegram.enabled}
              onChange={(e) =>
                setCfg((prev) => ({
                  ...prev,
                  channels: {
                    ...prev.channels,
                    telegram: { ...prev.channels.telegram, enabled: e.target.checked },
                  },
                }))
              }
              className="h-4 w-4"
            />
          </label>
          <Input
            aria-label="Адрес помощника в Телеграм"
            value={cfg.channels.telegram.botHandle}
            onChange={(e) =>
              setCfg((prev) => ({
                ...prev,
                channels: {
                  ...prev.channels,
                  telegram: { ...prev.channels.telegram, botHandle: e.target.value },
                },
              }))
            }
            placeholder="@skindoktor_pro_bot"
            className="min-h-11 text-[13px]"
          />
        </div>

        <div className="space-y-2 rounded-md border border-border p-3">
          <label className="flex cursor-pointer items-center justify-between gap-2 text-[13px] font-medium">
            <span className="flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-primary" aria-hidden />
              Веб-экран проверки (/check · оригинал без сжатия)
            </span>
            <input
              type="checkbox"
              checked={cfg.channels.web.enabled}
              onChange={(e) =>
                setCfg((prev) => ({
                  ...prev,
                  channels: {
                    ...prev.channels,
                    web: { ...prev.channels.web, enabled: e.target.checked },
                  },
                }))
              }
              className="h-4 w-4"
            />
          </label>
          <p className="text-[12px] text-muted-foreground">
            Маршрут: <span className="font-medium text-foreground">{cfg.channels.web.route}</span> (очистка геометок на сервере РФ)
          </p>
        </div>

        <div className="space-y-2 rounded-md border border-border p-3">
          <label className="flex cursor-pointer items-center justify-between gap-2 text-[13px] font-medium">
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
              Мессенджер МАХ
            </span>
            <input
              type="checkbox"
              checked={cfg.channels.max.enabled}
              onChange={(e) =>
                setCfg((prev) => ({
                  ...prev,
                  channels: {
                    ...prev.channels,
                    max: { ...prev.channels.max, enabled: e.target.checked },
                  },
                }))
              }
              className="h-4 w-4"
            />
          </label>
          <Input
            aria-label="Адрес помощника в мессенджере МАХ"
            value={cfg.channels.max.botHandle}
            onChange={(e) =>
              setCfg((prev) => ({
                ...prev,
                channels: {
                  ...prev.channels,
                  max: { ...prev.channels.max, botHandle: e.target.value },
                },
              }))
            }
            placeholder="@skindoktor_max"
            className="min-h-11 text-[13px]"
          />
        </div>

        <div className="space-y-2 rounded-md border border-border p-3">
          <label className="flex cursor-pointer items-center justify-between gap-2 text-[13px] font-medium">
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
              Мессенджер Вотсап (самостоятельный шлюз)
            </span>
            <input
              type="checkbox"
              checked={cfg.channels.whatsapp.enabled}
              onChange={(e) =>
                setCfg((prev) => ({
                  ...prev,
                  channels: {
                    ...prev.channels,
                    whatsapp: { ...prev.channels.whatsapp, enabled: e.target.checked },
                  },
                }))
              }
              className="h-4 w-4"
            />
          </label>
          <Input
            aria-label="Профиль шлюза Вотсап"
            value={cfg.channels.whatsapp.instanceName}
            onChange={(e) =>
              setCfg((prev) => ({
                ...prev,
                channels: {
                  ...prev.channels,
                  whatsapp: { ...prev.channels.whatsapp, instanceName: e.target.value },
                },
              }))
            }
            placeholder="clinic-ru-main"
            className="min-h-11 text-[13px]"
          />
        </div>
      </div>

      {/* Параметры шагов и таймеров */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-[13px]">
          <input
            type="checkbox"
            checked={cfg.flowRules.photoFirstMode}
            onChange={(e) =>
              setCfg((prev) => ({
                ...prev,
                flowRules: { ...prev.flowRules, photoFirstMode: e.target.checked },
              }))
            }
            className="h-4 w-4"
          />
          <span>Фото-первый вход без предварительной анкеты</span>
        </label>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-[13px]">
          <input
            type="checkbox"
            checked={cfg.flowRules.postPhotoLeadCaptureEnabled}
            onChange={(e) =>
              setCfg((prev) => ({
                ...prev,
                flowRules: { ...prev.flowRules, postPhotoLeadCaptureEnabled: e.target.checked },
              }))
            }
            className="h-4 w-4"
          />
          <span>Запрос имени и телефона сразу после проверки резкости фото</span>
        </label>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-[13px]">
          <input
            type="checkbox"
            checked={cfg.flowRules.persistentMenuEnabled}
            onChange={(e) =>
              setCfg((prev) => ({
                ...prev,
                flowRules: { ...prev.flowRules, persistentMenuEnabled: e.target.checked },
              }))
            }
            className="h-4 w-4"
          />
          <span>Постоянное нижнее меню 2×3 в мессенджере</span>
        </label>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-[13px]">
          <input
            type="checkbox"
            checked={cfg.flowRules.mediumRiskSecondPhotoCheckEnabled}
            onChange={(e) =>
              setCfg((prev) => ({
                ...prev,
                flowRules: {
                  ...prev.flowRules,
                  mediumRiskSecondPhotoCheckEnabled: e.target.checked,
                },
              }))
            }
            className="h-4 w-4"
          />
          <span>Предлагать 2-е фото под другим углом при среднем уровне</span>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="omnicfg-nudge-min" className="text-[12px]">
            Таймер мягкого напоминания без присланного фото (минут)
          </Label>
          <Input
            id="omnicfg-nudge-min"
            type="number"
            min={1}
            max={30}
            value={cfg.flowRules.photoWaitNudgeMinutes}
            onChange={(e) =>
              setCfg((prev) => ({
                ...prev,
                flowRules: {
                  ...prev.flowRules,
                  photoWaitNudgeMinutes: Number.parseInt(e.target.value, 10) || 4,
                },
              }))
            }
            className="min-h-11"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="omnicfg-followup-days" className="text-[12px]">
            Таймер повторного осмотра при спокойной картине (дней)
          </Label>
          <Input
            id="omnicfg-followup-days"
            type="number"
            min={7}
            max={180}
            value={cfg.flowRules.lowRiskFollowupDays}
            onChange={(e) =>
              setCfg((prev) => ({
                ...prev,
                flowRules: {
                  ...prev.flowRules,
                  lowRiskFollowupDays: Number.parseInt(e.target.value, 10) || 30,
                },
              }))
            }
            className="min-h-11"
          />
        </div>
      </div>

      {/* Ротация приветствий */}
      <div className="space-y-1.5">
        <Label htmlFor="omnicfg-greetings" className="text-[12px]">
          Ротация дружелюбных ответов на кнопку «Новый анализ» (по одной фразе на строку; без диагнозов и процентов вероятности)
        </Label>
        <Textarea
          id="omnicfg-greetings"
          rows={3}
          value={greetingsText}
          onChange={(e) => setGreetingsText(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          disabled={saving}
          onClick={() => void handleSaveOmnichannel()}
          className="min-h-11 gap-2"
        >
          <Save className="h-4 w-4" aria-hidden />
          {saving ? "Сохранение…" : "Сохранить мультиканальный сценарий"}
        </Button>

        {statusNote ? (
          <span role="status" className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {statusNote}
          </span>
        ) : null}
        {errorNote ? (
          <span role="alert" className="text-[12px] text-destructive">
            {errorNote}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
