import { generate_ob_headers_js } from '../lib/crypto/wasm_gzip';
import { getDeviceId } from './tool';

interface CustomFetchOptions extends RequestInit {
  // 您可以在这里添加自定义的选项类型
  // 例如：baseUrl?: string;
}

interface FetchResponse<T> {
  data?: T;
  error?: string;
  status: number;
  statusText: string;
  headers: Headers;
}

/**
 * 封装的 fetch 请求函数
 * @param url 请求的 URL
 * @param options RequestInit 选项，可以包含 method, headers, body 等
 * @returns Promise<FetchResponse<T>> 包含数据或错误的响应对象
 */
async function customFetch<T = any>(
  url: string,
  options: CustomFetchOptions = {},
): Promise<FetchResponse<T>> {
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    // 您可以在这里添加其他默认请求头
    // 'Authorization': `Bearer ${getToken()}`,
  };

  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  // 如果 body 是一个对象并且 Content-Type 是 application/json，则自动序列化
  if (
    mergedOptions.body &&
    typeof mergedOptions.body === 'object' &&
    (mergedOptions.headers as Record<string, string>)['Content-Type'] === 'application/json'
  ) {
    mergedOptions.body = JSON.stringify(mergedOptions.body);
  }

  try {
    const response = await fetch(url, mergedOptions);

    const responseData: FetchResponse<T> = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    };

    if (!response.ok) {
      // 尝试解析错误响应体
      try {
        const errorBody = await response.json();
        responseData.error =
          errorBody?.message ||
          errorBody?.error ||
          response.statusText ||
          'An unknown error occurred';
      } catch (e) {
        responseData.error =
          response.statusText || 'An unknown error occurred while parsing error response';
      }
      return responseData;
    }

    // 尝试解析 JSON 响应
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData.data = await response.json();
    } else {
      // 对于非 JSON 响应，可以根据需要处理，例如返回文本
      // responseData.data = await response.text() as any; // 强制类型转换，根据实际情况调整
      console.warn('Response was not JSON, returning raw response object. Handle accordingly.');
      // 或者您可以选择将整个 response 对象作为 data 返回，或者返回文本
      // responseData.data = response as any;
    }
    return responseData;
  } catch (error) {
    console.error('Fetch request failed:', error);
    const err = error as Error;
    return {
      error: err.message || 'Network request failed',
      status: 0, // 通常网络错误没有 HTTP 状态码
      statusText: err.name || 'NetworkError',
      headers: new Headers(),
    };
  }
}

export default customFetch;

type CrptoData = {
  header?: Record<string, any>;
  data?: string;
};
/**
 * 封装的 GET 请求函数
 * @param url 请求的 URL
 * @param options RequestInit 选项，可以包含 headers 等 (method 和 body 会被忽略)
 * @returns Promise<FetchResponse<T>> 包含数据或错误的响应对象
 */
export async function get<T = any>(
  url: string,
  options: Omit<CustomFetchOptions, 'method' | 'body'> = {},
): Promise<FetchResponse<T>> {
  const crptoData = generate_ob_headers_js(JSON.stringify({}), true, 'prod') as CrptoData;
  return customFetch<T>(url, {
    headers: {
      ...(crptoData?.header || {}),
      deviceId: getDeviceId()

    },
    ...options,
    method: 'GET',
  });
}

/**
 * 封装的 POST 请求函数
 * @param url 请求的 URL
 * @param body 请求体，可以是任何类型，如果 Content-Type 是 application/json，对象会被自动序列化
 * @param options RequestInit 选项，可以包含 headers 等 (method 会被忽略)
 * @returns Promise<FetchResponse<T>> 包含数据或错误的响应对象
 */
export async function post<T = any>(
  url: string,
  body?: any,
  options: Omit<CustomFetchOptions, 'method' | 'body'> = {},
): Promise<FetchResponse<T>> {
  console.log('🚀 ~ body:', body);
  const crptoData = generate_ob_headers_js(body, true, 'prod') as CrptoData;
  // console.log("🚀 ~ crptoData:", crptoData)

  return fetch(url, {
    headers: {
      ...(crptoData?.header || {}),
      'Content-Type': 'application/json',
      deviceId: getDeviceId(),
    },
    ...options,
    method: 'POST',
    body: crptoData.data, // customFetch 会处理 JSON 序列化
  });
}


