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
var dotenv_1 = __importDefault(require("dotenv"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
// Load environment variables
dotenv_1["default"].config({ path: path_1["default"].join(__dirname, '../../.env') });
// If no API key in .env, ask user to input it
var SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY || 'P7wI'; // Using first 4 chars from error message
console.log('🔑 API Key starts with:', SPORTRADAR_API_KEY.substring(0, 4));
// Using Odds Comparison API endpoints - testing various formats
var BASE_URL = 'https://api.sportradar.us';
// API endpoints to try based on subscriptions and documentation
var ENDPOINTS = [
    // Basic endpoints format
    { name: 'List All Sports', url: "".concat(BASE_URL, "/oddscomparison/production/v2/en/sports.json?api_key=").concat(SPORTRADAR_API_KEY) },
    { name: 'Basketball Sports', url: "".concat(BASE_URL, "/oddscomparison/production/v2/en/sports/basketball.json?api_key=").concat(SPORTRADAR_API_KEY) },
    { name: 'Football Sports', url: "".concat(BASE_URL, "/oddscomparison/production/v2/en/sports/american_football.json?api_key=").concat(SPORTRADAR_API_KEY) },
    // Try with different version format (trial)
    { name: 'List Sports v3', url: "".concat(BASE_URL, "/oddscomparison/trial/v3/en/sports.json?api_key=").concat(SPORTRADAR_API_KEY) },
    { name: 'List Sports v4', url: "".concat(BASE_URL, "/oddscomparison/trial/v4/en/sports.json?api_key=").concat(SPORTRADAR_API_KEY) },
    // Trial API endpoints
    { name: 'Sports Trial', url: "".concat(BASE_URL, "/oddscomparison/trial/v2/en/sports.json?api_key=").concat(SPORTRADAR_API_KEY) },
    { name: 'NBA Trial', url: "".concat(BASE_URL, "/oddscomparison/trial/v2/en/sports/basketball/nba.json?api_key=").concat(SPORTRADAR_API_KEY) },
    { name: 'NFL Trial', url: "".concat(BASE_URL, "/oddscomparison/trial/v2/en/sports/american_football/nfl.json?api_key=").concat(SPORTRADAR_API_KEY) },
    // NBA endpoint
    { name: 'NBA Daily Schedule', url: "".concat(BASE_URL, "/nba/trial/v8/en/games/2024/06/05/schedule.json?api_key=").concat(SPORTRADAR_API_KEY) },
    // With different region formatting
    { name: 'Sports US', url: "".concat(BASE_URL, "/oddscomparison-us/trial/v2/en/sports.json?api_key=").concat(SPORTRADAR_API_KEY) },
    { name: 'Sports EU', url: "".concat(BASE_URL, "/oddscomparison-eu/trial/v2/en/sports.json?api_key=").concat(SPORTRADAR_API_KEY) },
    // Player Props specific
    { name: 'Player Props Sports', url: "".concat(BASE_URL, "/oddscomparison-player-props/trial/v2/en/sports.json?api_key=").concat(SPORTRADAR_API_KEY) },
    { name: 'NBA Player Props', url: "".concat(BASE_URL, "/oddscomparison-player-props/trial/v2/en/sports/basketball/nba.json?api_key=").concat(SPORTRADAR_API_KEY) },
    // Regular odds specific
    { name: 'Regular Odds Sports', url: "".concat(BASE_URL, "/oddscomparison-standard/trial/v2/en/sports.json?api_key=").concat(SPORTRADAR_API_KEY) },
    { name: 'NBA Regular Odds', url: "".concat(BASE_URL, "/oddscomparison-standard/trial/v2/en/sports/basketball/nba.json?api_key=").concat(SPORTRADAR_API_KEY) },
    // Prematch odds specific
    { name: 'Prematch Sports', url: "".concat(BASE_URL, "/oddscomparison-prematch/trial/v2/en/sports.json?api_key=").concat(SPORTRADAR_API_KEY) },
    { name: 'NBA Prematch', url: "".concat(BASE_URL, "/oddscomparison-prematch/trial/v2/en/sports/basketball/nba.json?api_key=").concat(SPORTRADAR_API_KEY) },
    // Direct sport APIs
    { name: 'NBA API', url: "".concat(BASE_URL, "/nba/trial/v8/en/league/hierarchy.json?api_key=").concat(SPORTRADAR_API_KEY) },
    { name: 'NFL API', url: "".concat(BASE_URL, "/nfl/trial/v7/en/league/hierarchy.json?api_key=").concat(SPORTRADAR_API_KEY) },
    { name: 'MLB API', url: "".concat(BASE_URL, "/mlb/trial/v7/en/league/hierarchy.json?api_key=").concat(SPORTRADAR_API_KEY) },
    { name: 'NHL API', url: "".concat(BASE_URL, "/nhl/trial/v7/en/league/hierarchy.json?api_key=").concat(SPORTRADAR_API_KEY) },
];
function testSportRadarEndpoints() {
    return __awaiter(this, void 0, void 0, function () {
        var successfulEndpoints, _i, ENDPOINTS_1, endpoint, response, data, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🧪 Testing multiple endpoints to find working ones...\n');
                    successfulEndpoints = [];
                    _i = 0, ENDPOINTS_1 = ENDPOINTS;
                    _a.label = 1;
                case 1:
                    if (!(_i < ENDPOINTS_1.length)) return [3 /*break*/, 10];
                    endpoint = ENDPOINTS_1[_i];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 7, , 8]);
                    console.log("\uD83D\uDD0D Testing endpoint: ".concat(endpoint.name));
                    console.log("\uD83D\uDD17 URL: ".concat(endpoint.url.replace(SPORTRADAR_API_KEY, '***')));
                    return [4 /*yield*/, (0, node_fetch_1["default"])(endpoint.url, {
                            headers: {
                                'Accept': 'application/json'
                            }
                        })];
                case 3:
                    response = _a.sent();
                    if (!response.ok) return [3 /*break*/, 5];
                    console.log("\u2705 Success! Status: ".concat(response.status));
                    return [4 /*yield*/, response.json()];
                case 4:
                    data = _a.sent();
                    successfulEndpoints.push({
                        name: endpoint.name,
                        url: endpoint.url,
                        data: data
                    });
                    // Save successful response to file
                    fs_1["default"].writeFileSync(path_1["default"].join(__dirname, "../../data/".concat(endpoint.name.replace(/\s/g, '_').toLowerCase(), ".json")), JSON.stringify(data, null, 2));
                    console.log("\uD83D\uDCBE Data saved to data/".concat(endpoint.name.replace(/\s/g, '_').toLowerCase(), ".json"));
                    return [3 /*break*/, 6];
                case 5:
                    console.log("\u274C Failed with status: ".concat(response.status));
                    _a.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    error_1 = _a.sent();
                    console.error("\u274C Error testing ".concat(endpoint.name, ":"), error_1.message);
                    return [3 /*break*/, 8];
                case 8:
                    console.log('-------------------');
                    _a.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 1];
                case 10:
                    console.log('\n📊 Results Summary:');
                    if (successfulEndpoints.length > 0) {
                        console.log("\u2705 ".concat(successfulEndpoints.length, " working endpoints found!"));
                        console.log('Working endpoints:');
                        successfulEndpoints.forEach(function (endpoint) {
                            console.log("- ".concat(endpoint.name));
                        });
                        console.log('\n🎉 Success! You can now use the working endpoints in your application.');
                        console.log('\nHere are the working endpoint URLs:');
                        successfulEndpoints.forEach(function (endpoint) {
                            console.log("".concat(endpoint.name, ": ").concat(endpoint.url.replace(SPORTRADAR_API_KEY, '***')));
                        });
                    }
                    else {
                        console.log('❌ No working endpoints found.');
                        console.log('\n👉 Troubleshooting steps:');
                        console.log('1. Verify your API key is correct - current key begins with:', SPORTRADAR_API_KEY.substring(0, 4));
                        console.log('2. Check your SportRadar subscription status - you need an active trial or paid subscription');
                        console.log('3. Ensure you are using the complete API key, not just the prefix');
                        console.log('4. Confirm IP restrictions - some API keys are restricted to specific IPs');
                        console.log('5. Check if your trial period has expired');
                        console.log('\n📝 Next steps:');
                        console.log('1. Contact SportRadar support to confirm your subscription details');
                        console.log('2. Verify the complete API key (not just the prefix)');
                        console.log('3. Consider updating to a paid subscription if needed');
                    }
                    return [2 /*return*/];
            }
        });
    });
}
// Make sure the data directory exists
var dataDir = path_1["default"].join(__dirname, '../../data');
if (!fs_1["default"].existsSync(dataDir)) {
    fs_1["default"].mkdirSync(dataDir, { recursive: true });
}
console.log("\n\uD83C\uDFAF Testing SportRadar API endpoints...\n");
testSportRadarEndpoints();
