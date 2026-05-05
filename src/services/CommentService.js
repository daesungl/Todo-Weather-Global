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

  await _commentsCol(ownerUid, flowId).add(commentData);
};

export const deleteComment = async (ownerUid, flowId, commentId) => {
  if (!ownerUid || !flowId || !commentId) return;
  await _commentsCol(ownerUid, flowId).doc(commentId).delete();
};
