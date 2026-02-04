import { getVersionedEndpoint } from '../utils/api-paths.js';
import { handleDeskbirdException } from '../utils/error-handler.js';
import type { HttpClient } from '../utils/http-client.js';

/**
 * Scheduling API client for scheduling-related operations
 */
export class SchedulingApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  /**
   * Get staff planning overview
   */
  async getStaffPlanning(params: {
    startDate: string;
    days: number;
    all?: boolean;
    favorites?: boolean;
  }): Promise<any> {

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('startDate', params.startDate);
      queryParams.append('days', params.days.toString());
      queryParams.append('all', (params.all ?? false).toString());
      queryParams.append('favorites', (params.favorites ?? false).toString());

      const basePath = getVersionedEndpoint('SCHEDULING_STAFF_PLANNING', '/scheduling/staffPlanning');
      const fullPath = `${basePath}?${queryParams.toString()}`;

      const response = await this.client.get<any>(fullPath);

      if (!response.success) {
        throw new Error(`Failed to get staff planning: ${response.status} ${response.statusText}`);
      }

      return response.data;
    } catch (error: unknown) {
      handleDeskbirdException(error, 'getStaffPlanning');
    }
  }
}
