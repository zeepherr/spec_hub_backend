import { S3Client } from "@aws-sdk/client-s3";
import { config } from "./index.js";

export const r2Client = new S3Client({
  //client for uploading
  region: "auto",
  endpoint: `https://${config.r2_account_id}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2_access_key_id,
    secretAccessKey: config.r2_secret_access_key,
  },
});
