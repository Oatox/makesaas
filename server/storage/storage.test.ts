import { afterEach, describe, expect, test } from "bun:test";
import { detectImageType, storageKeys } from "./files";
import { R2Storage } from "./r2";

const config = {
  accountId: "account",
  accessKeyId: "key",
  secretAccessKey: "secret",
  bucket: "files",
  publicUrl: "https://files.example.com",
};

describe("detectImageType", () => {
  test("reads the type from the bytes", () => {
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(Buffer.from("RIFF\x10\x00\x00\x00WEBPVP8 ", "latin1"))).toBe("image/webp");
  });

  test("refuses anything else, whatever its name", () => {
    expect(detectImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectImageType(Buffer.from("GIF89a"))).toBeNull();
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe("R2Storage URLs", () => {
  const storage = new R2Storage({ ...config, publicUrl: "https://files.example.com" });

  test("maps keys to public URLs and back", () => {
    const key = `${storageKeys.saasLogo("user", "saas")}logo.webp`;
    const url = storage.publicUrl(key);
    expect(url).toBe("https://files.example.com/user/saas/logo/logo.webp");
    expect(storage.keyOf(url)).toBe(key);
  });

  test("ignores URLs outside the bucket", () => {
    expect(storage.keyOf("https://files.example.com.evil.test/user/a.png")).toBeNull();
    expect(storage.keyOf("https://project.supabase.co/storage/v1/object/public/carousel-images/a.png")).toBeNull();
  });
});

describe("R2Storage.deletePrefix", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("lists every page under the prefix and deletes what it found", async () => {
    const calls: { method: string; url: URL; body: string }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      calls.push({ method: request.method, url, body: await request.text() });

      if (request.method === "GET" && !url.searchParams.has("continuation-token")) {
        return new Response(
          "<ListBucketResult><IsTruncated>true</IsTruncated><Contents><Key>u/s/a.png</Key></Contents>" +
            "<Contents><Key>u/s/b&amp;c.png</Key></Contents><NextContinuationToken>next&amp;1</NextContinuationToken></ListBucketResult>",
        );
      }
      if (request.method === "GET") {
        return new Response("<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>u/s/d.png</Key></Contents></ListBucketResult>");
      }
      return new Response("<DeleteResult></DeleteResult>");
    }) as typeof fetch;

    const deleted = await new R2Storage(config).deletePrefix("u/s/");

    expect(deleted).toBe(3);
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST", "GET", "POST"]);
    expect(calls[0].url.host).toBe("account.r2.cloudflarestorage.com");
    expect(calls[0].url.searchParams.get("prefix")).toBe("u/s/");
    expect(calls[2].url.searchParams.get("continuation-token")).toBe("next&1");
    expect(calls[1].url.search).toBe("?delete");
    expect(calls[1].body).toContain("<Key>u/s/a.png</Key>");
    expect(calls[1].body).toContain("<Key>u/s/b&amp;c.png</Key>");
    expect(calls[3].body).toContain("<Key>u/s/d.png</Key>");
  });

  test("fails when R2 could not delete a file", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (request.method === "GET") {
        return new Response("<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>u/a.png</Key></Contents></ListBucketResult>");
      }
      return new Response("<DeleteResult><Error><Key>u/a.png</Key><Code>InternalError</Code></Error></DeleteResult>");
    }) as typeof fetch;

    await expect(new R2Storage(config).deletePrefix("u/")).rejects.toThrow("could not delete");
  });
});
