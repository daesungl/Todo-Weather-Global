import firestore from '@react-native-firebase/firestore';

/**
 * users/{ownerUid}/flows/{flowId}/comments/{commentId}
 */

const _commentsCol = (ownerUid, flowId) => 
  firestore().collection('users').doc(ownerUid).collection('flows').doc(flowId).collection('comments');

export const subscribeToComments = (ownerUid, flowId, onUpdate) => {
  if (!ownerUid || !flowId) return () => {};
  
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
    .collection('users').doc(ownerUid).collection('flows').doc(flowId)
    .update({ [`commentCounts.${stepId}`]: firestore.FieldValue.increment(1) })
    .catch(() => {});
};

export const deleteComment = async (ownerUid, flowId, stepId, commentId) => {
  if (!ownerUid || !flowId || !commentId) return;

  const batch = firestore().batch();
  const commentRef = _commentsCol(ownerUid, flowId).doc(commentId);
  const flowRef = firestore().collection('users').doc(ownerUid).collection('flows').doc(flowId);

  batch.delete(commentRef);
  if (stepId) {
    batch.update(flowRef, {
      [`commentCounts.${stepId}`]: firestore.FieldValue.increment(-1)
    });
  }

  await batch.commit();
};
