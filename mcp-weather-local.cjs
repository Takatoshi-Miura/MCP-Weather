#!/usr/bin/env node

const https = require('https');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema, InitializedNotificationSchema } = require('@modelcontextprotocol/sdk/types.js');

// 都市IDマッピング
const CITY_IDS = {
  '札幌': 016010, '青森': 020010, '盛岡': 030010, '仙台': 040010, '秋田': 050010,
  '山形': 060010, '福島': 070010, '水戸': 080010, '宇都宮': 090010, '前橋': 100010,
  'さいたま': 110010, '千葉': 120010, '東京': 130010, '横浜': 140010, '新潟': 150010,
  '富山': 160010, '金沢': 170010, '福井': 180010, '甲府': 190010, '長野': 200010,
  '岐阜': 210010, '静岡': 220010, '名古屋': 230010, '津': 240010, '大津': 250010,
  '京都': 260010, '大阪': 270000, '神戸': 280010, '奈良': 290010, '和歌山': 300010,
  '鳥取': 310010, '松江': 320010, '岡山': 330010, '広島': 340010, '山口': 350010,
  '徳島': 360010, '高松': 370000, '松山': 380010, '高知': 390010, '福岡': 400010,
  '佐賀': 410010, '長崎': 420010, '熊本': 430010, '大分': 440010, '宮崎': 450010,
  '鹿児島': 460010, '那覇': 471010
};

// 天気APIを呼び出す関数
function fetchWeatherData(cityId) {
  return new Promise((resolve, reject) => {
    const url = `https://weather.tsukumijima.net/api/forecast/city/${cityId}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const weatherData = JSON.parse(data);
          resolve(weatherData);
        } catch (error) {
          reject(new Error(`Failed to parse weather data: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`HTTP request failed: ${error.message}`));
    });
  });
}

// MCP Weather Server
class LocalWeatherServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-weather-local',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {
            listChanged: true
          }
        }
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // 初期化完了通知の処理
    this.server.setNotificationHandler(InitializedNotificationSchema, async () => {
      console.error('Local Weather Server initialized');
    });

    // ツールリストの処理
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const cities = Object.keys(CITY_IDS);
      
      return {
        tools: [
          {
            name: 'get_weather_overview',
            description: '指定した都市の天気概況を取得します',
            inputSchema: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: '都市名（例：東京、大阪、札幌など）',
                  enum: cities
                }
              },
              required: ['city']
            }
          },
          {
            name: 'get_precipitation_probability',
            description: '指定した都市の降水確率を取得します',
            inputSchema: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: '都市名（例：東京、大阪、札幌など）',
                  enum: cities
                }
              },
              required: ['city']
            }
          },
          {
            name: 'get_wind_speed',
            description: '指定した都市の風速情報を取得します',
            inputSchema: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: '都市名（例：東京、大阪、札幌など）',
                  enum: cities
                }
              },
              required: ['city']
            }
          }
        ]
      };
    });

    // ツール実行の処理
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const { city } = args;

      if (!city || !CITY_IDS[city]) {
        throw new Error(`Invalid city: ${city}`);
      }

      const cityId = CITY_IDS[city];

      try {
        const weatherData = await fetchWeatherData(cityId);

        switch (name) {
          case 'get_weather_overview':
            return {
              content: [
                {
                  type: 'text',
                  text: `${city}の天気概況:\n\n` +
                        `発表時刻: ${weatherData.publicTime}\n` +
                        `概況: ${weatherData.description.text}\n\n` +
                        `今日: ${weatherData.forecasts[0].date} - ${weatherData.forecasts[0].telop}\n` +
                        `明日: ${weatherData.forecasts[1].date} - ${weatherData.forecasts[1].telop}\n` +
                        `明後日: ${weatherData.forecasts[2].date} - ${weatherData.forecasts[2].telop}`
                }
              ]
            };

          case 'get_precipitation_probability':
            const today = weatherData.forecasts[0];
            const tomorrow = weatherData.forecasts[1];
            
            let precipText = `${city}の降水確率:\n\n`;
            
            if (today.chanceOfRain) {
              precipText += `今日 (${today.date}):\n`;
              precipText += `  0-6時: ${today.chanceOfRain.T00_06 || '--'}%\n`;
              precipText += `  6-12時: ${today.chanceOfRain.T06_12 || '--'}%\n`;
              precipText += `  12-18時: ${today.chanceOfRain.T12_18 || '--'}%\n`;
              precipText += `  18-24時: ${today.chanceOfRain.T18_24 || '--'}%\n\n`;
            }
            
            if (tomorrow.chanceOfRain) {
              precipText += `明日 (${tomorrow.date}):\n`;
              precipText += `  0-6時: ${tomorrow.chanceOfRain.T00_06 || '--'}%\n`;
              precipText += `  6-12時: ${tomorrow.chanceOfRain.T06_12 || '--'}%\n`;
              precipText += `  12-18時: ${tomorrow.chanceOfRain.T12_18 || '--'}%\n`;
              precipText += `  18-24時: ${tomorrow.chanceOfRain.T18_24 || '--'}%\n`;
            }

            return {
              content: [
                {
                  type: 'text',
                  text: precipText
                }
              ]
            };

          case 'get_wind_speed':
            let windText = `${city}の風速情報:\n\n`;
            
            weatherData.forecasts.forEach((forecast, index) => {
              const dayLabel = index === 0 ? '今日' : index === 1 ? '明日' : '明後日';
              windText += `${dayLabel} (${forecast.date}):\n`;
              windText += `  天気: ${forecast.telop}\n`;
              if (forecast.detail && forecast.detail.wind) {
                windText += `  風: ${forecast.detail.wind}\n`;
              }
              if (forecast.detail && forecast.detail.wave) {
                windText += `  波: ${forecast.detail.wave}\n`;
              }
              windText += '\n';
            });

            return {
              content: [
                {
                  type: 'text',
                  text: windText
                }
              ]
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new Error(`Weather data fetch failed: ${error.message}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Local Weather Server running on stdio');
  }
}

// サーバーを起動
const server = new LocalWeatherServer();
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
}); 