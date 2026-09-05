import httpStatus from "http-status";
import multer from "multer";
import { AppError } from "../utils/AppError";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/zip",
];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(
      new AppError(
        httpStatus.BAD_REQUEST,
        `File type not allowed: ${file.mimetype}. Allowed: images, pdf, txt, md, zip (max 5MB).`,
      ),
    );
  },
});
