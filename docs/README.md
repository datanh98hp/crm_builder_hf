# BuildCRM Finance Advising — trạng thái triển khai

Nguồn yêu cầu: `finance-advising-project-memory-agent-brief.md` (v1.0, 2026-10-16).

## Đã có
- Monorepo npm workspaces, `apps/api` (NestJS 12 modular monolith, ESM), prefix `/api/v1`, OpenAPI tại `/api/docs` (tắt mặc định ở production).
- Cấu hình tập trung, fail-fast; mã lỗi ổn định; request ID; error envelope `{error:{code,message,details},meta:{requestId}}`.
- `/health` (liveness) và `/ready` (PostgreSQL và Redis nếu cấu hình).
- Auth: login, refresh token xoay vòng (lưu hash, phát hiện tái sử dụng), logout, `/auth/me`.
- RBAC + data scope (OWN/ASSIGNED/BRANCH/ALL), mặc định từ chối.
- Giới hạn tốc độ và khóa tài khoản dùng Redis chung giữa các replica (fallback bộ nhớ khi Redis lỗi).
- Worker riêng (BullMQ) với job dọn refresh token hết hạn; audit log; transactional outbox (phần ghi).
- Prisma 7 (schema nền tảng + migration init), Docker, Compose (proxy, api, worker, postgres, redis), CI.
- Công cụ: ESLint type-aware (0 cảnh báo), Prettier, kiểm tra kiến trúc (`check:arch`).

Xem `docs/architecture.md` cho bố cục, quy tắc phụ thuộc và cách thêm module/job.

## Chưa có
Sản phẩm/gói vay, eligibility, calculator, hồ sơ vay, advising/chat (Socket.IO), files, webhook dispatcher (worker đã có hạ tầng), web, mobile.

## Giả định cần chủ dự án xác nhận
- Refresh token trả trong body (API-first). Web Next.js sẽ chuyển sang cookie HttpOnly + CSRF khi làm frontend.
- Bộ permission seed trong `prisma/seed.ts` chỉ là ví dụ tối thiểu, chưa phải ma trận quyền chính thức (brief §12).
- Migration `20261019000000_init` được viết tay (sandbox không tải được schema-engine). Trên máy có mạng hãy chạy `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code` để xác nhận không lệch schema.
- Prisma 7 (`prisma.config.ts` giữ URL cho CLI; runtime dùng `@prisma/adapter-pg`, không cần query engine nhị phân). NestJS 12 là ESM, nên `apps/api` là ESM thật (`"type": "module"`, import có đuôi `.js`).
- Yêu cầu Node >= 20.19 (khuyến nghị 22 LTS).

## Chạy local
```bash
cp .env.example .env
docker compose -f deploy/compose/docker-compose.dev.yml up -d
npm install
npm run prisma:generate -w @buildcrm/api
npm run prisma:migrate:deploy -w @buildcrm/api
npm run seed -w @buildcrm/api
npm run start:dev -w @buildcrm/api
npm run start:worker:dev -w @buildcrm/api   # job nền, cần REDIS_URL
```

## Kiểm thử
```bash
npm run test -w @buildcrm/api      # unit
npm run test:e2e -w @buildcrm/api    # cần PostgreSQL + DATABASE_URL + JWT_ACCESS_SECRET, đã migrate; thêm REDIS_URL để chạy test Redis/worker
npm run lint && npm run typecheck && npm run check:arch -w @buildcrm/api && npm run format:check -w @buildcrm/api
```
Giới hạn đăng nhập mặc định 5 lần/phút/IP, chỉnh bằng `LOGIN_RATE_LIMIT`.

## Bảo mật phụ thuộc
- `npm audit --omit=dev`: 0 cảnh báo (CI chặn ở mức high).
- `npm audit` đầy đủ còn 20 cảnh báo moderate, chỉ trong công cụ dev của Jest (`js-yaml` 3 qua `istanbul`, dùng đọc cấu hình coverage; không parse YAML không tin cậy). Không vào image chạy thật. Bản "sửa" npm đề xuất là hạ Jest xuống v25 nên không áp dụng; sẽ hết khi Jest nâng dependency.
- `@nestjs/throttler` (CommonJS) không chạy được cùng NestJS 12 ESM trong Jest, nên dùng bộ giới hạn tốc độ riêng (`src/common/rate-limit`) với lưu trữ Redis dùng chung và fallback bộ nhớ.
- Sau reverse proxy (Caddy) cần `TRUST_PROXY_HOPS=1` để giới hạn theo IP thật; Compose đã đặt sẵn.

## Rà soát bảo mật (2026-10-19)
Đã sửa và có test (`apps/api/test/security.e2e-spec.ts`):
- **Mặc định từ chối:** route đăng nhập rồi nhưng thiếu `@RequirePermission`/`@AnyAuthenticatedUser`/`@Public` trả 403 (trước đây mở cho mọi tài khoản).
- **Khóa theo tài khoản:** 10 lần sai/15 phút trên mọi IP (`ACCOUNT_LOGIN_LIMIT`), thông báo giống nhau cho email có và không tồn tại; đăng nhập đúng xóa bộ đếm.
- **JWT:** bắt buộc `iss`/`aud`, chỉ HS256; test từ chối `alg=none`, payload bị sửa, sai khóa, hết hạn.
- **API docs/OpenAPI:** tắt mặc định ở production (`ENABLE_API_DOCS`).
- **Seed:** từ chối chạy ở production nếu thiếu `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD` (>= 12 ký tự); không còn mật khẩu mặc định ngoài local.
- **Băm mật khẩu:** scrypt N=2^15 (lưu tham số trong hash, hash cũ vẫn xác thực, chặn tham số bất thường).
- **Docker:** thêm `.dockerignore` (không đưa `.env` hay `node_modules` vào image).

Rủi ro còn lại, cần xử lý trước khi lên production:
1. (Đã xử lý) Giới hạn tốc độ/khóa tài khoản dùng Redis; job dọn `RefreshToken` hết hạn chạy ở worker.
2. Redis chỉ cứu hộ bằng bộ nhớ tiến trình khi lỗi: trong sự cố, giới hạn chỉ còn theo từng replica.
3. Khi tạo user phải chuẩn hóa email về chữ thường (đăng nhập so khớp chữ thường); nên thêm unique index trên `lower(email)`.
4. Lỗi Prisma ghi vào log có thể kèm tham số truy vấn; cần chính sách log/che dữ liệu nhạy cảm trước khi có dữ liệu tài chính.
5. Quy trình xoay khóa `JWT_ACCESS_SECRET`, mã hóa/sao lưu DB chưa có. Compose đã đặt mật khẩu Redis (`REDIS_PASSWORD`).
6. Chưa kiểm thử xâm nhập, Docker image và cấu hình Caddy/TLS thực tế.
