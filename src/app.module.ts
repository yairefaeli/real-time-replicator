import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { LayerModule } from './layers/layer.module.js';

@Module({
  imports: [LayerModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
