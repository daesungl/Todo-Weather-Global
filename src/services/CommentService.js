import firestore from '@react-native-firebase/firestore';
import {
  addPlanComment,
  deletePlanComment,
  isSupabasePlanBackendEnabled,
  listPlanComments,
} from './supabase/PlanApiService';

/**
 * flows/{flowId}/comments/{commentId}
 */

const _commentsCol = (ownerUid, flowId) => 
  firestore().collection('flows').doc(flowId).collection('comments');

export const subscribeToComments = (ownerUid, flowId, onUpdate) => {
  if (!ownerUid || !flowId) return () => {};
  if (isSupabasePlanBackendEnabled()) {
    let cancelled = false;
    const load = () => {
      listPlanComments(flowId)
        .then(comments => {
          if (!cancelled) onUpdate(comments.map(comment => ({
            ...comment,
            createdAt: comment.createdAt ? new Date(comment.createdAt) : new Date(),
          })));
        })
        .catch(err => console.warn('[CommentService] Supabase comments load error:', err));
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }
  
  return _commentsCol(ownerUid, flowId)
    .orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));
      onUpdate(comments);
    }, err => {
      console.warn('[CommentService] subscribe error:', err);
    });
};

export const addComment = async (ownerUid, flowId, stepId, user, text) => {
  if (!ownerUid || !flowId || !stepId || !user || !text.trim()) return;
  if (isSupabasePlanBackendEnabled()) {
    const result = await addPlanComment(flowId, stepId, text);
    return result?.comment
      ? {
        ...result.comment,
        createdAt: result.comment.createdAt ? new Date(result.comment.createdAt) : new Date(),
      }
      : null;
  }

  const commentData = {
    stepId,
    text: text.trim(),
    uid: user.uid,
    displayName: user.displayName || 'Guest',
    createdAt: firestore.FieldValue.serverTimestamp(),
  };

  // Comment creation is the critical write — block on this.
  await _commentsCol(ownerUid, flowId).doc().set(commentData);

  // commentCounts is a denormalized cache on the flow doc.
  // Viewers can create comments but cannot update the flow doc, so this
  // must be fire-and-forget and never block or throw.
  firestore()
    .collection('flows').doc(flowId)
    .update({
      [`commentCounts.${stepId}`]: firestore.FieldValue.increment(1),
      commentLastCreatedAt: firestore.FieldValue.serverTimestamp(),
      commentLastUid: user.uid,
      commentsUpdatedAt: firestore.FieldValue.serverTimestamp(),
      commentsCount: firestore.FieldValue.increment(1),
      commentsLastUid: user.uid,
    })
    .catch(() => {});

  return {
    id: `local_${Date.now()}`,
    ...commentData,
    createdAt: new Date(),
  };
};

export const deleteComment = async (ownerUid, flowId, stepId, commentId) => {
  if (!ownerUid || !flowId || !commentId) return;
  if (isSupabasePlanBackendEnabled()) {
    await deletePlanComment(flowId, commentId);
    return;
  }

  const batch = firestore().batch();
  const commentRef = _commentsCol(ownerUid, flowId).doc(commentId);
  const flowRef = firestore().collection('flows').doc(flowId);

  batch.delete(commentRef);
  if (stepId) {
    batch.update(flowRef, {
      [`commentCounts.${stepId}`]: firestore.FieldValue.increment(-1),
      commentsCount: firestore.FieldValue.increment(-1),
    });
  }

  await batch.commit();
};
