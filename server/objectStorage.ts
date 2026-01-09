import { Response } from "express";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Downloads a file by redirecting to the signed URL
  async downloadFile(objectPath: string, res: Response) {
    try {
      const { bucketName, objectName } = parseObjectPath(objectPath);
      
      // Get signed URL for downloading
      const downloadUrl = await signObjectURL({
        bucketName,
        objectName,
        method: "GET",
        ttlSec: 3600,
      });

      // Redirect to the signed URL
      res.redirect(downloadUrl);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for a PDF document.
  async getPdfUploadURL(): Promise<{ uploadUrl: string; filePath: string }> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/pdfs/${objectId}.pdf`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    const uploadUrl = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });

    return {
      uploadUrl,
      filePath: `/files/pdfs/${objectId}.pdf`
    };
  }

  // Gets the upload URL for equipment damage images
  async getEquipmentImageUploadURL(extension: string = 'jpg'): Promise<{ uploadUrl: string; filePath: string }> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/equipamentos/${objectId}.${extension}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    const uploadUrl = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });

    return {
      uploadUrl,
      filePath: `/files/equipamentos/${objectId}.${extension}`
    };
  }

  // Gets signed URL to view an image
  async getSignedViewURL(filePath: string): Promise<string> {
    const fullObjectPath = this.getFullObjectPath(filePath);
    const { bucketName, objectName } = parseObjectPath(fullObjectPath);

    return await signObjectURL({
      bucketName,
      objectName,
      method: "GET",
      ttlSec: 3600,
    });
  }

  // Deletes a file from object storage
  async deleteFile(filePath: string): Promise<void> {
    const fullObjectPath = this.getFullObjectPath(filePath);
    const { bucketName, objectName } = parseObjectPath(fullObjectPath);

    const deleteUrl = await signObjectURL({
      bucketName,
      objectName,
      method: "DELETE",
      ttlSec: 300,
    });

    const response = await fetch(deleteUrl, { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete file: ${response.status}`);
    }
  }

  // Gets the full object path for a file path
  getFullObjectPath(filePath: string): string {
    if (!filePath.startsWith("/files/")) {
      throw new ObjectNotFoundError();
    }

    const parts = filePath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const fileId = parts.slice(1).join("/");
    let privateDir = this.getPrivateObjectDir();
    if (!privateDir.endsWith("/")) {
      privateDir = `${privateDir}/`;
    }
    return `${privateDir}${fileId}`;
  }

  normalizePdfPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
  
    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
  
    let privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir.endsWith("/")) {
      privateObjectDir = `${privateObjectDir}/`;
    }
  
    if (!rawObjectPath.startsWith(privateObjectDir)) {
      return rawObjectPath;
    }
  
    // Extract the file ID from the path
    const fileId = rawObjectPath.slice(privateObjectDir.length);
    return `/files/${fileId}`;
  }
}

export function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

export async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}