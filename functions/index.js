const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const meaningfulStepMarkers = [
  'contentUpdatedAt',
  'dateUpdatedAt',
  'timeUpdatedAt',
  'createdAt',
];

const getMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
};

const changed = (before, after, field) => getMillis(before?.[field]) !== getMillis(after?.[field]);

const hasMeaningfulStepUpdate = (before, after) =>
  meaningfulStepMarkers.some(field => changed(before, after, field));

const getActorUid = (data = {}) =>
  data.updatedBy || data.createdBy || data.uid || data.authorUid || null;

const getActorName = (data = {}) =>
  data.updatedByName || data.createdByName || data.displayName || data.authorName || data.email || 'Member';

const getStepTitle = (data = {}) =>
  data.activity || data.title || data.name || 'Plan item';

const getFlowMembers = async (flowId) => {
  const snap = await db.collection('flows').doc(flowId).collection('members').get();
  const members = [];
  snap.forEach(doc => members.push({ uid: doc.id, ...(doc.data() || {}) }));
  return members;
};

const getUserPushTokens = async (uid) => {
  const snap = await db.collection('users').doc(uid).collection('pushTokens').get();
  const tokens = [];
  snap.forEach(doc => {
    const data = doc.data() || {};
    if (data.token && data.enabled !== false) {
      tokens.push({ id: doc.id, token: data.token, tokenType: data.tokenType || 'expo' });
    }
  });
  return tokens;
};

const cleanupInvalidTokens = async (uid, tokens, responses = []) => {
  const deletes = [];
  responses.forEach((response, index) => {
    if (response.success) return;
    const code = response.error?.code || '';
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
      const token = tokens[index];
      if (token?.id) {
        deletes.push(db.collection('users').doc(uid).collection('pushTokens').doc(token.id).delete());
      }
    }
  });
  await Promise.allSettled(deletes);
};

const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const cleanupInvalidExpoTokens = async (uid, tokens, results = []) => {
  const deletes = [];
  results.forEach((result, index) => {
    if (result?.status !== 'error') return;
    if (result?.details?.error !== 'DeviceNotRegistered') return;
    const token = tokens[index];
    if (token?.id) {
      deletes.push(db.collection('users').doc(uid).collection('pushTokens').doc(token.id).delete());
    }
  });
  await Promise.allSettled(deletes);
};

const sendExpoPush = async ({ uid, tokens, badgeCount, flowId, reason, title, body }) => {
  if (!tokens.length) return;
  const messages = tokens.map(item => ({
    to: item.token,
    title,
    body,
    sound: 'default',
    badge: badgeCount,
    data: {
      type: 'flow_badge',
      flowId,
      reason,
    },
  }));

  await Promise.all(chunk(messages, 100).map(async (messagesChunk, chunkIndex) => {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagesChunk),
    });
    if (!response.ok) {
      console.error('[FlowBadge] Expo push failed', { status: response.status, text: await response.text() });
      return;
    }
    const json = await response.json().catch(() => null);
    const results = Array.isArray(json?.data) ? json.data : [];
    await cleanupInvalidExpoTokens(uid, tokens.slice(chunkIndex * 100, chunkIndex * 100 + messagesChunk.length), results);
  }));
};

const sendFcmPush = async ({ uid, tokens, badgeCount, flowId, reason, title, body }) => {
  if (!tokens.length) return;
  const message = {
    tokens: tokens.map(item => item.token),
    notification: { title, body },
    data: {
      type: 'flow_badge',
      flowId,
      reason,
    },
    apns: {
      payload: {
        aps: {
          badge: badgeCount,
          sound: 'default',
        },
      },
    },
    android: {
      notification: {
        notificationCount: badgeCount,
        sound: 'default',
      },
    },
  };

  const result = await admin.messaging().sendEachForMulticast(message);
  await cleanupInvalidTokens(uid, tokens, result.responses);
};

