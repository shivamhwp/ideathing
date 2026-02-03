import { format, isValid, parseISO } from "date-fns";

export const parseDateValue = (value: string) => {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
};

export const formatDateValue = (value: string) => {
  const parsed = parseDateValue(value);
  return parsed ? format(parsed, "PPP") : "Pick a date";
};
