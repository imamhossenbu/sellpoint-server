// src/utils/planPeriod.js
import dayjs from "dayjs";

export function endDateFromPeriod(period = "month", start = new Date()) {
    const now = dayjs(start);
    if (period === "year") return now.add(1, "year").toDate();
    if (period === "one_time") {
        // If you want “lifetime” seller — pick a long future date (or handle specially)
        return now.add(50, "year").toDate();
    }
    return now.add(1, "month").toDate(); // default month
}