const sendBadgePush = async ({ uid, tokens, badgeCount, flowId, reason, title, body }) => {
  if (!tokens.length) return;
  const expoTokens = tokens.filter(item => item.tokenType === 'expo' || String(item.token).startsWith('ExponentPushToken') || String(item.token).startsWith('ExpoPushToken'));
  const fcmTokens = tokens.filter(item => !expoTokens.includes(item));

  await Promise.allSettled([
    sendExpoPush({ uid, tokens: expoTokens, badgeCount, flowId, reason, title, body }),
    sendFcmPush({ uid, tokens: fcmTokens, badgeCount, flowId, reason, title, body }),
  ]);
};

const createUnreadBadgeAndMaybePush = async ({ flowId, memberUid, actorUid, actorName, reason, stepId, stepTitle }) => {
  if (!memberUid || memberUid === actorUid) return;

  const userRef = db.collection('users').doc(memberUid);
  const badgeRef = userRef.collection('unreadFlowBadges').doc(flowId);
  const stateRef = userRef.collection('badge').doc('state');

  try {
    const batch = db.batch();
    batch.create(badgeRef, {
      flowId,
      reason,
      actorUid: actorUid || null,
      actorName: actorName || 'Member',
      stepId: stepId || null,
      stepTitle: stepTitle || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(
      stateRef,
      {
        unreadFlowBadgeCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();
  } catch (error) {
    if (error?.code === 6 || String(error?.message || '').includes('ALREADY_EXISTS')) {
      return;
    }
    console.error('[FlowBadge] create failed', { flowId, memberUid, reason, error });
    return;
  }

  const [stateSnap, tokens] = await Promise.all([
    stateRef.get(),
    getUserPushTokens(memberUid),
  ]);
  const badgeCount = Math.max(1, Number(stateSnap.data()?.unreadFlowBadgeCount || 1));
  const body = reason === 'comment'
    ? `${actorName || 'Member'} left a comment.`
    : `${actorName || 'Member'} updated a plan.`;

  await sendBadgePush({
    uid: memberUid,
    tokens,
    badgeCount,
    flowId,
    reason,
    title: 'Todo Weather',
    body: stepTitle ? `${body} ${stepTitle}` : body,
  });
};

const fanOutFlowBadge = async ({ flowId, actorUid, actorName, reason, stepId, stepTitle }) => {
  const members = await getFlowMembers(flowId);
  await Promise.allSettled(
    members.map(member =>
      createUnreadBadgeAndMaybePush({
        flowId,
        memberUid: member.uid,
        actorUid,
        actorName,
        reason,
        stepId,
        stepTitle,
      })
    )
  );
};

exports.onFlowStepCreated = onDocumentCreated('flows/{flowId}/steps/{stepId}', async (event) => {
  const data = event.data?.data() || {};
  await fanOutFlowBadge({
    flowId: event.params.flowId,
    actorUid: getActorUid(data),
    actorName: getActorName(data),
    reason: 'step',
    stepId: event.params.stepId,
    stepTitle: getStepTitle(data),
  });
});

exports.onFlowStepUpdated = onDocumentUpdated('flows/{flowId}/steps/{stepId}', async (event) => {
  const before = event.data?.before?.data() || {};
  const after = event.data?.after?.data() || {};
  if (!hasMeaningfulStepUpdate(before, after)) return;

  await fanOutFlowBadge({
    flowId: event.params.flowId,
    actorUid: getActorUid(after),
    actorName: getActorName(after),
    reason: 'step',
    stepId: event.params.stepId,
    stepTitle: getStepTitle(after),
  });
});

exports.onFlowCommentCreated = onDocumentCreated('flows/{flowId}/comments/{commentId}', async (event) => {
  const data = event.data?.data() || {};
  await fanOutFlowBadge({
    flowId: event.params.flowId,
    actorUid: getActorUid(data),
    actorName: getActorName(data),
    reason: 'comment',
    stepId: data.stepId || null,
    stepTitle: data.stepTitle || data.activity || null,
  });
});
