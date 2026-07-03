import { createUploadthing, type FileRouter } from "uploadthing/express";
import { logger } from "./logger";

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({
    pdf: {
      maxFileSize: "32MB",
      maxFileCount: 10,
    },
  })
    .middleware(async () => {
      // no auth for now
      logger.info("Upload middleware triggered");
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      // this runs AFTER file is on UploadThing servers
      // file.key = the ID used for all future operations
      // file.url = public URL to access the file
      logger.info(`Upload complete: ${file.key}`);
      return { fileKey: file.key, url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
