export interface Policy {
  readonly name: string;
  readonly burst: number;
  readonly perMinute: number;
  readonly globalBurst: number;
  readonly globalPerMinute: number;
}

const readPolicy: Policy = {
  name: "read",
  burst: 60,
  perMinute: 120,
  globalBurst: 300,
  globalPerMinute: 3000,
};
const writePolicy: Policy = {
  name: "write",
  burst: 30,
  perMinute: 60,
  globalBurst: 120,
  globalPerMinute: 600,
};
const executionPolicy: Policy = {
  name: "execution",
  burst: 10,
  perMinute: 30,
  globalBurst: 20,
  globalPerMinute: 120,
};
const webhookPolicy: Policy = {
  name: "webhook",
  burst: 60,
  perMinute: 600,
  globalBurst: 120,
  globalPerMinute: 1200,
};
const imagePolicy: Policy = {
  name: "image",
  burst: 30,
  perMinute: 120,
  globalBurst: 100,
  globalPerMinute: 600,
};
const pagePolicy: Policy = {
  name: "page",
  burst: 60,
  perMinute: 240,
  globalBurst: 300,
  globalPerMinute: 6000,
};

// Venue Wi-Fi can put all 100 participants behind one address. Keep event
// traffic isolated from general API budgets without removing aggregate limits.
export const eventReadPolicy: Policy = {
  name: "event-read",
  burst: 300,
  perMinute: 1800,
  globalBurst: 600,
  globalPerMinute: 3600,
};
export const eventWritePolicy: Policy = {
  name: "event-write",
  burst: 150,
  perMinute: 600,
  globalBurst: 300,
  globalPerMinute: 1200,
};

export const requestPolicies = [
  readPolicy,
  writePolicy,
  executionPolicy,
  webhookPolicy,
  imagePolicy,
  pagePolicy,
  eventReadPolicy,
  eventWritePolicy,
] as const;

export function limiterTargetFor(pathname: string) {
  const match = /^\/consume\/([^/]+)\/([a-f0-9]{64})$/.exec(pathname);
  if (!match) return;
  const policy = requestPolicies.find(
    (candidate) => candidate.name === match[1],
  );
  const clientKey = match[2];
  if (!policy || !clientKey) return;
  return { policy, clientKey };
}
