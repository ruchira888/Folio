import { generateReactHelpers } from "@uploadthing/react";
export type OurFileRouter = {
  pdfUploader: {
    input: undefined;
    output: {
      fileKey: string;
      url: string;
    };
  };
};

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const { useUploadThing, uploadFiles } =
  generateReactHelpers<OurFileRouter>({
    url: `${apiUrl}/api/uploadthing`,
  });