import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors';
import { getHintForPostOnly } from '../lib/getMethodHint';
import { payload, wrapJsonHandler } from '../lib/apiRoute';

const router = Router();

router.get('/', getHintForPostOnly('图片上传请使用 POST，Content-Type: multipart/form-data，字段名 file。'));

const ALLOWED = /^image\/(jpeg|png|gif|webp)$/i;
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.test(file.mimetype)) {
      cb(new HttpError(400, '仅支持 jpg、png、gif、webp 格式'));
      return;
    }
    cb(null, true);
  },
});

router.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
        if (code === 'LIMIT_FILE_SIZE') {
          next(new HttpError(400, '图片不超过 2MB'));
          return;
        }
        next(err as Error);
        return;
      }
      next();
    });
  },
  wrapJsonHandler(async (ctx) => {
    if (!ctx.req.file) {
      throw new HttpError(400, '请选择要上传的图片');
    }
    const url = `/uploads/${ctx.req.file.filename}`;
    return payload({ url }, '上传成功');
  })
);

export default router;
