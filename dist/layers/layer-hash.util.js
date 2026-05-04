"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeLayerHash = computeLayerHash;
const crypto_1 = require("crypto");
function computeLayerHash(data) {
    return (0, crypto_1.createHash)('sha256')
        .update(JSON.stringify(data))
        .digest('hex');
}
//# sourceMappingURL=layer-hash.util.js.map