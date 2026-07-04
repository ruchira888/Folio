import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createRouteHandler } from "uploadthing/express";
import { ourFileRouter } from "./uploadthing";
import { uploadRouter } from "./routes/upload";
import { pdfRouter } from "./routes/pdf";

import { UploadThingProvider } from "./storage/UploadThingProvider";
import { FileReconciler } from "./Reconciler/fileReconciler";
import { logger } from "./logger";

dotenv.config();
if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
  logger.error(
    "GROQ_API_KEY (or GEMINI_API_KEY) is not set in .env — summarize will not work",
  );
  process.exit(1);
}

export const storage = new UploadThingProvider();

const reconciler = new FileReconciler(storage);
reconciler.start();
const app = express();

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/uploadthing", createRouteHandler({ router: ourFileRouter }));

app.use("/api/upload", uploadRouter);

app.use("/api/pdf", pdfRouter);

// Error handler middleware - must be last
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    logger.error(`Error: ${err.message}`, err);
    res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  },
);

app.listen(PORT, () => {
  console.log(`Backend runnin on port ${PORT}`);
});
