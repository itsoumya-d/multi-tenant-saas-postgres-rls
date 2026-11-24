export interface UploadPart {
  partNumber: number;
  expectedSize: number;
  uploaded: boolean;
  sha256Checksum?: string;
}

export interface VideoUploadSession {
  sessionId: string;
  tenantId: string;
  filename: string;
  totalSizeBytes: number;
  chunkSizeBytes: number;
  parts: UploadPart[];
  status: "pending" | "uploading" | "completed" | "aborted";
}

export class VideoUploadManager {
  private static readonly DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunk size

  static createSession(
    tenantId: string,
    filename: string,
    totalSizeBytes: number,
    chunkSizeBytes: number = this.DEFAULT_CHUNK_SIZE
  ): VideoUploadSession {
    if (totalSizeBytes <= 0) {
      throw new Error("Total size must be greater than zero");
    }

    const totalParts = Math.ceil(totalSizeBytes / chunkSizeBytes);
    const parts: UploadPart[] = [];

    for (let i = 1; i <= totalParts; i++) {
      const isLastPart = i === totalParts;
      const partSize = isLastPart ? totalSizeBytes - (i - 1) * chunkSizeBytes : chunkSizeBytes;
      parts.push({
        partNumber: i,
        expectedSize: partSize,
        uploaded: false,
      });
    }

    const sessionId = `upload_${tenantId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return {
      sessionId,
      tenantId,
      filename,
      totalSizeBytes,
      chunkSizeBytes,
      parts,
      status: "pending",
    };
  }

  static verifyAndRecordChunk(
    session: VideoUploadSession,
    partNumber: number,
    sha256Checksum: string
  ): boolean {
    const part = session.parts.find((p) => p.partNumber === partNumber);
    if (!part || !sha256Checksum) {
      return false;
    }

    part.uploaded = true;
    part.sha256Checksum = sha256Checksum;
    session.status = "uploading";
    return true;
  }

  static completeSession(session: VideoUploadSession): boolean {
    const allUploaded = session.parts.every((p) => p.uploaded);
    if (allUploaded) {
      session.status = "completed";
      return true;
    }
    return false;
  }
}
