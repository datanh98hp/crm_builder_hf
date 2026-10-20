# Kiến trúc và quy ước mở rộng

Modular monolith theo brief §5. Mục tiêu: thêm chức năng bằng cách thêm module, không sửa lõi; tách tiến trình (API, worker) mà không đổi mã.

## Bố cục `apps/api`
```text
src/
  main.ts              entrypoint API
  worker.ts            entrypoint worker (cùng image, lệnh khác)
  app.module.ts        composition root của API (ghép module + pipeline guard)
  app.setup.ts         middleware, validation, CORS, OpenAPI
  config/              đọc và kiểm tra env một lần (AppConfig, token APP_CONFIG)
  database/            PrismaService (adapter pg)
  redis/               client Redis dùng chung (null nếu không cấu hình)
  common/              cắt ngang, KHÔNG chứa nghiệp vụ
    auth/              decorator và kiểu dùng chung: @Public, @RequirePermission, PERMISSIONS, AuthUser
    errors/            ErrorCode ổn định cho client
    filters/ interceptors/ logging/ guards/ rate-limit/
  modules/             nghiệp vụ, mỗi module một thư mục
    access-control/ audit/ auth/ health/ outbox/
  workers/             hạ tầng job (BullMQ), WorkerModule
prisma/                schema, migrations, seed
test/                e2e (PostgreSQL + Redis thật) và helpers/
```

## Quy tắc phụ thuộc (kiểm tra tự động bằng `npm run check:arch`)
1. `common`, `config`, `database`, `redis`, `workers` không import `modules` (trừ `workers/worker.module.ts` là composition root).
2. Module chỉ import module khác qua điểm vào công khai: `index.ts` (phía HTTP) hoặc `jobs.ts` (phía job), không import service/repository nội bộ.
3. Không có vòng phụ thuộc. `src` không import `test`, module không import entrypoint.

## Pipeline mỗi request (đăng ký trong `AppModule`)
`RateLimitGuard` -> `JwtAuthGuard` -> `PermissionsGuard` (mặc định từ chối). Route phải khai báo rõ một trong: `@Public()`, `@AnyAuthenticatedUser()`, `@RequirePermission(PERMISSIONS.X)`. Mọi lỗi đi qua `AllExceptionsFilter`, phản hồi qua `ResponseInterceptor`.

## Thêm một module nghiệp vụ (ví dụ `loan-products`)
1. Tạo `src/modules/loan-products/` với `loan-products.module.ts`, `.controller.ts`, `.service.ts`, `dto/`, và `index.ts` xuất module và service công khai.
2. Thêm model vào `prisma/schema.prisma`, tạo migration. Module sở hữu repository của mình; module khác gọi service công khai hoặc nghe sự kiện, không đọc bảng của nhau.
3. Thêm mã quyền vào `common/auth/permissions.ts`, gán vai trò và phạm vi dữ liệu trong `modules/access-control/role-grants.ts`.
4. Gắn `@RequirePermission(...)` cho từng route; kiểm tra quyền trên bản ghi bằng `canAccess(user, permission, resource)`.
5. Ghi `AuditService.record(...)` cho hành động quan trọng; sự kiện ra ngoài ghi qua `OutboxService.enqueue(tx, ...)` trong cùng transaction.
6. Import module vào `AppModule`. Viết test e2e dùng `test/helpers`.

## Thêm job nền
1. Trong module, tạo `<module>-jobs.module.ts` đăng ký `JobDefinition` vào `JobsRegistry` (tên dạng `<module>.<việc>`, handler phải idempotent).
2. Xuất qua `src/modules/<module>/jobs.ts`, import vào `workers/worker.module.ts`.
3. Chạy bằng `npm run start:worker -w @buildcrm/api` hoặc service `worker` trong Compose. Lịch nằm trong Redis nên chạy nhiều worker vẫn chỉ một lần mỗi chu kỳ.
Sự kiện nghiệp vụ bền vững phải nằm trong PostgreSQL (outbox), không chỉ trong Redis.

## Mở rộng quy mô
- Nhiều replica API: giới hạn tốc độ và khóa tài khoản dùng Redis chung (tự dùng bộ nhớ tiến trình nếu Redis lỗi, `/ready` báo 503).
- Tách worker khỏi API: đã tách entrypoint; scale riêng bằng `--scale worker=N`.
- Khi một module cần tách thành service: giữ nguyên ranh giới `index.ts` (hợp đồng) và sự kiện outbox.
