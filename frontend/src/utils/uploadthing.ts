import { generateReactHelpers } from "@uploadthing/react";
import type { FileRouter } from "uploadthing/types";

export type OurFileRouter = FileRouter;

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const { useUploadThing, uploadFiles } =
  generateReactHelpers<OurFileRouter>({
    url: `${apiUrl}/api/uploadthing`,
  });