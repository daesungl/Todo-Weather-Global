import firestore from '@react-native-firebase/firestore';

const _generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const _membersCollection = (ownerUid, flowId) =>
  firestore().collection('users').doc(ownerUid).collection('flows').doc(flowId).collection('members');

export const generateInviteCode = async (uid, flowId, role = 'viewer') => {
  const code = _generateCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  const expiresTs = firestore.Timestamp.fromDate(expiresAt);

  const batch = firestore().batch();
  batch.set(firestore().collection('inviteCodes').doc(code), {
    ownerUid: uid,
    flowId,
    role,
    createdAt: firestore.FieldValue.serverTimestamp(),
    expiresAt: expiresTs,
  });
  batch.update(
    firestore().collection('users').doc(uid).collection('flows').doc(flowId),
    { inviteCode: code, inviteRole: role, inviteCodeExpiresAt: expiresTs }
  );
  await batch.commit();
  return code;
};

export const invalidateInviteCode = async (uid, flowId, code) => {
  const batch = firestore().batch();
  batch.delete(firestore().collection('inviteCodes').doc(code));
  batch.update(
    firestore().collection('users').doc(uid).collection('flows').doc(flowId),
    {
      inviteCode: firestore.FieldValue.delete(),
      inviteRole: firestore.FieldValue.delete(),
      inviteCodeExpiresAt: firestore.FieldValue.delete(),
    }
  );
  await batch.commit();
};

export const joinFlowByCode = async (uid, code) => {
  // 1. Read invite code (allowed for all authenticated users)
  const inviteRef = firestore().collection('inviteCodes').doc(code.toUpperCase().trim());
  const inviteDoc = await inviteRef.get();
  if (!inviteDoc.exists) throw new Error('INVALID_CODE');

  const invite = inviteDoc.data();
  if (invite.expiresAt.toDate() < new Date()) throw new Error('EXPIRED_CODE');
  if (invite.ownerUid === uid) throw new Error('OWN_FLOW');

  // 2. Self-join: always upsert membership doc + sharedFlows pointer.
  //    Using set() (not create) so this is idempotent and heals orphaned state
  //    (e.g. membership doc exists but sharedFlows pointer is missing, or vice versa).
  //    "Already a member" is surfaced by the caller checking their own flows list.
  const memberRef = _membersCollection(invite.ownerUid, invite.flowId).doc(uid);
  const sharedFlowRef = firestore()
    .collection('users').doc(uid).collection('sharedFlows').doc(invite.flowId);
  const batch = firestore().batch();
  batch.set(memberRef, {
    role: invite.role,
    joinedAt: firestore.FieldValue.serverTimestamp(),
  });
  batch.set(sharedFlowRef, {
    ownerUid: invite.ownerUid,
    flowId: invite.flowId,
    role: invite.role,
    joinedAt: firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();

  // 4. Read flow title now that membership exists
  let flowTitle = '';
  try {
    const flowDoc = await firestore()
      .collection('users').doc(invite.ownerUid).collection('flows').doc(invite.flowId)
      .get();
    if (flowDoc.exists) flowTitle = flowDoc.data().title || '';
  } catch (_) {}

  return { flowId: invite.flowId, ownerUid: invite.ownerUid, role: invite.role, flowTitle };
};

export const leaveFlow = async (uid, ownerUid, flowId) => {
  const batch = firestore().batch();
  batch.delete(_membersCollection(ownerUid, flowId).doc(uid));
  batch.delete(
    firestore().collection('users').doc(uid).collection('sharedFlows').doc(flowId)
  );
  await batch.commit();
};

export const removeMember = async (ownerUid, flowId, memberUid) => {
  const batch = firestore().batch();
  batch.delete(_membersCollection(ownerUid, flowId).doc(memberUid));
  batch.delete(
    firestore().collection('users').doc(memberUid).collection('sharedFlows').doc(flowId)
  );
  await batch.commit();
};

export const getFlowMembers = async (ownerUid, flowId) => {
  const snapshot = await _membersCollection(ownerUid, flowId).get();
  return snapshot.docs.map(doc => ({ uid: doc.id, role: doc.data().role }));
};
