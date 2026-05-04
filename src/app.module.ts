import { Module } from '@nestjs/common';
import { LayerModule } from './layers/layer.module.js';

@Module({
  imports: [LayerModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
