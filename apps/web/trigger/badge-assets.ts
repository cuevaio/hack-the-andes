import { put } from "@vercel/blob";

export const uploadPng = async (pathname: string, bytes: ArrayBuffer) =>
  put(pathname, bytes, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "image/png",
  });
