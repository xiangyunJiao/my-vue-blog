const path = require('path');
const fs = require('fs');
const { Router } = require('express');
const multer = require('multer');
const { asyncHandler } = require('../middleware/asyncHandler');
const { HttpError } = require('../lib/errors');

const router = Router();

const ALLOWED = /^image\/(jpeg|png|gif|webp)$/i;
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.test(file.mimetype)) {
      cb(new HttpError(400, '仅支持 jpg、png、gif、webp 格式'));
      return;
    }
    cb(null, true);
  },
});

router.post(
  '/',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          next(new HttpError(400, '图片不超过 2MB'));
          return;
        }
        next(err);
        return;
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, '请选择要上传的图片');
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  })
);

module.exports = router;
