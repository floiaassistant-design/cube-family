import { SIEGE_GATES } from "../game/siege/assault";
import { RAVINE_GATES } from "../game/siege/ravine-layout";
import type { SiegeReport } from "../game/siege/session";

const gateReportKeys = { outer: "outerGate", inner: "innerGate", keep: "keepGate" } as const;

const breachMessages = {
  ravine: {
    outer: {
      fr: "Premier rempart percé ! Repli au bastion médian.",
      en: "First rampart breached! Fall back to the middle bastion.",
    },
    inner: {
      fr: "Bastion médian percé ! Repli au dernier refuge.",
      en: "Middle bastion breached! Fall back to the last refuge.",
    },
    keep: {
      fr: "Dernier refuge percé ! Défends le cristal.",
      en: "Last refuge breached! Defend the crystal.",
    },
  },
  legacy: {
    outer: { fr: "Porte extérieure détruite !", en: "Outer gate destroyed!" },
    inner: { fr: "Porte intérieure détruite !", en: "Inner gate destroyed!" },
  },
} as const;

export function gateBreaches(before: SiegeReport, after: SiegeReport, french: boolean) {
  const locale = french ? "fr" : "en";
  return SIEGE_GATES.flatMap((id) => {
    const key = gateReportKeys[id];
    if ((before[key]?.health ?? 0) <= 0 || after[key]?.health !== 0) return [];
    const message = after.keepGate
      ? breachMessages.ravine[id]
      : id === "keep"
        ? null
        : breachMessages.legacy[id];
    return message ? [{ id, text: message[locale] }] : [];
  });
}

export function ravineDefenseLine(report: SiegeReport, french: boolean): string {
  const locale = french ? "fr" : "en";
  for (const [index, gate] of SIEGE_GATES.entries()) {
    const state = report[gateReportKeys[gate]];
    if (!state || state.health <= 0) continue;
    return `${index + 1}/4 ${RAVINE_GATES[gate][locale]} · ${french ? "Porte" : "Gate"} ${state.health}/${state.maxHealth}`;
  }
  return french ? "4/4 Défends le cristal" : "4/4 Defend the crystal";
}
