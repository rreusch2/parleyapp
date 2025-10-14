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
var node_fetch_1 = __importDefault(require("node-fetch"));
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1["default"].config();
/**
 * Service for interacting with the SportRadar API
 */
var SportRadarService = /** @class */ (function () {
    function SportRadarService() {
        this.baseUrl = 'https://api.sportradar.us';
        this.cacheExpiration = 3600000; // 1 hour in milliseconds
        this.apiKey = process.env.SPORTRADAR_API_KEY || '';
        if (!this.apiKey) {
            console.error('SPORTRADAR_API_KEY is not set in the environment variables');
        }
        // Setup cache directory
        this.cachePath = path_1["default"].join(__dirname, '../../../data/cache');
        if (!fs_1["default"].existsSync(this.cachePath)) {
            fs_1["default"].mkdirSync(this.cachePath, { recursive: true });
        }
    }
    /**
     * Get available sports from the Odds Comparison API (Player Props)
     */
    SportRadarService.prototype.getAvailableSports = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.fetchWithCache('player_props_sports', "".concat(this.baseUrl, "/oddscomparison-player-props/trial/v2/en/sports.json?api_key=").concat(this.apiKey))];
            });
        });
    };
    /**
     * Get available sports from the Prematch Odds Comparison API
     */
    SportRadarService.prototype.getPrematchSports = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.fetchWithCache('prematch_sports', "".concat(this.baseUrl, "/oddscomparison-prematch/trial/v2/en/sports.json?api_key=").concat(this.apiKey))];
            });
        });
    };
    /**
     * Get NBA league hierarchy
     */
    SportRadarService.prototype.getNbaHierarchy = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.fetchWithCache('nba_hierarchy', "".concat(this.baseUrl, "/nba/trial/v8/en/league/hierarchy.json?api_key=").concat(this.apiKey))];
            });
        });
    };
    /**
     * Get MLB league hierarchy
     */
    SportRadarService.prototype.getMlbHierarchy = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.fetchWithCache('mlb_hierarchy', "".concat(this.baseUrl, "/mlb/trial/v7/en/league/hierarchy.json?api_key=").concat(this.apiKey))];
            });
        });
    };
    /**
     * Get NHL league hierarchy
     */
    SportRadarService.prototype.getNhlHierarchy = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.fetchWithCache('nhl_hierarchy', "".concat(this.baseUrl, "/nhl/trial/v7/en/league/hierarchy.json?api_key=").concat(this.apiKey))];
            });
        });
    };
    /**
     * Get NBA daily schedule
     * @param year - Year (YYYY)
     * @param month - Month (MM)
     * @param day - Day (DD)
     */
    SportRadarService.prototype.getNbaDailySchedule = function (year, month, day) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey;
            return __generator(this, function (_a) {
                cacheKey = "nba_schedule_".concat(year, "_").concat(month, "_").concat(day);
                return [2 /*return*/, this.fetchWithCache(cacheKey, "".concat(this.baseUrl, "/nba/trial/v8/en/games/").concat(year, "/").concat(month, "/").concat(day, "/schedule.json?api_key=").concat(this.apiKey))];
            });
        });
    };
    /**
     * Get NBA game boxscore
     * @param gameId - SportRadar Game ID
     */
    SportRadarService.prototype.getNbaGameBoxscore = function (gameId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.fetchWithCache("nba_boxscore_".concat(gameId), "".concat(this.baseUrl, "/nba/trial/v8/en/games/").concat(gameId, "/boxscore.json?api_key=").concat(this.apiKey))];
            });
        });
    };
    /**
     * Get MLB daily schedule
     * @param year - Year (YYYY)
     * @param month - Month (MM)
     * @param day - Day (DD)
     */
    SportRadarService.prototype.getMlbDailySchedule = function (year, month, day) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey;
            return __generator(this, function (_a) {
                cacheKey = "mlb_schedule_".concat(year, "_").concat(month, "_").concat(day);
                return [2 /*return*/, this.fetchWithCache(cacheKey, "".concat(this.baseUrl, "/mlb/trial/v7/en/games/").concat(year, "/").concat(month, "/").concat(day, "/schedule.json?api_key=").concat(this.apiKey))];
            });
        });
    };
    /**
     * Get NHL daily schedule
     * @param year - Year (YYYY)
     * @param month - Month (MM)
     * @param day - Day (DD)
     */
    SportRadarService.prototype.getNhlDailySchedule = function (year, month, day) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheKey;
            return __generator(this, function (_a) {
                cacheKey = "nhl_schedule_".concat(year, "_").concat(month, "_").concat(day);
                return [2 /*return*/, this.fetchWithCache(cacheKey, "".concat(this.baseUrl, "/nhl/trial/v7/en/games/").concat(year, "/").concat(month, "/").concat(day, "/schedule.json?api_key=").concat(this.apiKey))];
            });
        });
    };
    /**
     * Get player props markets
     * This uses the Odds Comparison Player Props API
     */
    SportRadarService.prototype.getPlayerPropsMarkets = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.fetchWithCache('player_props_markets', "".concat(this.baseUrl, "/oddscomparison-player-props/trial/v2/en/markets.json?api_key=").concat(this.apiKey))];
            });
        });
    };
    /**
     * Generic method to fetch data from any endpoint
     * @param endpoint - Full endpoint URL
     */
    SportRadarService.prototype.fetchFromEndpoint = function (endpoint) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, (0, node_fetch_1["default"])(endpoint, {
                                headers: {
                                    'Accept': 'application/json'
                                }
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("HTTP error! status: ".concat(response.status));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Error fetching data:', error_1);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetch data with caching
     * @param cacheKey - Unique key for caching
     * @param url - URL to fetch data from
     */
    SportRadarService.prototype.fetchWithCache = function (cacheKey, url) {
        return __awaiter(this, void 0, void 0, function () {
            var cacheFilePath, stats, fileAge, cachedData, response, data, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cacheFilePath = path_1["default"].join(this.cachePath, "".concat(cacheKey, ".json"));
                        // Check if cache exists and is not expired
                        if (fs_1["default"].existsSync(cacheFilePath)) {
                            stats = fs_1["default"].statSync(cacheFilePath);
                            fileAge = Date.now() - stats.mtimeMs;
                            if (fileAge < this.cacheExpiration) {
                                try {
                                    cachedData = fs_1["default"].readFileSync(cacheFilePath, 'utf8');
                                    return [2 /*return*/, JSON.parse(cachedData)];
                                }
                                catch (error) {
                                    console.error('Error reading cache:', error);
                                    // Continue to fetch fresh data if cache read fails
                                }
                            }
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, (0, node_fetch_1["default"])(url, {
                                headers: {
                                    'Accept': 'application/json'
                                }
                            })];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("HTTP error! status: ".concat(response.status));
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _a.sent();
                        // Save to cache
                        fs_1["default"].writeFileSync(cacheFilePath, JSON.stringify(data, null, 2));
                        return [2 /*return*/, data];
                    case 4:
                        error_2 = _a.sent();
                        console.error('Error fetching data:', error_2);
                        throw error_2;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return SportRadarService;
}());
exports["default"] = new SportRadarService();
