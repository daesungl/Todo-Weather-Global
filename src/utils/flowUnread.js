export const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1000000);
  }
  return 0;
};

export const readBaselineMillis = (primary, fallback) => {
  const primaryMs = toMillis(primary);
  if (primaryMs > 0) return primaryMs;
  const fallbackMs = toMillis(fallback);
  return fallbackMs > 0 ? fallbackMs : Number.POSITIVE_INFINITY;
};

export const getFlowUnreadInfo = (flow, uid) => {
  if (!flow || !uid) {
    return { hasUnreadSteps: false, hasUnreadComments: false, hasUnread: false };
  }

  const stepsAt = readBaselineMillis(flow._lastReadStepsAt, flow._joinedAt);
  const commentsAt = readBaselineMillis(flow._lastReadCommentsAt, flow._joinedAt);
  const hasUnreadSteps = (flow.steps || []).some(step => {
    if (!step || step.createdBy === uid) return false;
    const createdAt = toMillis(step.createdAt);
    return createdAt > 0 && createdAt > stepsAt;
  });
  const lastCommentMs = toMillis(flow.commentLastCreatedAt);
  const hasUnreadComments = flow.commentLastUid !== uid
    && lastCommentMs > 0
    && lastCommentMs > commentsAt;

  return { hasUnreadSteps, hasUnreadComments, hasUnread: hasUnreadSteps || hasUnreadComments };
};

export const countUnreadFlows = (flows = [], uid) =>
  (Array.isArray(flows) ? flows : []).filter(flow => getFlowUnreadInfo(flow, uid).hasUnread).length;
