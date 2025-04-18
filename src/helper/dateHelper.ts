import { formatISO, addMonths, subMonths } from "date-fns";

export interface PeriodRange {
  startDate: Date;
  endDate: Date;
  groupFormat: string;
  displayFormat: string;
  currentReference: string;
}

export type PeriodType = "yearly" | "monthly";

export interface AnalyticsResponse<T = any> {
  period: PeriodType;
  currentReference: string;
  startDate: string;
  endDate: string;
  data: T[];
  navigation: {
    previous: string;
    next: string;
  };
}

export function validatePeriod(period: PeriodType, reference: string) {
  const patterns = {
    yearly: /^\d{4}$/,
    monthly: /^\d{4}-(0[1-9]|1[0-2])$/,
  };

  if (!patterns[period].test(reference)) {
    return true;
  }

  return false;
}

export const getDateRange = (period: PeriodType, reference: string) => {
  let startDate: Date, endDate: Date;

  if (period === "yearly") {
    const year = reference ? parseInt(reference) : new Date().getFullYear();
    startDate = new Date(year, 0, 1); // Jan 1 of the year
    endDate = new Date(year, 11, 31); // Dec 31 of the year
    return {
      startDate,
      endDate,
      groupFormat: "%Y-%m", // Group by month
      currentReference: year.toString(),
    };
  }

  // Monthly handling
  const [year, month] = reference.split("-").map(Number);
  startDate = new Date(year, month - 1, 1);
  endDate = new Date(year, month, 0); // Last day of month
  return {
    startDate,
    endDate,
    groupFormat: "%Y-%m-%d",
    currentReference: reference,
  };
};

export const fillEmptyIntervals = (
  data: any[],
  period: PeriodType,
  start: Date,
  end: Date
) => {
  const filledData = [];
  const dataMap = new Map(data.map((item) => [item._id, item]));

  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const key =
      period === "yearly"
        ? `${year}-${month}`
        : formatISO(current, { representation: "date" });

    filledData.push({
      _id: key,
      total: dataMap.get(key)?.total || 0,
      bookings: dataMap.get(key)?.bookings || 0,
    });

    period === "yearly"
      ? current.setMonth(current.getMonth() + 1)
      : current.setDate(current.getDate() + 1);
  }

  return filledData;
};

export function getNavigation(period: PeriodType, currentRef: string) {
  if (period === "yearly") {
    const year = parseInt(currentRef);
    return { previous: (year - 1).toString(), next: (year + 1).toString() };
  }

  // Monthly navigation
  const [y, m] = currentRef.split("-").map(Number);
  const currentMonth = new Date(y, m - 1, 1);
  return {
    previous: formatISO(subMonths(currentMonth, 1)).slice(0, 7),
    next: formatISO(addMonths(currentMonth, 1)).slice(0, 7),
  };
}
