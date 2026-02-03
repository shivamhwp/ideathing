import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

interface UseFileUploadOptions {
  maxSize?: number;
  allowedTypes?: string[];
}

interface UseFileUploadReturn {
  file: File | null;
  preview: string | null;
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  upload: () => Promise<string | null>;
  clear: () => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
  const { maxSize = MAX_FILE_SIZE, allowedTypes = ALLOWED_TYPES } = options;

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<File | null>(null);

  const generateUploadUrl = useMutation(api.utils.files.generateUploadUrl);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      if (selectedFile.size > maxSize) {
        toast.error(`File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error("Invalid file type. Please upload an image (JPEG, PNG, GIF, or WebP).");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      fileRef.current = selectedFile;
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    },
    [maxSize, allowedTypes],
  );

  const upload = useCallback(async (): Promise<string | null> => {
    const fileToUpload = fileRef.current ?? file;
    if (!fileToUpload) return null;

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": fileToUpload.type },
        body: fileToUpload,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await response.json();
      return storageId;
    } catch (error) {
      toast.error("Failed to upload file. Please try again.");
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [file, generateUploadUrl]);

  const clear = useCallback(() => {
    fileRef.current = null;
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return {
    file,
    preview,
    isUploading,
    fileInputRef,
    handleFileSelect,
    upload,
    clear,
  };
}
