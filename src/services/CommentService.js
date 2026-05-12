import { supabase } from '../config/supabaseConfig';
import {
  addPlanComment,
  deletePlanComment,
  listPlanComments,
} from './supabase/PlanApiService';

const _lastAddMsByFlow = new Map();

export const markCommentAdding = (flowId) => {
  if (flowId) _lastAddMsByFlow.set(flowId, Date.now());
};

export const subscribeToComments = (ownerUid, flowId, onUpdate) => {
  if (!ownerUid || !flowId) return () => {};
  let cancelled = false;
  const channelId = `plan_comments_${flowId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const load = () => {
    const lastAdd = _lastAddMsByFlow.get(flowId) || 0;
    if (Date.now() - lastAdd < 2000) return;
    listPlanComments(flowId)
      .then(comments => {
        if (!cancelled) onUpdate(comments.map(comment => ({
          ...comment,
          createdAt: comment.createdAt ? new Date(comment.createdAt) : new Date(),
        })));
      })
      .catch(err => console.warn('[CommentService] comments load error:', err));
  };

  load();

  let channel;
  if (supabase) {
    channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plan_comments', filter: `plan_id=eq.${flowId}` },
        () => {
          const lastAdd = _lastAddMsByFlow.get(flowId) || 0;
          if (Date.now() - lastAdd < 2000) return;
          load();
        }
      )
      .subscribe();
  }

  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
};

export const addComment = async (ownerUid, flowId, stepId, user, text) => {
  if (!ownerUid || !flowId || !stepId || !user || !text.trim()) return;
  const result = await addPlanComment(flowId, stepId, text);
  return result?.comment
    ? {
      ...result.comment,
      createdAt: result.comment.createdAt ? new Date(result.comment.createdAt) : new Date(),
    }
    : null;
};

export const deleteComment = async (ownerUid, flowId, stepId, commentId) => {
  if (!ownerUid || !flowId || !commentId) return;
  await deletePlanComment(flowId, commentId);
};

export default { subscribeToComments, addComment, deleteComment };
