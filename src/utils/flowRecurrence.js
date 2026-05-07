export const dateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const advanceByRepeat = (date, repeat) => {
  const d = new Date(date);
  switch (repeat) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      return null;
  }
  return d;
};

const parseLocalDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const dayDiff = (start, end) =>
  Math.round((end.getTime() - start.getTime()) / 86400000);

export const isRecurringStep = (step) =>
  !!(step?.repeat && step?.repeatEndDate && step?.repeatGroupId && step?.isRepeatMaster !== false);

export const expandRecurringStep = (step, rangeStart, rangeEnd, { maxOccurrences = 1200 } = {}) => {
  if (!isRecurringStep(step)) return step ? [step] : [];

  const start = parseLocalDate(step.date);
  const repeatEnd = parseLocalDate(step.repeatEndDate);
  const visibleStart = parseLocalDate(rangeStart) || start;
  const visibleEnd = parseLocalDate(rangeEnd) || repeatEnd;
  if (!start || !repeatEnd || !visibleStart || !visibleEnd || visibleEnd < start || repeatEnd < visibleStart) {
    return [];
  }

  const masterEnd = parseLocalDate(step.endDate || step.date) || start;
  const durationDays = Math.max(dayDiff(start, masterEnd), 0);
  const hardEnd = repeatEnd < visibleEnd ? repeatEnd : visibleEnd;
  const occurrences = [];
  let current = new Date(start);
  let count = 0;

  while (current <= hardEnd && count < maxOccurrences) {
    const currentStr = dateStr(current);
    if (current >= visibleStart) {
      const occurrenceEnd = addDays(current, durationDays);
      occurrences.push({
        ...step,
        id: count === 0 ? step.id : `${step.id}__${currentStr}`,
        date: currentStr,
        endDate: dateStr(occurrenceEnd),
        isRepeatMaster: count === 0,
        _virtual: count !== 0,
        _sourceStepId: step.id,
      });
    }

    const next = advanceByRepeat(current, step.repeat);
    if (!next || next <= current) break;
    current = next;
    count += 1;
  }

  return occurrences;
};

export const expandFlowStepsForRange = (steps = [], rangeStart, rangeEnd, options) =>
  (Array.isArray(steps) ? steps : []).flatMap(step => {
    if (!step) return [];
    if (step.repeatGroupId && step.isRepeatMaster === false) return [];
    return isRecurringStep(step)
      ? expandRecurringStep(step, rangeStart, rangeEnd, options)
      : [step];
  });

export const expandFlowsForRange = (flows = [], rangeStart, rangeEnd, options) =>
  (Array.isArray(flows) ? flows : []).map(flow => ({
    ...flow,
    steps: expandFlowStepsForRange(flow.steps || [], rangeStart, rangeEnd, options),
  }));
