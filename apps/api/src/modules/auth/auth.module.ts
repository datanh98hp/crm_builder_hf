import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../../config/app-config.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { AuthController } from './auth.controller.js';
import { JWT_AUDIENCE, JWT_ISSUER } from './auth.constants.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true, // JwtAuthGuard is registered app-wide in AppModule and needs JwtService
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) => ({
        secret: cfg.jwtAccessSecret,
        signOptions: { algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
        verifyOptions: { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
