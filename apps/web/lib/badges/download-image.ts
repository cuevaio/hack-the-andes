const maximumImageBytes = 6 * 1_024 * 1_024;
const maximumRedirects = 3;

export type ImageFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const trustedImageUrl = (value: string): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Badge asset URL is invalid");
  }

  const hostname = url.hostname.toLowerCase();
  const trustedHost =
    hostname === "github.com" ||
    hostname === "avatars.githubusercontent.com" ||
    hostname === "img.clerk.com" ||
    hostname.endsWith(".blob.vercel-storage.com");
  if (
    url.protocol !== "https:" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    !trustedHost
  ) {
    throw new Error("Badge asset URL is not from a trusted image host");
  }
  return url;
};

const readBoundedBody = async (response: Response): Promise<ArrayBuffer> => {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumImageBytes) {
    throw new Error("Downloaded badge asset exceeds 6 MB");
  }
  if (!response.body) throw new Error("Downloaded badge asset is empty");

  const reader = response.body.getReader();
  const chunks: Array<Uint8Array> = [];
  let totalBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maximumImageBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Downloaded badge asset exceeds 6 MB");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) throw new Error("Downloaded badge asset is empty");
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
};

export const downloadImage = async (
  value: string,
  fetchImpl: ImageFetch = fetch,
): Promise<ArrayBuffer> => {
  let url = trustedImageUrl(value);
  let response: Response | undefined;
  const signal = AbortSignal.timeout(30_000);
  try {
    for (let redirects = 0; redirects <= maximumRedirects; redirects += 1) {
      response = await fetchImpl(url, {
        redirect: "manual",
        signal,
      });
      const location = response.headers.get("location");
      const redirected = response.status >= 300 && response.status < 400;
      if (!redirected) break;
      await response.body?.cancel().catch(() => undefined);
      if (!location || redirects === maximumRedirects) {
        throw new Error("Badge asset redirected too many times");
      }
      url = trustedImageUrl(new URL(location, url).toString());
    }

    if (!response) throw new Error("Could not download image");
    if (!response.ok) {
      throw new Error(`Could not download image: HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    const supportedContentTypes = ["image/jpeg", "image/png", "image/webp"];
    const mediaType = contentType.toLowerCase().split(";")[0] ?? "";
    if (!supportedContentTypes.includes(mediaType)) {
      throw new Error("Downloaded badge asset is not a supported image");
    }
    return await readBoundedBody(response);
  } catch (error) {
    await response?.body?.cancel().catch(() => undefined);
    throw error;
  }
};
