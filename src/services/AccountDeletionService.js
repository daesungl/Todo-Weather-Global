import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const MAX_BATCH_OPS = 450;

const accountCacheKeys = (uid) => [
  '@tasks_v1',
  '@save_wBookmark',
  '@todo_weather_flows',
  `@todo_weather_flows_${uid}`,
  `@todo_weather_shared_flows_${uid}`,
  `@flows_global_schema_migrated_${uid}`,
  `@tasks_migrated_${uid}`,
  `@regions_migrated_${uid}`,
];

class BatchQueue {
  constructor() {
    this.batch = firestore().batch();
    this.count = 0;
  }

  delete(ref) {
    this.batch.delete(ref);
    this.count += 1;
    return this.commitIfNeeded();
  }

  async commitIfNeeded() {
    if (this.count < MAX_BATCH_OPS) return;
    await this.commit();
  }

  async commit() {
    if (this.count === 0) return;
    await this.batch.commit();
    this.batch = firestore().batch();
    this.count = 0;
  }
}

const deleteCollectionDocs = async (batchQueue, collectionRef) => {
  const snapshot = await collectionRef.get();
  for (const doc of snapshot.docs) {
    await batchQueue.delete(doc.ref);
  }
};

const assertRecentLogin = (currentUser) => {
  const lastSignIn = currentUser?.metadata?.lastSignInTime
    ? new Date(currentUser.metadata.lastSignInTime).getTime()
    : 0;
  const signedInRecently = lastSignIn > 0 && Date.now() - lastSignIn < 5 * 60 * 1000;
  if (!signedInRecently) {
    const error = new Error('Recent login is required before deleting this account.');
    error.code = 'auth/requires-recent-login';
    throw error;
  }
};

const deleteOwnedFlow = async (batchQueue, flowId) => {
  const flowRef = firestore().collection('flows').doc(flowId);

  const [membersSnapshot, stepsSnapshot, commentsSnapshot] = await Promise.all([
    flowRef.collection('members').get(),
    flowRef.collection('steps').get(),
    flowRef.collection('comments').get(),
  ]);

  for (const memberDoc of membersSnapshot.docs) {
    await batchQueue.delete(memberDoc.ref);
  }

  for (const stepDoc of stepsSnapshot.docs) {
    await batchQueue.delete(stepDoc.ref);
  }

  for (const commentDoc of commentsSnapshot.docs) {
    await batchQueue.delete(commentDoc.ref);
  }

  await batchQueue.delete(flowRef);
};

const deleteLegacyOwnedFlow = async (batchQueue, uid, flowId) => {
  const flowRef = firestore()
    .collection('users').doc(uid)
    .collection('flows').doc(flowId);

  const [membersSnapshot, commentsSnapshot] = await Promise.all([
    flowRef.collection('members').get(),
    flowRef.collection('comments').get(),
  ]);

  for (const memberDoc of membersSnapshot.docs) {
    await batchQueue.delete(memberDoc.ref);
  }

  for (const commentDoc of commentsSnapshot.docs) {
    await batchQueue.delete(commentDoc.ref);
  }

  await batchQueue.delete(flowRef);
};

const leaveSharedFlow = async (batchQueue, uid, flowId) => {
  await batchQueue.delete(
    firestore().collection('flows').doc(flowId).collection('members').doc(uid)
  );
  await batchQueue.delete(
    firestore().collection('users').doc(uid).collection('flowRefs').doc(flowId)
  );
};

export const isRecentLoginRequired = (error) =>
  error?.code === 'auth/requires-recent-login'
  || String(error?.message || '').includes('requires-recent-login');

const clearLocalAccountCaches = async (uid) => {
  try {
    await AsyncStorage.multiRemove(accountCacheKeys(uid));
  } catch (error) {
    console.warn('[AccountDeletion] Failed to clear local account caches:', error);
  }
};

export const deleteCurrentUserAccount = async () => {
  const currentUser = auth().currentUser;
  if (!currentUser?.uid) throw new Error('No authenticated user');

  const uid = currentUser.uid;
  const userRef = firestore().collection('users').doc(uid);
  const batchQueue = new BatchQueue();
  assertRecentLogin(currentUser);

  const [
    flowRefsSnapshot,
    ownedFlowsSnapshot,
    inviteCodesSnapshot,
    legacyOwnFlowsSnapshot,
    legacySharedFlowsSnapshot,
  ] = await Promise.all([
    userRef.collection('flowRefs').get(),
    firestore().collection('flows').where('ownerUid', '==', uid).get(),
    firestore().collection('inviteCodes').where('ownerUid', '==', uid).get(),
    userRef.collection('flows').get(),
    userRef.collection('sharedFlows').get(),
  ]);

  const ownedFlowIds = new Set(ownedFlowsSnapshot.docs.map(doc => doc.id));

  for (const inviteDoc of inviteCodesSnapshot.docs) {
    await batchQueue.delete(inviteDoc.ref);
  }

  for (const flowDoc of ownedFlowsSnapshot.docs) {
    await deleteOwnedFlow(batchQueue, flowDoc.id);
  }

  for (const flowDoc of legacyOwnFlowsSnapshot.docs) {
    await deleteLegacyOwnedFlow(batchQueue, uid, flowDoc.id);
  }

  for (const refDoc of flowRefsSnapshot.docs) {
    if (!ownedFlowIds.has(refDoc.id)) {
      await leaveSharedFlow(batchQueue, uid, refDoc.id);
    }
  }

  for (const sharedFlowDoc of legacySharedFlowsSnapshot.docs) {
    await batchQueue.delete(sharedFlowDoc.ref);
  }

  await deleteCollectionDocs(batchQueue, userRef.collection('tasks'));
  await deleteCollectionDocs(batchQueue, userRef.collection('regions'));

  // Flow references may already be queued while deleting owned/shared plans.
  // Commit first so the final cleanup query only sees leftovers.
  await batchQueue.commit();
  await deleteCollectionDocs(batchQueue, userRef.collection('flowRefs'));
  await batchQueue.delete(userRef);
  await batchQueue.commit();
  await clearLocalAccountCaches(uid);

  await currentUser.delete();
};
