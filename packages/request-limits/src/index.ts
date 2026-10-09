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

export const requestPolicies = [
  readPolicy,
  writePolicy,
  executionPolicy,
  webhookPolicy,
  imagePolicy,
  pagePolicy,
] as const;
