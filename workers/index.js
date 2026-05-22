import { Worker } from "bullmq";
import { getRedisConnection, queueNames } from "../queues/index.js";
import {
  processAnalyze,
  processBuildSubmission,
  processBlockchainSync,
  processReview,
  processRevise,
  processSolve,
  processSubmit,
} from "./pipeline.js";

function makeWorker(name, processor) {
  const workerOptions = {
    connection: getRedisConnection(),
    concurrency: Number(process.env.WORKER_CONCURRENCY || 3),
  };
  const worker = new Worker(name, async (job) => processor(job.data), workerOptions);
  worker.on("completed", (job) => console.log(`[worker:${name}] completed job ${job.id}`));
  worker.on("failed", (job, error) =>
    console.error(`[worker:${name}] failed job ${job?.id}: ${error.message}`)
  );
  return worker;
}

export function startWorkers() {
  const workers = [
    makeWorker(queueNames.analyze, processAnalyze),
    makeWorker(queueNames.solve, processSolve),
    makeWorker(queueNames.buildSubmission, processBuildSubmission),
    makeWorker(queueNames.review, processReview),
    makeWorker(queueNames.revise, processRevise),
    makeWorker(queueNames.submit, processSubmit),
    makeWorker(queueNames.blockchainSync, processBlockchainSync),
  ];

  console.log("Agent pipeline workers started");
  return workers;
}

if (process.argv[1]?.endsWith("workers/index.js")) {
  startWorkers();
}
