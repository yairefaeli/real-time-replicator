"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_js_1 = require("./app.module.js");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_js_1.AppModule);
    app.enableShutdownHooks();
    const port = process.env['PORT'] ?? 3000;
    await app.listen(port);
    logger.log(`🚀 Real-Time Replicator listening on port ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map