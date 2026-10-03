import { Controller, Get, Inject } from '@nestjs/common';
import { Access } from '../auth/access';
import { DivineFortuneService } from './divine-fortune.service';
@Controller('api/divine-fortune')
@Access('public')
export class DivineFortuneController {
  constructor(
    @Inject(DivineFortuneService)
    private readonly fortune: DivineFortuneService,
  ) {}
  @Get()
  read() {
    return this.fortune.read();
  }
}
