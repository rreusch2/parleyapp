"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
var sportRadarService_1 = __importDefault(require("../services/sportsData/sportRadarService"));
/**
 * Simple test script to try out the SportRadar service
 */
function testSportRadarService() {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function () {
        var sports, nbaHierarchy, today, year, month, day, nbaSchedule, gameId, boxscore, error_1;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 6, , 7]);
                    console.log('🧪 Testing SportRadar Service\n');
                    // Test player props sports endpoint
                    console.log('📊 Fetching Player Props Sports...');
                    return [4 /*yield*/, sportRadarService_1["default"].getAvailableSports()];
                case 1:
                    sports = _d.sent();
                    console.log('✅ Success! Found', Object.keys(sports.sports || {}).length, 'sports');
                    // Test NBA hierarchy endpoint
                    console.log('\n📊 Fetching NBA Hierarchy...');
                    return [4 /*yield*/, sportRadarService_1["default"].getNbaHierarchy()];
                case 2:
                    nbaHierarchy = _d.sent();
                    console.log('✅ Success!', ((_a = nbaHierarchy === null || nbaHierarchy === void 0 ? void 0 : nbaHierarchy.league) === null || _a === void 0 ? void 0 : _a.name) || 'NBA');
                    today = new Date();
                    year = today.getFullYear().toString();
                    month = (today.getMonth() + 1).toString().padStart(2, '0');
                    day = today.getDate().toString().padStart(2, '0');
                    console.log("\n\uD83D\uDCCA Fetching NBA Schedule for ".concat(year, "-").concat(month, "-").concat(day, "..."));
                    return [4 /*yield*/, sportRadarService_1["default"].getNbaDailySchedule(year, month, day)];
                case 3:
                    nbaSchedule = _d.sent();
                    console.log('✅ Success!', ((_b = nbaSchedule === null || nbaSchedule === void 0 ? void 0 : nbaSchedule.games) === null || _b === void 0 ? void 0 : _b.length) || 0, 'games found');
                    if (!(((_c = nbaSchedule === null || nbaSchedule === void 0 ? void 0 : nbaSchedule.games) === null || _c === void 0 ? void 0 : _c.length) > 0)) return [3 /*break*/, 5];
                    gameId = nbaSchedule.games[0].id;
                    console.log("\n\uD83D\uDCCA Fetching Boxscore for game ".concat(gameId, "..."));
                    return [4 /*yield*/, sportRadarService_1["default"].getNbaGameBoxscore(gameId)];
                case 4:
                    boxscore = _d.sent();
                    console.log('✅ Success!', boxscore ? 'Boxscore retrieved' : 'No boxscore data');
                    _d.label = 5;
                case 5:
                    console.log('\n🎉 All tests completed successfully!');
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _d.sent();
                    console.error('❌ Error testing SportRadar service:', error_1);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
// Run the test
testSportRadarService();
