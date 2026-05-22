import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env.js";

export const queueNames = {
  analyze: "agent.analyze",
  solve: "agent.solve",
  buildSubmission: "agent.build_submission",
  review: "agent.review",
  revise: "agent.revise",
  submit: "agent.submit",
  blockchainSync: "blockchain.sync",
};

let redisConnection;
let queues;

export function getRedisConnection() {
  if (!redisConnection) {
    redisConnection = new IORedis(env.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    redisConnection.on("error", (error) => {
      console.error(`Redis connection error: ${error.message}`);
    });
  }
  return redisConnection;
}

function createQueue(name) {
  return new Queue(name, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 500,
      removeOnFail: 1000,
    },
  });
}

export function getQueues() {
  if (!queues) {
    queues = {
      analyze: createQueue(queueNames.analyze),
      solve: createQueue(queueNames.solve),
      buildSubmission: createQueue(queueNames.buildSubmission),
      review: createQueue(queueNames.review),
      revise: createQueue(queueNames.revise),
      submit: createQueue(queueNames.submit),
      blockchainSync: createQueue(queueNames.blockchainSync),
    };
  }
  return queues;
}

export async function enqueueAnalyze(rentalId) {
  return getQueues().analyze.add("analyze", { rentalId });
}

export async function enqueueSolve(rentalId) {
  return getQueues().solve.add("solve", { rentalId });
}

export async function enqueueBuildSubmission(rentalId) {
  return getQueues().buildSubmission.add("build_submission", { rentalId });
}

export async function enqueueReview(rentalId) {
  return getQueues().review.add("review", { rentalId });
}

export async function enqueueRevise(rentalId) {
  return getQueues().revise.add("revise", { rentalId });
}

export async function enqueueSubmit(rentalId) {
  return getQueues().submit.add("submit", { rentalId });
}
