"""
AI Task Worker - Background Job Processor
Processes tasks from Redis queue and updates MongoDB
"""
import os
from dotenv import load_dotenv
load_dotenv()
import json
import time
import signal
import logging
import socket
from datetime import datetime, timezone

import redis
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from bson import ObjectId

from operations import process_operation

# ─── Logging Setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("worker")

# ─── Config ───────────────────────────────────────────────────────────────────
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
if not REDIS_PASSWORD:
    REDIS_PASSWORD = None
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_QUEUE = os.getenv("REDIS_QUEUE_NAME", "task_queue")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/ai_task_platform")
print("Mongo URI:", MONGODB_URI)

WORKER_ID = socket.gethostname()
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL_SECONDS", "1"))
MAX_RETRIES = int(os.getenv("MAX_REDIS_RETRIES", "5"))
SHUTDOWN_TIMEOUT = int(os.getenv("SHUTDOWN_TIMEOUT", "30"))


class Worker:
    def __init__(self):
        self.redis_client = None
        self.mongo_client = None
        self.db = None
        self.tasks_collection = None
        self.running = True
        self._setup_signals()

    def _setup_signals(self):
        """Graceful shutdown on SIGTERM / SIGINT"""
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        signal.signal(signal.SIGINT, self._handle_shutdown)

    def _handle_shutdown(self, signum, frame):
        logger.info(f"Received signal {signum}. Initiating graceful shutdown...")
        self.running = False

    # ─── Connections ──────────────────────────────────────────────────────────
    def connect_redis(self):
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                self.redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    db=REDIS_DB,
    decode_responses=True,
    socket_connect_timeout=5,
    socket_timeout=5,
    retry_on_timeout=True,
    health_check_interval=30,
    
)
                self.redis_client.ping()
                logger.info(f"✅ Redis connected at {REDIS_HOST}:{REDIS_PORT}")
                return
            except redis.ConnectionError as e:
                wait = min(2 ** attempt, 30)
                logger.warning(f"Redis connection attempt {attempt}/{MAX_RETRIES} failed: {e}. Retrying in {wait}s...")
                time.sleep(wait)
        raise ConnectionError("Failed to connect to Redis after maximum retries")

    def connect_mongodb(self):
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                self.mongo_client = MongoClient(
                    MONGODB_URI,
                    serverSelectionTimeoutMS=5000,
                    connectTimeoutMS=5000,
                    socketTimeoutMS=30000,
                    maxPoolSize=5,
                )
                self.mongo_client.admin.command("ping")
                db_name = MONGODB_URI.split("/")[-1].split("?")[0] or "ai_task_platform"
                self.db = self.mongo_client[db_name]
                self.tasks_collection = self.db["tasks"]
                logger.info("✅ MongoDB connected")
                return
            except ConnectionFailure as e:
                wait = min(2 ** attempt, 30)
                logger.warning(f"MongoDB connection attempt {attempt}/{MAX_RETRIES} failed: {e}. Retrying in {wait}s...")
                time.sleep(wait)
        raise ConnectionError("Failed to connect to MongoDB after maximum retries")

    # ─── Task Lifecycle ───────────────────────────────────────────────────────
    def update_task_status(self, task_id: str, status: str, **kwargs):
        """Atomically update task status and optional fields"""
        update = {
            "$set": {"status": status, **kwargs},
            "$push": {},
        }
        if "log_entry" in kwargs:
            log_entry = kwargs.pop("log_entry")
            update["$push"]["logs"] = log_entry
            update["$set"] = {"status": status, **{k: v for k, v in kwargs.items() if k != "log_entry"}}

        try:
            self.tasks_collection.update_one(
                {"_id": ObjectId(task_id)},
                update,
            )
        except OperationFailure as e:
            logger.error(f"MongoDB update failed for task {task_id}: {e}")
            raise

    def add_log(self, task_id: str, level: str, message: str):
        """Append a log entry to the task"""
        try:
            self.tasks_collection.update_one(
                {"_id": ObjectId(task_id)},
                {
                    "$push": {
                        "logs": {
                            "level": level,
                            "message": message,
                            "timestamp": datetime.now(timezone.utc),
                        }
                    }
                },
            )
        except Exception as e:
            logger.error(f"Failed to add log for task {task_id}: {e}")

    def process_job(self, job: dict):
        task_id = job.get("taskId")
        operation = job.get("operation")
        input_text = job.get("inputText", "")

        logger.info(f"Processing task {task_id} | op={operation} | worker={WORKER_ID}")
        started_at = datetime.now(timezone.utc)

        try:
            # Mark as running
            self.tasks_collection.update_one(
                {"_id": ObjectId(task_id)},
                {
                    "$set": {
                        "status": "running",
                        "startedAt": started_at,
                        "workerId": WORKER_ID,
                    },
                    "$push": {
                        "logs": {
                            "level": "info",
                            "message": f"Task picked up by worker {WORKER_ID}",
                            "timestamp": started_at,
                        }
                    },
                },
            )

            self.add_log(task_id, "info", f"Starting operation: {operation}")

            # Process
            result = process_operation(operation, input_text)

            completed_at = datetime.now(timezone.utc)
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)

            self.tasks_collection.update_one(
                {"_id": ObjectId(task_id)},
                {
                    "$set": {
                        "status": "success",
                        "result": result,
                        "completedAt": completed_at,
                        "processingDurationMs": duration_ms,
                        "errorMessage": None,
                    },
                    "$push": {
                        "logs": {
                            "level": "info",
                            "message": f"Task completed successfully in {duration_ms}ms",
                            "timestamp": completed_at,
                        }
                    },
                },
            )

            logger.info(f"Task {task_id} succeeded in {duration_ms}ms")

        except Exception as e:
            completed_at = datetime.now(timezone.utc)
            duration_ms = int((completed_at - started_at).total_seconds() * 1000)
            error_msg = str(e)

            logger.error(f"Task {task_id} failed: {error_msg}")

            try:
                self.tasks_collection.update_one(
                    {"_id": ObjectId(task_id)},
                    {
                        "$set": {
                            "status": "failed",
                            "completedAt": completed_at,
                            "processingDurationMs": duration_ms,
                            "errorMessage": error_msg,
                        },
                        "$push": {
                            "logs": {
                                "level": "error",
                                "message": f"Task failed: {error_msg}",
                                "timestamp": completed_at,
                            }
                        },
                    },
                )
            except Exception as update_err:
                logger.error(f"Failed to update task {task_id} failure status: {update_err}")

    # ─── Main Loop ────────────────────────────────────────────────────────────
    def run(self):
        logger.info(f"🚀 Worker {WORKER_ID} starting...")
        self.connect_redis()
        self.connect_mongodb()
        logger.info(f"✅ Worker {WORKER_ID} ready. Listening on queue: {REDIS_QUEUE}")

        while self.running:
            try:
                # Blocking pop with timeout for graceful shutdown
                result = self.redis_client.blpop(REDIS_QUEUE, timeout=POLL_INTERVAL)

                if result is None:
                    continue  # Timeout, check self.running

                _, raw_job = result
                job = json.loads(raw_job)
                self.process_job(job)

            except redis.ConnectionError as e:
                logger.error(f"Redis connection lost: {e}. Attempting reconnect...")
                time.sleep(5)
                try:
                    self.connect_redis()
                except Exception:
                    logger.critical("Redis reconnect failed. Exiting.")
                    break

            except (json.JSONDecodeError, KeyError) as e:
                logger.error(f"Invalid job payload: {e}")

            except Exception as e:
                logger.error(f"Unexpected error in worker loop: {e}", exc_info=True)
                time.sleep(1)

        logger.info(f"Worker {WORKER_ID} shutting down gracefully.")
        self._cleanup()

    def _cleanup(self):
        if self.redis_client:
            self.redis_client.close()
        if self.mongo_client:
            self.mongo_client.close()
        logger.info("Connections closed.")


if __name__ == "__main__":
    worker = Worker()
    worker.run()
