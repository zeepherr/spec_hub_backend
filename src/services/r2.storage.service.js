import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { config } from "../configs/index.js";
import { r2Client } from "../configs/r2.js";

export const getR2PublicUrl = (key) => {
  return `${config.r2_public_url}/${key}`;
};

export const uploadToR2 = async ({ buffer, key, contentType }) => {
  const command = new PutObjectCommand({
    Bucket: config.r2_bucket_name,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  return {
    key,
    url: getR2PublicUrl(key),
  };
};

export const getFromR2 = async (key) => {
  const command = new GetObjectCommand({
    Bucket: config.r2_bucket_name,
    Key: key,
  });

  const response = await r2Client.send(command);

  const bytes = await response.Body.transformToByteArray();

  return {
    buffer: Buffer.from(bytes),
    contentType: response.ContentType ?? "image/jpeg",
  };
};

export const deleteFromR2 = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: config.r2_bucket_name,
    Key: key,
  });

  return r2Client.send(command);
};
