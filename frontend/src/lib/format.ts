import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/** Localized number formatter — the Arabic UI uses Arabic-Indic numerals. */
export function useNumberFormat(): Intl.NumberFormat {
  const { i18n } = useTranslation();
  const lng = i18n.language.startsWith("ar")
    ? `${i18n.language}-u-nu-arab`
    : i18n.language;
  return useMemo(() => new Intl.NumberFormat(lng), [lng]);
}

/**
 * Shared localized work-duration formatter ("Xh Ym" units). Sub-hour values
 * stay honest — 2m, 45m — and minutes are only appended when non-zero:
 * 75m → "1h 15m", 8h → "8h". A true zero renders as "0h".
 * Input is minutes; pass seconds/60 for second-precision sources.
 */
export function useFormatDuration(): (totalMinutes: number) => string {
  const { t } = useTranslation();
  const nf = useNumberFormat();
  const unitH = t("attendance.unit.h");
  const unitM = t("attendance.unit.m");
  return useMemo(
    () =>
      (totalMinutes: number) => {
        const mins = Math.floor(Math.max(0, totalMinutes));
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h === 0) {
          return m > 0 ? `${nf.format(m)}${unitM}` : `${nf.format(0)}${unitH}`;
        }
        return `${nf.format(h)}${unitH}${
          m > 0 ? ` ${nf.format(m)}${unitM}` : ""
        }`;
      },
    [nf, unitH, unitM],
  );
}
