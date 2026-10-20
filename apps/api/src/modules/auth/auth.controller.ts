import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthUser } from '../../common/auth/auth.types.js';
import { AnyAuthenticatedUser, CurrentUser, Public } from '../../common/auth/decorators.js';
import { getRequestId } from '../../common/logging/request-id.middleware.js';
import { RateLimit } from '../../common/rate-limit/rate-limit.guard.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @RateLimit('login')
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, getRequestId(req));
  }

  @Public()
  @RateLimit('refresh')
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, getRequestId(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto, @Req() req: Request) {
    await this.auth.logout(dto.refreshToken, getRequestId(req));
  }

  @ApiBearerAuth()
  @AnyAuthenticatedUser()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    // Safe subset only: no hashes, no internal ids beyond the user's own.
    return { id: user.id, email: user.email, branchId: user.branchId, roles: user.roles, permissions: Object.keys(user.grants) };
  }
}
