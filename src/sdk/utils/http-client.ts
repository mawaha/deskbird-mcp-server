import type { ApiResponse, HttpMethod, RequestOptions } from '../types/api.js';

/**
 * HTTP client utility for making API requests to Deskbird
 * Similar to the Axios client pattern from the Omni Administration SDK
 */
export class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(
    baseUrl: string,
    defaultHeaders: Record<string, string> = {},
    timeout: number = 30000
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    };
    this.timeout = timeout;
  }

  /**
   * Make a generic HTTP request
   */
  async request<T = any>(
    method: HttpMethod,
    path: string,
    body?: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    // Path should include version if needed (e.g., '/v1.1/bookings')
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const timestamp = new Date().toISOString();

    // Prepare headers
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options.headers,
    };

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(options.timeout || this.timeout),
    };

    // Add body for methods that support it
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      // HTTP request logging can be enabled via config if needed
      
      const response = await fetch(url, requestOptions);
      
      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Try to parse response body
      let responseData: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        try {
          responseData = await response.json();
        } catch (parseError) {
          responseData = { 
            error: 'Failed to parse JSON response', 
            raw: await response.text() 
          };
        }
      } else {
        responseData = { text: await response.text() };
      }

      const apiResponse: ApiResponse<T> = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        headers: responseHeaders,
        requestInfo: {
          method,
          url,
          timestamp,
        },
      };

      return apiResponse;
    } catch (fetchError) {
      // Error details are captured in the response object
      
      return {
        success: false,
        status: 0,
        statusText: 'Network Error',
        data: { 
          error: fetchError instanceof Error ? fetchError.message : 'Unknown network error',
          type: 'NetworkError'
        } as T,
        headers: {},
        requestInfo: {
          method,
          url,
          timestamp,
        },
      };
    }
  }

  /**
   * GET request
   */
  async get<T = any>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * POST request
   */
  async post<T = any>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, options);
  }

  /**
   * PUT request
   */
  async put<T = any>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body, options);
  }

  /**
   * PATCH request
   */
  async patch<T = any>(path: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body, options);
  }

  /**
   * DELETE request
   */
  async delete<T = any>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /**
   * Update default headers (e.g., for authentication)
   */
  setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = {
      ...this.defaultHeaders,
      ...headers,
    };
  }

  /**
   * Get current default headers
   */
  getDefaultHeaders(): Record<string, string> {
    return { ...this.defaultHeaders };
  }
}
