import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

interface WeatherData {
  publicTime: string;
  title: string;
  description: {
    text: string;
  };
  forecasts: Array<{
    date: string;
    dateLabel: string;
    telop: string;
    detail: {
      weather: string;
      wind: string;
      wave: string;
    };
    temperature: {
      min: { celsius: string | null };
      max: { celsius: string | null };
    };
    chanceOfRain: {
      T00_06: string;
      T06_12: string;
      T12_18: string;
      T18_24: string;
    };
  }>;
  location: {
    area: string;
    prefecture: string;
    district: string;
    city: string;
  };
}

// 都市IDマップ
const CITY_IDS: Record<string, string> = {
  "札幌": "016010",
  "青森": "020010", 
  "盛岡": "030010",
  "仙台": "040010",
  "秋田": "050010",
  "山形": "060010",
  "福島": "070010",
  "水戸": "080010",
  "宇都宮": "090010",
  "前橋": "100010",
  "さいたま": "110010",
  "千葉": "120010",
  "東京": "130010",
  "横浜": "140010",
  "新潟": "150010",
  "富山": "160010",
  "金沢": "170010",
  "福井": "180010",
  "甲府": "190010",
  "長野": "200010",
  "岐阜": "210010",
  "静岡": "220010",
  "名古屋": "230010",
  "津": "240010",
  "大津": "250010",
  "京都": "260010",
  "大阪": "270000",
  "神戸": "280010",
  "奈良": "290010",
  "和歌山": "300010",
  "鳥取": "310010",
  "松江": "320010",
  "岡山": "330010",
  "広島": "340010",
  "山口": "350010",
  "徳島": "360010",
  "高松": "370000",
  "松山": "380010",
  "高知": "390010",
  "福岡": "400010",
  "佐賀": "410010",
  "長崎": "420010",
  "熊本": "430010",
  "大分": "440010",
  "宮崎": "450010",
  "鹿児島": "460010",
  "那覇": "471010"
};

class WeatherServerWorker {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "mcp-weather",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_weather_overview",
            description: "指定した都市の天気概況を取得します",
            inputSchema: {
              type: "object",
              properties: {
                city: {
                  type: "string",
                  description: "都市名（例：東京、大阪、札幌など）",
                  enum: Object.keys(CITY_IDS)
                },
              },
              required: ["city"],
            },
          },
          {
            name: "get_precipitation_probability",  
            description: "指定した都市の降水確率を取得します",
            inputSchema: {
              type: "object",
              properties: {
                city: {
                  type: "string",
                  description: "都市名（例：東京、大阪、札幌など）",
                  enum: Object.keys(CITY_IDS)
                },
              },
              required: ["city"],
            },
          },
          {
            name: "get_wind_speed",
            description: "指定した都市の風速情報を取得します",
            inputSchema: {
              type: "object",
              properties: {
                city: {
                  type: "string", 
                  description: "都市名（例：東京、大阪、札幌など）",
                  enum: Object.keys(CITY_IDS)
                },
              },
              required: ["city"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_weather_overview":
            return await this.getWeatherOverview(args.city as string);
          case "get_precipitation_probability":
            return await this.getPrecipitationProbability(args.city as string);
          case "get_wind_speed":
            return await this.getWindSpeed(args.city as string);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async fetchWeatherData(city: string): Promise<WeatherData> {
    const cityId = CITY_IDS[city];
    if (!cityId) {
      throw new Error(`都市「${city}」のIDが見つかりません`);
    }

    const url = `https://weather.tsukumijima.net/api/forecast/city/${cityId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`気象データの取得に失敗しました: ${response.status}`);
    }

    return response.json();
  }

  private async getWeatherOverview(city: string) {
    const data = await this.fetchWeatherData(city);
    
    const overview = {
      city: data.location.city,
      prefecture: data.location.prefecture,
      publishTime: data.publicTime,
      description: data.description.text,
      forecasts: data.forecasts.map(forecast => ({
        date: forecast.date,
        dateLabel: forecast.dateLabel,
        weather: forecast.telop,
        detail: forecast.detail.weather || "詳細情報なし"
      }))
    };

    return {
      content: [
        {
          type: "text",
          text: `## ${city}の天気概況\n\n**発表時刻**: ${overview.publishTime}\n\n**概況**: ${overview.description}\n\n**予報**:\n${overview.forecasts.map(f => `- ${f.dateLabel} (${f.date}): ${f.weather}\n  詳細: ${f.detail}`).join('\n')}`
        }
      ]
    };
  }

  private async getPrecipitationProbability(city: string) {
    const data = await this.fetchWeatherData(city);
    
    const precipitationData = data.forecasts.map(forecast => ({
      date: forecast.date,
      dateLabel: forecast.dateLabel,
      chanceOfRain: forecast.chanceOfRain
    }));

    let result = `## ${city}の降水確率\n\n**発表時刻**: ${data.publicTime}\n\n`;
    
    precipitationData.forEach(day => {
      result += `**${day.dateLabel} (${day.date})**:\n`;
      result += `- 0時～6時: ${day.chanceOfRain.T00_06}\n`;
      result += `- 6時～12時: ${day.chanceOfRain.T06_12}\n`;
      result += `- 12時～18時: ${day.chanceOfRain.T12_18}\n`;
      result += `- 18時～24時: ${day.chanceOfRain.T18_24}\n\n`;
    });

    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  }

  private async getWindSpeed(city: string) {
    const data = await this.fetchWeatherData(city);
    
    const windData = data.forecasts.map(forecast => ({
      date: forecast.date,
      dateLabel: forecast.dateLabel,
      wind: forecast.detail.wind || "風の情報なし"
    }));

    let result = `## ${city}の風速情報\n\n**発表時刻**: ${data.publicTime}\n\n`;
    
    windData.forEach(day => {
      result += `**${day.dateLabel} (${day.date})**:\n`;
      result += `- 風: ${day.wind}\n\n`;
    });

    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };  
  }

  async handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json();
      const response = await this.server.request(body);
      
      return new Response(JSON.stringify(response), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    const server = new WeatherServerWorker();
    return server.handleRequest(request);
  }
}; 