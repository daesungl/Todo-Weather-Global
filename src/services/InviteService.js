import firestore from '@react-native-firebase/firestore';

const _generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const _membersCollection = (flowId) =>
  firestore().collection('flows').doc(flowId).collection('members');

const _flowRefsCollection = (uid) =>
  firestore().collection('users').doc(uid).collection('flowRefs');

const _docExists = (doc) =>
  typeof doc.exists === 'function' ? doc.exists() : !!doc.exists;

const _isPermissionDenied = (error) =>
  error?.code === 'firestore/permission-denied'
  || String(error?.message || '').includes('permission-denied');

const _cleanFlowData = (flowData = {}) => {
  const { id, steps, _role, _ownerUid, _permissions, order, ...cleanFlowData } = flowData;
  return Object.fromEntries(Object.entries(cleanFlowData).filter(([, v]) => v !== undefined));
};

export const generateInviteCode = async (uid, flowId, role = 'viewer', flowData = null) => {
  const code = _generateCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  const expiresTs = firestore.Timestamp.fromDate(expiresAt);

  const batch = firestore().batch();
  batch.set(firestore().collection('inviteCodes').doc(code), {
    ownerUid: uid,
    flowId,
    role,
    createdAt: firestore.FieldValue.serverTimestamp(),
    expiresAt: expiresTs,
  });

  // 플로우 실제 데이터가 있으면 함께 씀 (오너 구버전 대응: Firestore에 title/steps 동기화)
  // 초대 코드 관련 필드는 항상 새로 생성된 값이 우선 적용되도록 spread 순서를 지킴
  const flowDocUpdate = {
    ...(flowData ? _cleanFlowData(flowData) : {}),
    inviteCode: code,
    inviteRole: role,
    inviteCodeExpiresAt: expiresTs,
    ownerUid: uid,
  };

  batch.set(
    firestore().collection('flows').doc(flowId),
    flowDocUpdate,
    { merge: true }
  );
  batch.set(_membersCollection(flowId).doc(uid), {
    role: 'owner',
    joinedAt: firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(_flowRefsCollection(uid).doc(flowId), {
    ownerUid: uid,
    flowId,
    role: 'owner',
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  return code;
};

export const invalidateInviteCode = async (uid, flowId, code) => {
  // inviteCodes 도큐먼트만 삭제 — flow 문서의 inviteCode 필드는 건드리지 않는다.
  // generateInviteCode가 set+merge로 새 코드를 덮어쓰기 때문에 flow 문서를 수정할 필요가 없고,
  // 수정할 경우 FlowSyncService의 onSnapshot이 트리거되어 무한 업데이트 루프가 발생한다.
  try {
    await firestore().collection('inviteCodes').doc(code).delete();
  } catch (_) {}
};

export const joinFlowByCode = async (uid, code, displayName = '') => {
  const inviteRef = firestore().collection('inviteCodes').doc(code.toUpperCase().trim());
  // 서버에서 직접 읽어 오프라인 캐시 지연으로 인한 INVALID_CODE 오류 방지
  const inviteDoc = await inviteRef.get({ source: 'server' });
  const invite = inviteDoc.data();
  if (!invite || !invite.expiresAt) throw new Error('INVALID_CODE');
  if (invite.expiresAt.toDate() < new Date()) throw new Error('EXPIRED_CODE');
  if (invite.ownerUid === uid) throw new Error('OWN_FLOW');

  const memberRef = _membersCollection(invite.flowId).doc(uid);
  const flowRef = _flowRefsCollection(uid).doc(invite.flowId);

  let existingMemberData = null;
  try {
    const existingMemberSnap = await memberRef.get();
    existingMemberData = _docExists(existingMemberSnap) ? existingMemberSnap.data() : null;
  } catch (e) {
    if (!_isPermissionDenied(e)) throw e;
    // 아직 멤버가 아닌 사용자는 rules상 members read가 거부된다. join은 create로 진행한다.
  }
  const effectiveRole = existingMemberData ? existingMemberData.role : invite.role;

  const batch = firestore().batch();
  if (!existingMemberData) {
    batch.set(memberRef, {
      role: invite.role,
      displayName: displayName || `User ${uid.slice(0, 5)}`,
      joinedAt: firestore.FieldValue.serverTimestamp(),
      lastReadStepsAt: firestore.FieldValue.serverTimestamp(),
      lastReadCommentsAt: firestore.FieldValue.serverTimestamp(),
    });
  }
  batch.set(flowRef, {
    ownerUid: invite.ownerUid,
    flowId: invite.flowId,
    role: effectiveRole,
    joinedAt: firestore.FieldValue.serverTimestamp(),
    lastReadStepsAt: firestore.FieldValue.serverTimestamp(),
    lastReadCommentsAt: firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();

  // member doc이 Firestore rules에 반영되도록 짧게 대기 후 flow title 읽기
  let flowTitle = '';
  const readFlowTitle = async () => {
    const flowDoc = await firestore()
      .collection('flows').doc(invite.flowId)
      .get();
    const flowData = flowDoc.data();
    if (flowData) flowTitle = flowData.title || '';
  };
  try {
    await readFlowTitle();
  } catch (_) {
    try {
      await new Promise(r => setTimeout(r, 1500));
      await readFlowTitle();
    } catch (_2) {}
  }

  return { flowId: invite.flowId, ownerUid: invite.ownerUid, role: effectiveRole, flowTitle };
};

export const leaveFlow = async (uid, ownerUid, flowId) => {
  const batch = firestore().batch();
  batch.delete(_membersCollection(flowId).doc(uid));
  batch.delete(_flowRefsCollection(uid).doc(flowId));
  await batch.commit();
};

export const removeMember = async (ownerUid, flowId, memberUid) => {
  const batch = firestore().batch();
  batch.delete(_membersCollection(flowId).doc(memberUid));
  batch.delete(_flowRefsCollection(memberUid).doc(flowId));
  await batch.commit();
};

export const getFlowMembers = async (ownerUid, flowId) => {
  const snapshot = await _membersCollection(flowId).get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      uid: doc.id,
      role: data.role,
      displayName: data.displayName || `User ${doc.id.slice(0, 5)}`,
      permissions: data.permissions || {
        edit: data.role === 'editor',
        manageComments: data.role === 'editor',
      },
    };
  });
};

export const subscribeToFlowMembers = (ownerUid, flowId, onUpdate) => {
  if (!ownerUid || !flowId) return () => {};
  return _membersCollection(flowId).onSnapshot(snapshot => {
    const members = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        role: data.role,
        displayName: data.displayName || `User ${doc.id.slice(0, 5)}`,
        permissions: data.permissions || {
          edit: data.role === 'editor',
          manageComments: data.role === 'editor',
        },
      };
    });
    onUpdate(members);
  }, err => {
    console.warn('[InviteService] subscribe members error:', err);
  });
};

export const updateMemberPermissions = async (ownerUid, flowId, memberUid, permissions) => {
  const batch = firestore().batch();
  const memberRef = _membersCollection(flowId).doc(memberUid);
  const flowRef = _flowRefsCollection(memberUid).doc(flowId);

  const updateData = { permissions };
  if (permissions.edit) updateData.role = 'editor';
  else updateData.role = 'viewer';

  batch.set(memberRef, updateData, { merge: true });
  batch.set(flowRef, updateData, { merge: true });
  await batch.commit();
};
